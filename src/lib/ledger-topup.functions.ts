import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fetchMajorUsdPrices,
  LEDGER_BALANCE_COLUMN,
  type LedgerMajorId,
} from "@/lib/ledger-majors";

export const LEDGER_TOPUP_ASSETS = ["USDT", "USDC", "SOL"] as const;
export type LedgerTopupAsset = (typeof LEDGER_TOPUP_ASSETS)[number];

const Schema = z.object({
  /** USD notional to credit as OUSD (before platform top-up fee). */
  amount: z.number().positive().min(0.01).max(50_000),
  pay_asset: z.enum(LEDGER_TOPUP_ASSETS),
  walletId: z.string().uuid().optional(),
});

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}
function round12(n: number) {
  return Math.round(n * 1e12) / 1e12;
}

function isStable(asset: LedgerTopupAsset): boolean {
  return asset === "USDT" || asset === "USDC";
}

function balanceColumn(asset: LedgerTopupAsset): string {
  return LEDGER_BALANCE_COLUMN[asset.toLowerCase() as LedgerMajorId];
}

/**
 * Spend Pro wallet USDT / USDC / SOL → credit OUSD (with platform top-up fee).
 * Stables debit 1:1 with the USD amount; SOL debits at live CoinGecko price.
 */
export const topupWithLedgerAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { amount, pay_asset: payAsset, walletId } = data;
    const grossUsd = round8(amount);
    const col = balanceColumn(payAsset);

    const { fetchActiveWallet } = await import("./wallet-utils");
    let wallet: Record<string, unknown> | null = null;

    if (walletId) {
      const { data: w } = await supabase
        .from("wallets")
        .select(`id, ousd_balance, ${col}`)
        .eq("id", walletId)
        .eq("user_id", userId)
        .maybeSingle();
      wallet = w as Record<string, unknown> | null;
    }
    if (!wallet) {
      wallet = (await fetchActiveWallet<Record<string, unknown>>(
        supabase,
        userId,
        `id, ousd_balance, ${col}`,
      )) as Record<string, unknown> | null;
    }
    if (!wallet?.id) throw new Error("Active wallet not found");

    const walletIdResolved = String(wallet.id);
    const payBal = round12(Number(wallet[col] ?? 0));

    let payDebit: number;
    let payPriceUsd = 1;
    if (isStable(payAsset)) {
      payDebit = grossUsd;
    } else {
      const prices = await fetchMajorUsdPrices(["sol"]);
      payPriceUsd = Number(prices.sol) || 0;
      if (!(payPriceUsd > 0)) throw new Error("Could not price SOL");
      payDebit = round12(grossUsd / payPriceUsd);
    }

    if (payBal + 1e-12 < payDebit) {
      throw new Error(
        `Insufficient ${payAsset} (need ${payDebit}, have ${round12(payBal)})`,
      );
    }

    const nextPay = isStable(payAsset)
      ? round8(payBal - payDebit)
      : round12(payBal - payDebit);

    const debitPatch =
      payAsset === "USDT"
        ? { usdt_balance: nextPay }
        : payAsset === "USDC"
          ? { usdc_balance: nextPay }
          : { sol_balance: nextPay };

    const { error: debitErr } = await supabase
      .from("wallets")
      .update(debitPatch)
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
        grossAmount: grossUsd,
        counterparty: `${payAsset.toLowerCase()}:ledger`,
        memo: isStable(payAsset)
          ? `${payAsset} → OUSD · ledger · ${grossUsd}`
          : `${payDebit} SOL → OUSD · ≈ $${grossUsd} @ $${payPriceUsd}`,
      });

      try {
        await supabase.from("transactions").insert({
          wallet_id: walletIdResolved,
          type: "sell",
          status: "confirmed",
          token_symbol: payAsset,
          counterparty: "ousd:topup",
          amount: payDebit,
          usd_value: grossUsd,
          memo: `Spent ${payDebit} ${payAsset} for ${credited.netAmount} OUSD top-up`,
        });
      } catch {
        /* non-fatal */
      }

      return {
        ok: true as const,
        amount: credited.netAmount,
        grossAmount: credited.grossAmount,
        feeAmount: credited.feeAmount,
        pay_asset: payAsset,
        pay_spent: payDebit,
        pay_price_usd: payPriceUsd,
        walletId: walletIdResolved,
        balance: credited.balance,
        payRemaining: nextPay,
      };
    } catch (err) {
      await supabase
        .from("wallets")
        .update(
          payAsset === "USDT"
            ? { usdt_balance: payBal }
            : payAsset === "USDC"
              ? { usdc_balance: payBal }
              : { sol_balance: payBal },
        )
        .eq("id", walletIdResolved)
        .eq("user_id", userId);
      throw err;
    }
  });
