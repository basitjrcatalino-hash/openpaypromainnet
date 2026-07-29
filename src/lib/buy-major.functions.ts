import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fetchMajorUsdPrices,
  majorBalancePatch,
  readMajorBalance,
  type LedgerMajorId,
} from "@/lib/ledger-majors";
import { MAJOR_TOKENS, isMajorTokenId } from "@/lib/major-tokens";
import {
  applyPlatformTradeFee,
  creditPlatformFeeOusd,
  PLATFORM_TRADE_FEE_BPS,
} from "@/lib/platform-treasury";

const BuyMajorSchema = z.object({
  wallet_id: z.string().uuid(),
  major_id: z.string().refine(isMajorTokenId, "Invalid major"),
  /** USD / OUSD to spend (gross — includes platform fee) */
  usd_amount: z.number().positive().min(0.01).max(50_000),
});

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}
function round12(n: number) {
  return Math.round(n * 1e12) / 1e12;
}

/**
 * Spend OUSD from the Pro wallet and credit a major ledger balance at live CoinGecko price.
 * Deducts PLATFORM_TRADE_FEE_BPS from spend and credits the configured fee wallet (@openpay).
 */
export const buyMajorWithOusd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BuyMajorSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const major = data.major_id as LedgerMajorId;
    const gross = round8(data.usd_amount);
    const def = MAJOR_TOKENS[major];
    const { fee, net, feeBps } = applyPlatformTradeFee(gross, PLATFORM_TRADE_FEE_BPS);
    if (!(net > 0)) throw new Error("Amount too small after fee");

    const { data: wallet, error: walErr } = await supabase
      .from("wallets")
      .select(
        "id, ousd_balance, pi_balance, btc_balance, eth_balance, sol_balance, usdc_balance, usdt_balance, pyusd_balance, usdg_balance, usd1_balance, cash_balance, eurc_balance",
      )
      .eq("id", data.wallet_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (walErr) throw new Error(walErr.message);
    if (!wallet) throw new Error("Wallet not found");

    const ousd = Number(wallet.ousd_balance ?? 0);
    if (ousd + 1e-12 < gross) {
      throw new Error(`Need ${gross} OUSD — top up first (have ${round8(ousd)})`);
    }

    const prices = await fetchMajorUsdPrices([major]);
    const price = prices[major];
    if (!(price > 0)) throw new Error(`Could not price ${def.symbol}`);

    const tokenAmt = round12(net / price);
    if (tokenAmt <= 0) throw new Error("Amount too small");

    const curMajor = readMajorBalance(wallet as unknown as Record<string, unknown>, major);
    const patch = {
      ousd_balance: round8(ousd - gross),
      ...majorBalancePatch(major, round12(curMajor + tokenAmt)),
    };

    const { error: updErr } = await supabase
      .from("wallets")
      .update(patch)
      .eq("id", data.wallet_id)
      .eq("user_id", userId);
    if (updErr) throw new Error(updErr.message);

    const txRef = `buy_${major}_${globalThis.crypto?.randomUUID?.()?.replace(/-/g, "").slice(0, 16) ?? Date.now()}`;
    const { error: txErr } = await supabase.from("transactions").insert({
      wallet_id: data.wallet_id,
      type: "buy",
      status: "confirmed",
      token_symbol: def.symbol,
      counterparty: "OpenPay Buy",
      amount: tokenAmt,
      usd_value: net,
      memo: `Bought ${tokenAmt} ${def.symbol} for ${net} OUSD @ $${price} (fee ${fee} OUSD · ${feeBps / 100}%)`,
      tx_hash: txRef,
    });
    if (txErr) throw new Error(txErr.message);

    if (fee > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await creditPlatformFeeOusd(supabaseAdmin, {
          amount: fee,
          sourceWalletId: data.wallet_id,
          counterparty: `buy_major:${major}`,
          memo: `Major buy fee · ${def.symbol} · ${fee} OUSD → fee wallet`,
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
      usd_spent: gross,
      net_spent: net,
      fee_ousd: fee,
      fee_bps: feeBps,
      price_usd: price,
      balance: round12(curMajor + tokenAmt),
    };
  });
