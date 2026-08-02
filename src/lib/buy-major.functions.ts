import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fetchMajorUsdPrices,
  LEDGER_BALANCE_COLUMN,
  majorBalancePatch,
  readMajorBalance,
  type LedgerMajorId,
} from "@/lib/ledger-majors";
import { MAJOR_TOKENS, isMajorTokenId } from "@/lib/major-tokens";
import {
  applyPlatformTradeFee,
  creditPlatformFeeOusd,
  SPOT_TAKER_FEE_BPS,
  resolvePlatformTreasuryWallet,
} from "@/lib/platform-treasury";

export const BUY_PAY_ASSETS = ["OUSD", "USDT", "USDC", "SOL"] as const;
export type BuyPayAsset = (typeof BUY_PAY_ASSETS)[number];

const BuyMajorSchema = z.object({
  wallet_id: z.string().uuid(),
  major_id: z.string().refine(isMajorTokenId, "Invalid major"),
  /** USD notional to spend (gross — includes platform fee) */
  usd_amount: z.number().positive().min(0.01).max(50_000),
  /** Asset to debit from the Pro wallet (defaults to OUSD). */
  pay_asset: z.enum(BUY_PAY_ASSETS).default("OUSD"),
});

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}
function round12(n: number) {
  return Math.round(n * 1e12) / 1e12;
}

function isStablePay(asset: BuyPayAsset): boolean {
  return asset === "OUSD" || asset === "USDT" || asset === "USDC";
}

function payBalanceColumn(asset: BuyPayAsset): string {
  if (asset === "OUSD") return "ousd_balance";
  return LEDGER_BALANCE_COLUMN[asset.toLowerCase() as "usdt" | "usdc" | "sol"];
}

function readPayBalance(wallet: Record<string, unknown>, asset: BuyPayAsset): number {
  return Number(wallet[payBalanceColumn(asset)] ?? 0) || 0;
}

function payPatch(asset: BuyPayAsset, next: number, majorPatch: Record<string, number>) {
  if (asset === "OUSD") return { ousd_balance: next, ...majorPatch };
  if (asset === "USDT") return { usdt_balance: next, ...majorPatch };
  if (asset === "USDC") return { usdc_balance: next, ...majorPatch };
  return { sol_balance: next, ...majorPatch };
}

/** Credit platform fee in the same asset that was spent. */
async function creditPlatformFeePayAsset(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: { from: (table: string) => any },
  opts: {
    amount: number;
    usdValue: number;
    asset: BuyPayAsset;
    memo: string;
    sourceWalletId?: string | null;
    counterparty?: string;
  },
): Promise<void> {
  const amount = opts.asset === "SOL" ? round12(opts.amount) : round8(opts.amount);
  if (!(amount > 0)) return;

  if (opts.asset === "OUSD") {
    await creditPlatformFeeOusd(admin, {
      amount,
      memo: opts.memo,
      sourceWalletId: opts.sourceWalletId,
      counterparty: opts.counterparty,
    });
    return;
  }

  const treasury = await resolvePlatformTreasuryWallet(admin);
  if (!treasury) {
    console.error("[buy-major] fee treasury missing for", opts.asset);
    return;
  }

  const col = payBalanceColumn(opts.asset);
  const { data: fresh } = await admin.from("wallets").select(col).eq("id", treasury.id).maybeSingle();
  const cur = Number((fresh as Record<string, unknown> | null)?.[col] ?? 0) || 0;
  const next = opts.asset === "SOL" ? round12(cur + amount) : round8(cur + amount);

  const feePatch =
    opts.asset === "USDT"
      ? { usdt_balance: next }
      : opts.asset === "USDC"
        ? { usdc_balance: next }
        : { sol_balance: next };

  const { error } = await admin.from("wallets").update(feePatch).eq("id", treasury.id);
  if (error) {
    console.error("[buy-major] fee credit failed", opts.asset, error.message);
    return;
  }

  try {
    await admin.from("transactions").insert({
      wallet_id: treasury.id,
      type: "receive",
      status: "confirmed",
      token_symbol: opts.asset,
      counterparty: opts.counterparty ?? opts.sourceWalletId ?? "platform_fee",
      amount,
      usd_value: round8(opts.usdValue),
      memo: opts.memo,
    });
  } catch (e) {
    console.warn("[buy-major] fee ledger insert failed", (e as Error).message);
  }
}

/**
 * Spend OUSD / USDT / USDC / SOL from the Pro wallet and credit a major ledger balance
 * at live CoinGecko price. Deducts SPOT_TAKER_FEE_BPS (0.10%) and credits the fee wallet.
 */
