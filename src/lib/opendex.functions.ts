import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  OPENDEX_SWAP_FEE_BPS,
  applyOpenDexFee,
  opendexFeePct,
} from "@/lib/opendex-fee";
import {
  BTC_SWAP_ID,
  ETH_SWAP_ID,
  OUSD_SWAP_ID,
  PI_SWAP_ID,
  SOL_SWAP_ID,
  USDC_SWAP_ID,
  USDT_SWAP_ID,
  PYUSD_SWAP_ID,
  USDG_SWAP_ID,
  USD1_SWAP_ID,
  CASH_SWAP_ID,
  EURC_SWAP_ID,
  HYPE_SWAP_ID,
  ZEC_SWAP_ID,
  TSLAX_SWAP_ID,
  NFLXX_SWAP_ID,
  GOOGLX_SWAP_ID,
  LEDGER_MAJOR_SWAP_IDS,
  fetchMajorUsdPrices,
  isLedgerSwapId,
  majorBalancePatch,
  majorIdFromSwapId,
  readMajorBalance,
  walletMajorSelect,
  type LedgerMajorId,
} from "@/lib/ledger-majors";
import { MAJOR_TOKENS } from "@/lib/major-tokens";
import { mergeTrustWalletMajorPrices } from "@/lib/trustwallet.server";

export {
  OUSD_SWAP_ID,
  PI_SWAP_ID,
  BTC_SWAP_ID,
  ETH_SWAP_ID,
  SOL_SWAP_ID,
  USDC_SWAP_ID,
  USDT_SWAP_ID,
  PYUSD_SWAP_ID,
  USDG_SWAP_ID,
  USD1_SWAP_ID,
  CASH_SWAP_ID,
  EURC_SWAP_ID,
  HYPE_SWAP_ID,
  ZEC_SWAP_ID,
  TSLAX_SWAP_ID,
  NFLXX_SWAP_ID,
  GOOGLX_SWAP_ID,
} from "@/lib/ledger-majors";
export { OPENDEX_SWAP_FEE_BPS, applyOpenDexFee, opendexFeePct } from "@/lib/opendex-fee";

const SwapSchema = z.object({
  wallet_id: z.string().uuid(),
  from_id: z.string().min(1),
  to_id: z.string().min(1),
  amount: z.number().positive().max(1e15),
  slippage: z.number().min(0).max(50).default(0.5),
  expected_out: z.number().positive().optional(),
});

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

function round12(n: number) {
  return Math.round(n * 1e12) / 1e12;
}

type QuoteToken = {
  id: string;
  symbol: string;
  name: string;
  price_usd: number;
  major?: LedgerMajorId;
};

const WALLET_COLS = walletMajorSelect("id, user_id, ousd_balance");

