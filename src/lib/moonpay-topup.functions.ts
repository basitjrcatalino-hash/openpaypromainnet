import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreditSchema = z.object({
  amount: z.number().positive().min(0.01).max(50_000),
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
    const { creditTopupWithFee } = await import("./topup-fee");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const credited = await creditTopupWithFee({
        client: supabase,
        admin: supabaseAdmin,
        userWalletId: wallet.id,
        grossAmount: creditAmt,
        counterparty: `moonpay:${moonpayTransactionId.slice(0, 12)}`,
        txHash,
        memo: `MoonPay top-up · ${moonpayTransactionId}`,
      });
      return {
        ok: true as const,
        alreadyCredited: false as const,
        amount: credited.netAmount,
        grossAmount: credited.grossAmount,
        feeAmount: credited.feeAmount,
        walletId: wallet.id,
        balance: credited.balance,
      };
    } catch (txErr) {
      const msg = (txErr as Error).message ?? "";
      if (/duplicate|unique/i.test(msg)) {
        return {
          ok: true as const,
          alreadyCredited: true as const,
          amount: creditAmt,
          walletId: wallet.id,
        };
      }
      throw txErr;
    }
  });
