import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  OPENDEX_SWAP_FEE_BPS,
  applyOpenDexFee,
  opendexFeePct,
} from "@/lib/opendex-fee";

export const OUSD_SWAP_ID = "__ousd__";
export const PI_SWAP_ID = "__pi__";
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

type QuoteToken = {
  id: string;
  symbol: string;
  name: string;
  price_usd: number;
};

async function fetchPiUsdPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd",
      { headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const j = (await res.json()) as { "pi-network"?: { usd?: number } };
      const p = Number(j?.["pi-network"]?.usd);
      if (p > 0) return p;
    }
  } catch {
    /* fallback below */
  }
  return 0.079;
}

function isLedgerSwapId(id: string) {
  return id === OUSD_SWAP_ID || id === PI_SWAP_ID;
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
      .select("id, user_id, ousd_balance, pi_balance")
      .eq("id", wallet_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (walErr) throw new Error(walErr.message);
    if (!wallet) throw new Error("Wallet not found");

    const fromIsOusd = from_id === OUSD_SWAP_ID;
    const toIsOusd = to_id === OUSD_SWAP_ID;
    const fromIsPi = from_id === PI_SWAP_ID;
    const toIsPi = to_id === PI_SWAP_ID;

    if (!fromIsOusd && !toIsOusd) {
      throw new Error("OpenDEX pairs must include OUSD");
    }

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

    let piPrice = 0;
    if (fromIsPi || toIsPi) {
      piPrice = await fetchPiUsdPrice();
    }

    const resolve = (id: string, isOusd: boolean, isPi: boolean): QuoteToken | undefined => {
      if (isOusd) {
        return { id: OUSD_SWAP_ID, symbol: "OUSD", name: "OpenPay USD", price_usd: 1 };
      }
      if (isPi) {
        return {
          id: PI_SWAP_ID,
          symbol: "PI",
          name: "Pi Network",
          price_usd: piPrice,
        };
      }
      return byId.get(id);
    };

    const fromToken = resolve(from_id, fromIsOusd, fromIsPi);
    const toToken = resolve(to_id, toIsOusd, toIsPi);

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
    } else if (fromIsPi) {
      fromBal = Number(wallet.pi_balance ?? 0);
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
    } else if (fromIsPi) {
      const { error } = await supabase
        .from("wallets")
        .update({ pi_balance: round8(fromBal - amtIn) })
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
    } else if (toIsPi) {
      const { data: fresh } = await supabase
        .from("wallets")
        .select("pi_balance")
        .eq("id", wallet_id)
        .maybeSingle();
      const cur = Number(fresh?.pi_balance ?? 0);
      const { error } = await supabase
        .from("wallets")
        .update({ pi_balance: round8(cur + amountOut) })
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
      token_id: isLedgerSwapId(nonOusdId) ? null : nonOusdId,
      token_symbol: `${fromToken.symbol}→${toToken.symbol}`,
      counterparty: "OpenDEX",
      amount: amtIn,
      usd_value: usdValue,
      memo: `OpenDEX swap ${amtIn} ${fromToken.symbol} → ${amountOut} ${toToken.symbol} · fee ${feeOut} ${toToken.symbol} (${opendexFeePct()}%)`,
      tx_hash: txRef,
    });
    if (txErr) throw new Error(txErr.message);

    // Platform swap fee → @openpay treasury
    if (feeOut > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { creditPlatformFeeOusd, creditPlatformFeeToken } = await import(
          "@/lib/platform-treasury"
        );
        if (toIsOusd) {
          await creditPlatformFeeOusd(supabaseAdmin, {
            amount: feeOut,
            sourceWalletId: wallet_id,
            counterparty: `opendex:${txRef}`,
            memo: `OpenDEX swap fee · ${feeOut} OUSD → @openpay`,
          });
        } else if (toIsPi) {
          // PI fee collected as OUSD-equivalent credit to treasury
          await creditPlatformFeeOusd(supabaseAdmin, {
            amount: feeUsd,
            sourceWalletId: wallet_id,
            counterparty: `opendex:${txRef}`,
            memo: `OpenDEX swap fee · ${feeOut} PI (~${feeUsd} OUSD) → @openpay`,
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