export const buyMajorWithOusd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BuyMajorSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const major = data.major_id as LedgerMajorId;
    const payAsset = data.pay_asset ?? "OUSD";
    const grossUsd = round8(data.usd_amount);
    const def = MAJOR_TOKENS[major];
    const { fee: feeUsd, net: netUsd, feeBps } = applyPlatformTradeFee(
      grossUsd,
      SPOT_TAKER_FEE_BPS,
    );
    if (!(netUsd > 0)) throw new Error("Amount too small after fee");

    if (def.symbol.toUpperCase() === payAsset) {
      throw new Error(`Cannot buy ${def.symbol} with ${payAsset} — pick a different payment method`);
    }

    const { data: wallet, error: walErr } = await supabase
      .from("wallets")
      .select(
        "id, ousd_balance, pi_balance, btc_balance, eth_balance, sol_balance, usdc_balance, usdt_balance, pyusd_balance, usdg_balance, usd1_balance, cash_balance, eurc_balance, hype_balance, zec_balance, tslax_balance, nflxx_balance, googlx_balance, bnb_balance, uni_balance, okb_balance, gt_balance, bgb_balance, cake_balance, jup_balance, ron_balance, xrp_balance, trx_balance, doge_balance, ada_balance, link_balance, xlm_balance, bch_balance, gram_balance, avax_balance, sui_balance, xaut_balance, ondo_balance, near_balance, usdy_balance, paxg_balance, wlfi_balance, aster_balance, rlusd_balance, aave_balance, dot_balance, pump_balance",
      )
      .eq("id", data.wallet_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (walErr) throw new Error(walErr.message);
    if (!wallet) throw new Error("Wallet not found");

    const priceIds: LedgerMajorId[] = [major];
    if (payAsset === "SOL") priceIds.push("sol");
    const prices = await fetchMajorUsdPrices(priceIds);
    const price = prices[major];
    if (!(price > 0)) throw new Error(`Could not price ${def.symbol}`);

    let payPriceUsd = 1;
    if (!isStablePay(payAsset)) {
      payPriceUsd = Number(prices.sol) || 0;
      if (!(payPriceUsd > 0)) throw new Error("Could not price SOL");
    }

    const payDebit = isStablePay(payAsset)
      ? grossUsd
      : round12(grossUsd / payPriceUsd);
    const feeDebit = isStablePay(payAsset) ? feeUsd : round12(feeUsd / payPriceUsd);

    const payBal = readPayBalance(wallet as unknown as Record<string, unknown>, payAsset);
    if (payBal + 1e-12 < payDebit) {
      throw new Error(
        `Need ${payDebit} ${payAsset} (≈ $${grossUsd}) — top up first (have ${round12(payBal)})`,
      );
    }

    const tokenAmt = round12(netUsd / price);
    if (tokenAmt <= 0) throw new Error("Amount too small");

    const curMajor = readMajorBalance(wallet as unknown as Record<string, unknown>, major);
    const nextPay = isStablePay(payAsset)
      ? round8(payBal - payDebit)
      : round12(payBal - payDebit);
    const nextMajor = round12(curMajor + tokenAmt);
    const patch = payPatch(payAsset, nextPay, majorBalancePatch(major, nextMajor));

    const { error: updErr } = await supabase
      .from("wallets")
      .update(patch)
      .eq("id", data.wallet_id)
      .eq("user_id", userId);
    if (updErr) throw new Error(updErr.message);

    const payLabel = isStablePay(payAsset)
      ? `${netUsd} ${payAsset}`
      : `${payDebit} ${payAsset} (≈ $${grossUsd})`;
    const feeLabel = isStablePay(payAsset)
      ? `${feeUsd} ${payAsset}`
      : `${feeDebit} ${payAsset}`;

    const txRef = `buy_${major}_${globalThis.crypto?.randomUUID?.()?.replace(/-/g, "").slice(0, 16) ?? Date.now()}`;
    const { data: buyTx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        wallet_id: data.wallet_id,
        type: "buy",
        status: "confirmed",
        token_symbol: def.symbol,
        counterparty: "OpenPay Buy",
        amount: tokenAmt,
        usd_value: netUsd,
        memo: `Bought ${tokenAmt} ${def.symbol} for ${payLabel} @ $${price} (fee ${feeLabel} · ${feeBps / 100}%)`,
        tx_hash: txRef,
      })
      .select("id, type, token_symbol, amount, memo, counterparty, status, created_at, wallet_id")
      .single();
    if (txErr) throw new Error(txErr.message);

    try {
      const { notifyWalletTransaction } = await import("./tx-alerts.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await notifyWalletTransaction(supabaseAdmin as never, data.wallet_id, buyTx ?? {
        type: "buy",
        token_symbol: def.symbol,
        amount: tokenAmt,
        wallet_id: data.wallet_id,
        status: "confirmed",
      });
    } catch (e) {
      console.warn("[buy-major] alert failed", e);
    }

    if (feeDebit > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await creditPlatformFeePayAsset(supabaseAdmin, {
          amount: feeDebit,
          usdValue: feeUsd,
          asset: payAsset,
          sourceWalletId: data.wallet_id,
          counterparty: `buy_major:${major}`,
          memo: `Major buy fee · ${def.symbol} · ${feeLabel} → fee wallet`,
        });
      } catch (e) {
        console.error("[buy-major] fee treasury credit failed", (e as Error).message);
      }
    }

    return {
      ok: true as const,
      major_id: major,
      symbol: def.symbol,
      token_amount: tokenAmt,
      usd_spent: grossUsd,
      net_spent: netUsd,
      pay_spent: payDebit,
      fee_ousd: feeUsd,
      fee_bps: feeBps,
      pay_asset: payAsset,
      pay_price_usd: payPriceUsd,
      price_usd: price,
      balance: nextMajor,
    };
  });
