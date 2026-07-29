/**
 * Server functions: ensure Circle crypto wallet for an OpenPay user,
 * fetch balances / transactions.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  circleWalletIdempotencyKey,
  isCircleConfigured,
  resolveCircleBlockchain,
} from "@/lib/circle";
import { getWalletProvider } from "@/lib/wallet-providers";
import type { CryptoWalletRecord, TokenBalance } from "@/lib/wallet-providers/types";

/** Untyped admin client for tables not yet in generated Database types. */
async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as {
    from: (table: string) => any;
  };
}

/**
 * Ensure the authenticated user has a Circle (or active provider) crypto wallet.
 * Idempotent: returns existing row if present.
 */
export const ensureCryptoWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const db = await adminDb();

    const { data: existing } = await db
      .from("crypto_wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "circle")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { wallet: existing as CryptoWalletRecord, created: false };
    }

    if (!isCircleConfigured()) {
      throw new Error(
        "Circle wallets are not configured. Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET.",
      );
    }

    const blockchain = resolveCircleBlockchain();
    const provider = getWalletProvider("circle");
    const created = await provider.createWallet({
      userId,
      blockchain,
      idempotencyKey: circleWalletIdempotencyKey(userId, blockchain),
    });

    const { data: raced } = await db
      .from("crypto_wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "circle")
      .eq("circle_wallet_id", created.providerWalletId)
      .maybeSingle();
    if (raced) return { wallet: raced as CryptoWalletRecord, created: false };

    const { data: inserted, error } = await db
      .from("crypto_wallets")
      .insert({
        user_id: userId,
        provider: "circle",
        circle_wallet_id: created.providerWalletId,
        wallet_set_id: created.walletSetId,
        blockchain: created.blockchain,
        address: created.address,
        status: "active",
      })
      .select("*")
      .single();

    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        const { data: again } = await db
          .from("crypto_wallets")
          .select("*")
          .eq("user_id", userId)
          .eq("provider", "circle")
          .limit(1)
          .maybeSingle();
        if (again) return { wallet: again as CryptoWalletRecord, created: false };
      }
      throw new Error(error.message);
    }

    return { wallet: inserted as CryptoWalletRecord, created: true };
  });

/** Get active crypto wallet + live balances + recent txs for the user. */
export const getCryptoWalletDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // @ts-expect-error TanStack Start middleware + complex return type inference
  .handler(async ({ context }: any) => {
    const userId = String(context.userId);
    const db = await adminDb();

    const { data: wallet } = await db
      .from("crypto_wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "circle")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const configured = isCircleConfigured();

    if (!wallet) {
      return {
        wallet: null as CryptoWalletRecord | null,
        balances: [] as TokenBalance[],
        transactions: [] as unknown[],
        configured,
      };
    }

    const w = wallet as CryptoWalletRecord;
    let balances: TokenBalance[] = [];
    try {
      if (w.circle_wallet_id && configured) {
        balances = await getWalletProvider("circle").getBalance(w.circle_wallet_id);
      }
    } catch (err) {
      console.error("[circle] getBalance", err);
    }

    const { data: txs } = await db
      .from("crypto_transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("wallet_id", w.id)
      .order("created_at", { ascending: false })
      .limit(50);

    return {
      wallet: w,
      balances,
      transactions: (txs ?? []) as unknown[],
      configured,
    };
  });

/** Send tokens from the user's Circle wallet. */
export const sendCryptoTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        destinationAddress: z.string().min(8).max(128),
        tokenAddress: z.string().min(8).max(128),
        amount: z.string().min(1).max(40),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const db = await adminDb();

    const { data: wallet } = await db
      .from("crypto_wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "circle")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const w = wallet as CryptoWalletRecord | null;
    if (!w?.circle_wallet_id) throw new Error("Missing Circle wallet");

    const provider = getWalletProvider("circle");
    const { providerTxId } = await provider.sendTransaction({
      walletId: w.id,
      providerWalletId: w.circle_wallet_id,
      destinationAddress: data.destinationAddress,
      tokenAddress: data.tokenAddress,
      amount: data.amount,
      blockchain: w.blockchain,
    });

    await db.from("crypto_transactions").insert({
      user_id: userId,
      wallet_id: w.id,
      tx_hash: null,
      token: data.tokenAddress,
      amount: Number(data.amount) || 0,
      network: w.blockchain,
      status: "INITIATED",
      direction: "withdraw",
      provider_tx_id: providerTxId,
    });

    return { providerTxId };
  });
