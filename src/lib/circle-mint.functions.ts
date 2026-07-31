import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "crypto";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createTransientPaymentIntent,
  extractDepositAddress,
  getCircleMintChain,
  getCirclePaymentIntent,
  isCircleMintConfigured,
  latestIntentStatus,
  listCirclePayments,
  isPaymentSettled,
} from "@/lib/circle-mint.server";
import { creditCircleMintPayment } from "@/lib/circle-mint-credit.server";

const CreateSchema = z.object({
  amount: z.number().positive().min(0.01).max(50_000),
  walletId: z.string().uuid().optional(),
  chain: z.string().trim().min(2).max(32).optional(),
});

const IntentSchema = z.object({
  paymentIntentId: z.string().uuid(),
});

const ListSchema = z.object({
  paymentIntentId: z.string().uuid().optional(),
  status: z.string().optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

function mapDepositRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    paymentIntentId: String(row.payment_intent_id),
    expectedAmount: Number(row.expected_amount),
    currency: String(row.currency || "USD"),
    chain: String(row.chain || "ETH"),
    depositAddress: row.deposit_address ? String(row.deposit_address) : null,
    status: String(row.status),
    circlePaymentId: row.circle_payment_id ? String(row.circle_payment_id) : null,
    txHash: row.tx_hash ? String(row.tx_hash) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Create a Circle Mint transient payment intent for OUSD top-up. */
export const createCircleMintDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!isCircleMintConfigured()) {
      throw new Error("Circle Mint is not configured (set CIRCLE_API_KEY)");
    }

    const { supabase, userId } = context;
    const { fetchActiveWallet } = await import("./wallet-utils");

    let wallet: { id: string } | null = null;
    if (data.walletId) {
      const { data: w } = await supabase
        .from("wallets")
        .select("id")
        .eq("id", data.walletId)
        .eq("user_id", userId)
        .maybeSingle();
      wallet = w;
    }
    if (!wallet) {
      wallet = await fetchActiveWallet<{ id: string }>(supabase, userId);
    }
    if (!wallet) throw new Error("Active wallet not found");

    const chain = (data.chain || getCircleMintChain()).toUpperCase();
    const idempotencyKey = randomUUID();

    let intent = await createTransientPaymentIntent({
      idempotencyKey,
      amountUsd: data.amount,
      chain,
      customerExternalRef: userId,
    });

    // Address is often assigned asynchronously — refresh once if missing
    let deposit = extractDepositAddress(intent);
    if (!deposit) {
      await new Promise((r) => setTimeout(r, 800));
      intent = await getCirclePaymentIntent(intent.id);
      deposit = extractDepositAddress(intent);
    }

    const { data: row, error } = await supabase
      .from("circle_mint_deposits")
      .insert({
        user_id: userId,
        wallet_id: wallet.id,
        payment_intent_id: intent.id,
        expected_amount: data.amount,
        currency: "USD",
        chain: deposit?.chain || chain,
        deposit_address: deposit?.address ?? null,
        status: latestIntentStatus(intent) === "pending" ? "pending" : "created",
        raw_intent: intent as unknown as import("@/integrations/supabase/types").Json,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return {
      ...mapDepositRow(row as Record<string, unknown>),
      intentStatus: latestIntentStatus(intent),
      expiresOn: intent.expiresOn ?? null,
    };
  });

/** Refresh deposit address / status from Circle. */
export const refreshCircleMintDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IntentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("circle_mint_deposits")
      .select("*")
      .eq("payment_intent_id", data.paymentIntentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Deposit not found");
    if (row.status === "credited") {
      return {
        ...mapDepositRow(row as Record<string, unknown>),
        intentStatus: "credited",
        expiresOn: null as string | null,
        payments: [] as Array<{
          id: string;
          status: string | undefined;
          amount: string | undefined;
          currency: string | undefined;
          transactionHash: string | undefined;
          createDate: string | undefined;
        }>,
      };
    }

    const intent = await getCirclePaymentIntent(data.paymentIntentId);
    const deposit = extractDepositAddress(intent);
    const status = latestIntentStatus(intent);

    const patch: {
      updated_at: string;
      raw_intent: import("@/integrations/supabase/types").Json;
      deposit_address?: string;
      chain?: string;
      status?: string;
    } = {
      updated_at: new Date().toISOString(),
      raw_intent: intent as unknown as import("@/integrations/supabase/types").Json,
    };
    if (deposit?.address) {
      patch.deposit_address = deposit.address;
      patch.chain = deposit.chain;
    }
    if (status === "expired" || status === "failed") patch.status = status;
    else if (row.status !== "credited" && row.status !== "paid") {
      patch.status = status === "complete" ? "pending" : status || row.status;
    }

    const { data: updated } = await supabase
      .from("circle_mint_deposits")
      .update(patch)
      .eq("id", row.id)
      .select("*")
      .single();

    const payments = await listCirclePayments({
      paymentIntentId: data.paymentIntentId,
      pageSize: 20,
    });

    return {
      ...mapDepositRow((updated || row) as Record<string, unknown>),
      intentStatus: status,
      expiresOn: intent.expiresOn ?? null,
      payments: payments.map((p) => ({
        id: p.id,
        status: p.status,
        amount: p.amount?.amount,
        currency: p.amount?.currency,
        transactionHash: p.transactionHash,
        createDate: p.createDate,
      })),
    };
  });

