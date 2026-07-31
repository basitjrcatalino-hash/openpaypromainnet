import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LedgerCashSchema = z.object({
  amount: z.number().positive().min(0.01).max(50_000),
  walletId: z.string().uuid().optional(),
});

const OnChainCashSchema = z.object({
  amount: z.number().positive().min(0.01).max(50_000),
  signature: z.string().trim().min(32).max(128),
  walletId: z.string().uuid().optional(),
});

function round12(n: number) {
  return Math.round(n * 1e12) / 1e12;
}

type CashWalletRow = {
  id: string;
  ousd_balance?: number | null;
  cash_balance?: number | null;
};

/**
 * Spend ledger CASH (Phantom stablecoin balance) → credit OUSD ~1:1.
 * Uses platform top-up fee (same as other rails).
 */
export const topupWithLedgerCash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LedgerCashSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { amount, walletId } = data;

    const { fetchActiveWallet } = await import("./wallet-utils");
    let wallet: CashWalletRow | null = null;

    if (walletId) {
      const { data: w } = await supabase
        .from("wallets")
        .select("id, ousd_balance, cash_balance")
        .eq("id", walletId)
        .eq("user_id", userId)
        .maybeSingle();
      wallet = w;
    }
    if (!wallet) {
      wallet = await fetchActiveWallet<CashWalletRow>(supabase, userId);
    }
    if (!wallet?.id) throw new Error("Active wallet not found");

    const walletIdResolved = wallet.id;
    const cashBal = round12(Number(wallet.cash_balance ?? 0));
    const spend = round12(amount);
    if (cashBal + 1e-12 < spend) {
      throw new Error(
        `Insufficient CASH balance (${cashBal.toFixed(2)} available)`,
      );
    }

    const { error: debitErr } = await supabase
      .from("wallets")
      .update({ cash_balance: round12(cashBal - spend) })
      .eq("id", walletIdResolved)
      .eq("user_id", userId);
    if (debitErr) throw new Error(debitErr.message);

    const { creditTopupWithFee } = await import("./topup-fee");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      const credited = await creditTopupWithFee({
        client: supabase,
        admin: supabaseAdmin,
        userWalletId: walletIdResolved,
        grossAmount: spend,
        counterparty: "cash:ledger",
        memo: `CASH → OUSD · ledger · ${spend}`,
      });

      try {
        await supabase.from("transactions").insert({
          wallet_id: walletIdResolved,
          type: "sell",
          status: "confirmed",
          token_symbol: "CASH",
          counterparty: "ousd:topup",
          amount: spend,
          usd_value: spend,
          memo: `Spent CASH for ${credited.netAmount} OUSD top-up`,
        });
      } catch {
        /* non-fatal ledger row */
      }

      return {
        ok: true as const,
        amount: credited.netAmount,
        grossAmount: credited.grossAmount,
        feeAmount: credited.feeAmount,
        walletId: walletIdResolved,
        balance: credited.balance,
        cashRemaining: round12(cashBal - spend),
      };
    } catch (err) {
      // Best-effort restore CASH if OUSD credit fails
      await supabase
        .from("wallets")
        .update({ cash_balance: cashBal })
        .eq("id", walletIdResolved)
        .eq("user_id", userId);
      throw err;
    }
  });

/**
 * Credit OUSD after an on-chain Solana Pay CASH (SPL) transfer.
 * Idempotent on `tx_hash` (= Solana signature).
 * Mint: CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH (6 decimals).
 */
export const creditCashPayTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OnChainCashSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { amount, signature, walletId } = data;

    const { data: existing } = await supabase
      .from("transactions")
      .select("id, amount, wallet_id")
      .eq("tx_hash", signature)
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

    const { creditTopupWithFee } = await import("./topup-fee");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const credited = await creditTopupWithFee({
        client: supabase,
        admin: supabaseAdmin,
        userWalletId: wallet.id,
        grossAmount: amount,
        counterparty: `cash:${signature.slice(0, 12)}`,
        txHash: signature,
        memo: `CASH Solana Pay top-up · ${signature}`,
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
          amount,
          walletId: wallet.id,
        };
      }
      throw txErr;
    }
  });
