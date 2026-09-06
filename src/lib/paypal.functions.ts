import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PAYPAL_MAX_USD, PAYPAL_MIN_USD } from "@/lib/paypal";

export const getPaypalConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { isPaypalConfigured, getPaypalClientId, getPaypalEnv } = await import(
      "@/lib/paypal.server"
    );
    const configured = isPaypalConfigured();
    return {
      configured,
      clientId: configured ? getPaypalClientId() : "",
      env: getPaypalEnv(),
      currency: "USD" as const,
    };
  });

const CreateSchema = z.object({
  amountUsd: z.number().min(PAYPAL_MIN_USD).max(PAYPAL_MAX_USD),
});

export const createPaypalTopupOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { createPaypalOrderServer } = await import("@/lib/paypal.server");
    const orderRef = `OPP-${Date.now().toString(36).toUpperCase()}`;
    const order = await createPaypalOrderServer({
      amountUsd: Math.round(data.amountUsd * 100) / 100,
      userId: context.userId,
      orderRef,
    });
    return { ...order, orderRef };
  });

const CaptureSchema = z.object({
  orderId: z.string().trim().min(4).max(64),
  method: z.string().trim().max(32).optional(),
  walletId: z.string().uuid().optional(),
});

/** Capture an approved PayPal order and credit OUSD 1:1. Idempotent. */
export const capturePaypalTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CaptureSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { capturePaypalOrderServer } = await import("@/lib/paypal.server");
    const info = await capturePaypalOrderServer(data.orderId);

    if (info.userId && info.userId !== userId) throw new Error("Payment belongs to another user");
    if (!info.paid) return { paid: false as const, status: info.status };

    const txHash = `paypal:${data.orderId}`;
    const { data: existing } = await supabase
      .from("transactions")
      .select("id, amount")
      .eq("tx_hash", txHash)
      .maybeSingle();
    if (existing) {
      return {
        paid: true as const,
        status: info.status,
        alreadyCredited: true as const,
        amount: Number(existing.amount),
      };
    }

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
    if (!wallet) wallet = await fetchActiveWallet<{ id: string }>(supabase, userId);
    if (!wallet) throw new Error("Active wallet not found");

    const gross = Math.round((info.amountUsd || 0) * 100) / 100;
    if (gross <= 0) throw new Error("Payment amount missing");

    const { creditTopupWithFee } = await import("./topup-fee");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const credited = await creditTopupWithFee({
        client: supabase,
        admin: supabaseAdmin,
        userWalletId: wallet.id,
        grossAmount: gross,
        counterparty: `paypal:${data.orderId.slice(0, 14)}`,
        txHash,
        memo: `PayPal top-up · ${data.method || "paypal"} · ${data.orderId}`,
      });
      return {
        paid: true as const,
        status: info.status,
        alreadyCredited: false as const,
        amount: credited.netAmount,
        balance: credited.balance,
      };
    } catch (err) {
      if (/duplicate|unique/i.test((err as Error).message ?? "")) {
        return {
          paid: true as const,
          status: info.status,
          alreadyCredited: true as const,
          amount: gross,
        };
      }
      throw err;
    }
  });
