import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  OPENDEX_SWAP_FEE_BPS,
  applyOpenDexFee,
  opendexFeePct,
} from "@/lib/opendex-fee";

export const OUSD_SWAP_ID = "__ousd__";
export { OPENDEX_SWAP_FEE_BPS, applyOpenDexFee, opendexFeePct } from "@/lib/opendex-fee";

const SwapSchema = z.object({
  wallet_id: z.string().uuid(),
  from_id: z.string().min(1),
  to_id: z.string().min(1),
  amount: z.number().positive().max(1e15),
  slippage: z.number().min(0).max(50).default(0.5),
  /** Client-quoted net output (after fee) for slippage check. */
  expected_out: z.number().positive().optional(),
});

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

export const executeOpenDexSwap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SwapSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { wallet_id, from_id, to_id, amount, slippage, expected_out } = data;

    if (from_id === to_id) throw new Error("Select two different tokens");

    const { data: wallet, error: walErr } = await supabase
      .from("wallets")
      .select("id, user_id, ousd_balance")
      .eq("id", wallet_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (walErr) throw new Error(walErr.message);
    if (!wallet) throw new Error("Wallet not found");

    const fromIsOusd = from_id === OUSD_SWAP_ID;
    const toIsOusd = to_id === OUSD_SWAP_ID;
    if (!fromIsOusd && !toIsOusd) {
      throw new Error("OpenDEX pairs must include OUSD");
    }

    const tokenIds = [from_id, to_id].filter((id) => id !== OUSD_SWAP_ID);
    const { data: tokenRows, error: tokErr } = await supabase
      .from("tokens")
      .select("id, name, symbol, price_usd, logo_url, status")
      .in("id", tokenIds);
    if (tokErr) throw new Error(tokErr.message);

    const byId = new Map((tokenRows ?? []).map((t) => [t.id, t]));
    const fromToken = fromIsOusd
      ? { id: OUSD_SWAP_ID, symbol: "OUSD", name: "OpenPay USD", price_usd: 1 }
      : byId.get(from_id);
    const toToken = toIsOusd
      ? { id: OUSD_SWAP_ID, symbol: "OUSD", name: "OpenPay USD", price_usd: 1 }
      : byId.get(to_id);

    if (!fromToken || !toToken) throw new Error("Token not found");

    const fromPrice = Number(fromToken.price_usd) || 0;
    const toPrice = Number(toToken.price_usd) || 0;
    if (fromPrice <= 0 || toPrice <= 0) throw new Error("Invalid token price");

    const amtIn = round8(amount);
    const rawOut = round8((amtIn * fromPrice) / toPrice);
    if (rawOut <= 0) throw new Error("Swap amount too small");

    const { fee: feeOut, net: amountOut } = applyOpenDexFee(rawOut);
    if (amountOut <= 0) throw new Error("Swap amount too small after fee");

    if (expected_out != null && expected_out > 0) {
      const minAcceptable = expected_out * (1 - slippage / 100);
      if (amountOut + 1e-12 < minAcceptable) {
        throw new Error("Price moved beyond slippage tolerance");
      }
    }

    // ── balances ──────────────────────────────────────────────
    let fromBal = 0;
    if (fromIsOusd) {
      fromBal = Number(wallet.ousd_balance ?? 0);
    } else {
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

    // Credit to (net of OpenDEX fee)
    if (toIsOusd) {
      const { data: fresh } = await supabase
        .from("wallets")
        .select("ousd_balance")
        .eq("id", wallet_id)
        .maybeSingle();
      const cur = Number(fresh?.ousd_balance ?? 0);
      const { error } = await supabase
        .from("wallets")
        .update({ ousd_balance: round8(cur + amountOut) })
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
            balance: round8(Number(hold.balance) + amountOut),
            updated_at: new Date().toISOString(),
          })
          .eq("id", hold.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("token_holdings").insert({
          wallet_id,
          token_id: to_id,
          balance: amountOut,
          updated_at: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
      }
    }

    const usdValue = round8(amtIn * fromPrice);
    const feeUsd = round8(feeOut * toPrice);
    const nonOusdId = fromIsOusd ? to_id : from_id;
    const txRef = `odx_${globalThis.crypto?.randomUUID?.()?.replace(/-/g, "") ?? `${Date.now()}${Math.random().toString(16).slice(2)}`}`;

    const { error: txErr } = await supabase.from("transactions").insert({
      wallet_id,
      type: "swap",
      status: "confirmed",
      token_id: nonOusdId === OUSD_SWAP_ID ? null : nonOusdId,
      token_symbol: `${fromToken.symbol}→${toToken.symbol}`,
      counterparty: "OpenDEX",
      amount: amtIn,
      usd_value: usdValue,
      memo: `OpenDEX swap ${amtIn} ${fromToken.symbol} → ${amountOut} ${toToken.symbol} · fee ${feeOut} ${toToken.symbol} (${opendexFeePct()}%)`,
      tx_hash: txRef,
    });
    if (txErr) throw new Error(txErr.message);

    return {
      ok: true as const,
      amount_in: amtIn,
      amount_out: amountOut,
      fee_out: feeOut,
      fee_bps: OPENDEX_SWAP_FEE_BPS,
      fee_usd: feeUsd,
      from_symbol: fromToken.symbol,
      to_symbol: toToken.symbol,
      usd_value: usdValue,
      tx_ref: txRef,
    };
  });