/**
 * List Circle Mint payments (scoped to user's intent, or recent for intent).
 * Uses GET /v1/payments.
 */
export const listCircleMintPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!isCircleMintConfigured()) {
      throw new Error("Circle Mint is not configured");
    }
    const { supabase, userId } = context;

    if (data.paymentIntentId) {
      const { data: row } = await supabase
        .from("circle_mint_deposits")
        .select("id")
        .eq("payment_intent_id", data.paymentIntentId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!row) throw new Error("Deposit not found");
    } else {
      // Without intent, only return payments for this user's intents
      const { data: intents } = await supabase
        .from("circle_mint_deposits")
        .select("payment_intent_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      const ids = (intents || []).map((r) => String(r.payment_intent_id));
      if (!ids.length) return { payments: [] };

      const all = [];
      for (const id of ids.slice(0, 5)) {
        const chunk = await listCirclePayments({
          paymentIntentId: id,
          status: data.status,
          pageSize: data.pageSize ?? 20,
        });
        all.push(...chunk);
      }
      return {
        payments: all.map((p) => ({
          id: p.id,
          status: p.status,
          amount: p.amount?.amount,
          currency: p.amount?.currency,
          paymentIntentId: p.paymentIntentId,
          transactionHash: p.transactionHash,
          createDate: p.createDate,
        })),
      };
    }

    const payments = await listCirclePayments({
      paymentIntentId: data.paymentIntentId,
      status: data.status,
      pageSize: data.pageSize ?? 50,
    });

    return {
      payments: payments.map((p) => ({
        id: p.id,
        status: p.status,
        amount: p.amount?.amount,
        currency: p.amount?.currency,
        paymentIntentId: p.paymentIntentId,
        transactionHash: p.transactionHash,
        createDate: p.createDate,
      })),
    };
  });

/** Poll Circle payments for an intent and credit OUSD when paid. */
export const syncCircleMintDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IntentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("circle_mint_deposits")
      .select("*")
      .eq("payment_intent_id", data.paymentIntentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Deposit not found");

    if (row.status === "credited") {
      return {
        status: "credited" as const,
        alreadyCredited: true,
        amount: Number(row.expected_amount),
        paymentId: row.circle_payment_id,
      };
    }

    const payments = await listCirclePayments({
      paymentIntentId: data.paymentIntentId,
      pageSize: 50,
    });

    const settled = payments.find(isPaymentSettled);
    if (!settled) {
      // Refresh address while waiting
      try {
        const intent = await getCirclePaymentIntent(data.paymentIntentId);
        const deposit = extractDepositAddress(intent);
        if (deposit?.address && deposit.address !== row.deposit_address) {
          await supabase
            .from("circle_mint_deposits")
            .update({
              deposit_address: deposit.address,
              chain: deposit.chain,
              status: "pending",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
      } catch {
        /* ignore refresh errors while polling */
      }

      return {
        status: "pending" as const,
        alreadyCredited: false,
        amount: 0,
        paymentId: null as string | null,
        paymentCount: payments.length,
      };
    }

    await supabase
      .from("circle_mint_deposits")
      .update({
        status: "paid",
        circle_payment_id: settled.id,
        tx_hash: settled.transactionHash || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    const credited = await creditCircleMintPayment({
      userId,
      walletId: String(row.wallet_id),
      payment: settled,
      expectedAmount: Number(row.expected_amount),
    });

    return {
      status: "credited" as const,
      alreadyCredited: credited.alreadyCredited,
      amount: credited.amount,
      paymentId: credited.paymentId,
      paymentCount: payments.length,
    };
  });
