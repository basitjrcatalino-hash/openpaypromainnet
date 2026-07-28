import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreditSchema = z.object({
  amount: z.number().positive().min(1).max(50_000),
  moonpayTransactionId: z.string().trim().min(8).max(128),
  walletId: z.string().uuid().optional(),
});

/**
 * Credit OUSD 1:1 after a MoonPay buy completes (client callback).
 * Idempotent on `tx_hash` = `moonpay:{transactionId}`.
 */
export const creditMoonPayTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreditSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { amount, moonpayTransactionId, walletId } = data;
    const txHash = `moonpay:${moonpayTransactionId}`;

    const { data: existing } = await supabase
      .from("transactions")
      .select("id, amount, wallet_id")
      .eq("tx_hash", txHash)
      .maybeSingle();

    if (existing) {
      return {
        ok: true as const,
        alreadyCredited: true as const,
        amount: Number(existing.amount),
        walletId: existing.wallet_id as string,
      };
    }

    const { fetchActiveWallet } = await import("./wallet-utils");
    let wallet: { id: string; ousd_balance?: number | null } | null = null;

    if (walletId) {
      const { data: w } = await supabase
        .from("wallets")
        .select("id, ousd_balance")
        .eq("id", walletId)
        .eq("user_id", userId)
        .maybeSingle();
      wallet = w;
    }
    if (!wallet) {
      wallet = await fetchActiveWallet<{ id: string; ousd_balance?: number | null }>(
        supabase,
        userId,
      );
    }
    if (!wallet) throw new Error("Active wallet not found");

    const creditAmt = Math.round(amount * 100) / 100;
    const newBal = Number(wallet.ousd_balance ?? 0) + creditAmt;
    const { error: uErr } = await supabase
      .from("wallets")
      .update({ ousd_balance: newBal })
      .eq("id", wallet.id);
    if (uErr) throw uErr;

    const { error: txErr } = await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      type: "buy",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty: `moonpay:${moonpayTransactionId.slice(0, 12)}`,
      amount: creditAmt,
      usd_value: creditAmt,
      tx_hash: txHash,
      memo: `MoonPay top-up · ${moonpayTransactionId}`,
    });
    if (txErr) {
      if (/duplicate|unique/i.test(txErr.message)) {
        return {
          ok: true as const,
          alreadyCredited: true as const,
          amount: creditAmt,
          walletId: wallet.id,
        };
      }
      throw txErr;
    }

    return {
      ok: true as const,
      alreadyCredited: false as const,
      amount: creditAmt,
      walletId: wallet.id,
      balance: newBal,
    };
  });