export const executeOpenDexSwap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SwapSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { wallet_id, from_id, to_id, amount, slippage, expected_out } = data;

    if (from_id === to_id) throw new Error("Select two different tokens");

    const { data: wallet, error: walErr } = await supabase
      .from("wallets")
      .select(WALLET_COLS)
      .eq("id", wallet_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (walErr) throw new Error(walErr.message);
    if (!wallet) throw new Error("Wallet not found");

    const fromIsOusd = from_id === OUSD_SWAP_ID;
    const toIsOusd = to_id === OUSD_SWAP_ID;
    const fromMajor = majorIdFromSwapId(from_id);
    const toMajor = majorIdFromSwapId(to_id);

    const dbTokenIds = [from_id, to_id].filter((id) => !isLedgerSwapId(id));
    const byId = new Map<string, QuoteToken>();
    if (dbTokenIds.length) {
      const { data: tokenRows, error: tokErr } = await supabase
        .from("tokens")
        .select("id, name, symbol, price_usd, logo_url, status")
        .in("id", dbTokenIds);
      if (tokErr) throw new Error(tokErr.message);
      for (const t of tokenRows ?? []) {
        byId.set(t.id, {
          id: t.id,
          symbol: t.symbol,
          name: t.name,
          price_usd: Number(t.price_usd ?? 0),
        });
      }
    }

    const needMajors = [fromMajor, toMajor].filter(Boolean) as LedgerMajorId[];
    const prices =
      needMajors.length > 0
        ? await mergeTrustWalletMajorPrices(
            await fetchMajorUsdPrices(needMajors),
            needMajors,
          )
        : ({} as Record<LedgerMajorId, number>);

    const resolve = (id: string): QuoteToken | undefined => {
      if (id === OUSD_SWAP_ID) {
        return { id: OUSD_SWAP_ID, symbol: "OUSD", name: "OpenPay USD", price_usd: 1 };
      }
      const major = majorIdFromSwapId(id);
      if (major) {
        const def = MAJOR_TOKENS[major];
        return {
          id,
          symbol: def.symbol,
          name: def.name,
          price_usd: prices[major] ?? 0,
          major,
        };
      }
      return byId.get(id);
    };

    // Normalize major ids to canonical swap ids for balance ops
    const fromCanon = fromMajor ? LEDGER_MAJOR_SWAP_IDS[fromMajor] : from_id;
    const toCanon = toMajor ? LEDGER_MAJOR_SWAP_IDS[toMajor] : to_id;

    const fromToken = resolve(fromCanon);
    const toToken = resolve(toCanon);
    if (!fromToken || !toToken) throw new Error("Token not found");

    // OpenDEX: any priced pair (OUSD, majors, OpenTokens)
    const fromPrice = Number(fromToken.price_usd) || 0;
    const toPrice = Number(toToken.price_usd) || 0;
    if (fromPrice <= 0 || toPrice <= 0) throw new Error("Invalid token price");

    const amtIn = fromMajor ? round12(amount) : round8(amount);
    const rawOut = (amtIn * fromPrice) / toPrice;
    const amountOutRounded = toMajor ? round12(rawOut) : round8(rawOut);
    if (amountOutRounded <= 0) throw new Error("Swap amount too small");

    const { fee: feeOutRaw, net: amountOut } = applyOpenDexFee(amountOutRounded);
    const feeOut = toMajor ? round12(feeOutRaw) : round8(feeOutRaw);
    const netOut = toMajor ? round12(amountOut) : round8(amountOut);
    if (netOut <= 0) throw new Error("Swap amount too small after fee");

    if (expected_out != null && expected_out > 0) {
      const minAcceptable = expected_out * (1 - slippage / 100);
      if (netOut + 1e-12 < minAcceptable) {
        throw new Error("Price moved beyond slippage tolerance");
      }
    }

    const readBal = (major: LedgerMajorId | null, isOusd: boolean) => {
      if (isOusd) return Number((wallet as { ousd_balance?: number }).ousd_balance ?? 0);
      if (major) return readMajorBalance(wallet as unknown as Record<string, unknown>, major);
      return null;
    };

    let fromBal = readBal(fromMajor, fromIsOusd);
    if (fromBal == null) {
      const { data: hold } = await supabase
        .from("token_holdings")
        .select("id, balance")
        .eq("wallet_id", wallet_id)
        .eq("token_id", from_id)
        .maybeSingle();
      fromBal = Number(hold?.balance ?? 0);
    }

    if (fromBal + 1e-12 < amtIn) {
      throw new Error(`Insufficient ${fromToken.symbol} balance`);
    }

    // Debit from
    if (fromIsOusd) {
      const { error } = await supabase
        .from("wallets")
        .update({ ousd_balance: round8(fromBal - amtIn) })
        .eq("id", wallet_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else if (fromMajor) {
      const next = round12(fromBal - amtIn);
      const patch = majorBalancePatch(fromMajor, next);
      const { error } = await supabase
        .from("wallets")
        .update(patch as never)
        .eq("id", wallet_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { data: hold } = await supabase
        .from("token_holdings")
        .select("id, balance")
        .eq("wallet_id", wallet_id)
        .eq("token_id", from_id)
        .maybeSingle();
      if (!hold) throw new Error(`No ${fromToken.symbol} holding`);
      const next = round8(Number(hold.balance) - amtIn);
      if (next < -1e-12) throw new Error(`Insufficient ${fromToken.symbol} balance`);
      const { error } = await supabase
        .from("token_holdings")
        .update({ balance: Math.max(0, next), updated_at: new Date().toISOString() })
        .eq("id", hold.id);
      if (error) throw new Error(error.message);
    }

    // Credit to
    if (toIsOusd) {
      const { data: fresh } = await supabase
        .from("wallets")
        .select("ousd_balance")
        .eq("id", wallet_id)
        .maybeSingle();
      const cur = Number(fresh?.ousd_balance ?? 0);
      const { error } = await supabase
        .from("wallets")
        .update({ ousd_balance: round8(cur + netOut) })
        .eq("id", wallet_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else if (toMajor) {
      const { data: fresh } = await supabase
        .from("wallets")
        .select(
          WALLET_COLS,
        )
        .eq("id", wallet_id)
        .maybeSingle();
      const cur = readMajorBalance(fresh as unknown as Record<string, unknown> | null, toMajor);
      const next = round12(cur + netOut);
      const patch = majorBalancePatch(toMajor, next);
      const { error } = await supabase
        .from("wallets")
        .update(patch as never)
        .eq("id", wallet_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { data: hold } = await supabase
        .from("token_holdings")
        .select("id, balance")
        .eq("wallet_id", wallet_id)
        .eq("token_id", to_id)
        .maybeSingle();
      if (hold) {
        const { error } = await supabase
          .from("token_holdings")
          .update({
            balance: round8(Number(hold.balance) + netOut),
            updated_at: new Date().toISOString(),
          })
          .eq("id", hold.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("token_holdings").insert({
          wallet_id,
          token_id: to_id,
          balance: netOut,
          updated_at: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
      }
    }

    const usdValue = round8(amtIn * fromPrice);
    const feeUsd = round8(feeOut * toPrice);
    const nonOusdId = fromIsOusd ? toCanon : fromCanon;
    const txRef = `odx_${globalThis.crypto?.randomUUID?.()?.replace(/-/g, "") ?? `${Date.now()}${Math.random().toString(16).slice(2)}`}`;

    const { data: swapTx, error: txErr } = await supabase
      .from("transactions")
      .insert({
      wallet_id,
      type: "swap",
      status: "confirmed",
      token_id: isLedgerSwapId(nonOusdId) ? null : nonOusdId,
      token_symbol: `${fromToken.symbol}→${toToken.symbol}`,
      counterparty: "OpenDEX",
      amount: amtIn,
      usd_value: usdValue,
      memo: `OpenDEX swap ${amtIn} ${fromToken.symbol} → ${netOut} ${toToken.symbol} · fee ${feeOut} ${toToken.symbol} (${opendexFeePct()}%)`,
      tx_hash: txRef,
    })
      .select("id, type, token_symbol, amount, memo, counterparty, status, created_at, wallet_id")
      .single();
    if (txErr) throw new Error(txErr.message);

    try {
      const { notifyWalletTransaction } = await import("./tx-alerts.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await notifyWalletTransaction(supabaseAdmin as never, wallet_id, swapTx ?? {
        type: "swap",
        token_symbol: `${fromToken.symbol}→${toToken.symbol}`,
        amount: amtIn,
        wallet_id,
        status: "confirmed",
      });
    } catch (e) {
      console.warn("[opendex] alert failed", e);
    }

    if (feeOut > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { creditPlatformFeeOusd, creditPlatformFeeToken } = await import(
          "@/lib/platform-treasury"
        );
        if (toIsOusd || toMajor) {
          await creditPlatformFeeOusd(supabaseAdmin, {
            amount: feeUsd,
            sourceWalletId: wallet_id,
            counterparty: `opendex:${txRef}`,
            memo: `OpenDEX swap fee · ${feeOut} ${toToken.symbol} (~${feeUsd} OUSD) → @openpay`,
          });
        } else {
          await creditPlatformFeeToken(supabaseAdmin, {
            amount: feeOut,
            tokenId: to_id,
            tokenSymbol: toToken.symbol,
            usdValue: feeUsd,
            sourceWalletId: wallet_id,
            memo: `OpenDEX swap fee · ${feeOut} ${toToken.symbol} → @openpay`,
          });
        }
      } catch (e) {
        console.error("[opendex] fee treasury credit failed", (e as Error).message);
      }
    }

    return {
      ok: true as const,
      amount_in: amtIn,
      amount_out: netOut,
      fee_out: feeOut,
      fee_bps: OPENDEX_SWAP_FEE_BPS,
      fee_usd: feeUsd,
      from_symbol: fromToken.symbol,
      to_symbol: toToken.symbol,
      usd_value: usdValue,
      tx_ref: txRef,
    };
  });
