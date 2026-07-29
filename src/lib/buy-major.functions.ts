import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fetchMajorUsdPrices,
  type LedgerMajorId,
} from "@/lib/ledger-majors";
import { MAJOR_TOKENS } from "@/lib/major-tokens";

const BuyMajorSchema = z.object({
  wallet_id: z.string().uuid(),
  major_id: z.enum(["btc", "eth", "sol", "pi"]),
  /** USD / OUSD to spend */
  usd_amount: z.number().positive().min(0.01).max(50_000),
});

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}
function round12(n: number) {
  return Math.round(n * 1e12) / 1e12;
}

/**
 * Spend OUSD from the Pro wallet and credit BTC/ETH/SOL/PI at live CoinGecko price.
 */
export const buyMajorWithOusd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BuyMajorSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const major = data.major_id as LedgerMajorId;
    const usd = round8(data.usd_amount);
  const def = MAJOR_TOKENS[major];

  const { data: wallet, error: walErr } = await supabase
      .from("wallets")
      .select("id, ousd_balance, pi_balance, btc_balance, eth_balance, sol_balance")
      .eq("id", data.wallet_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (walErr) throw new Error(walErr.message);
    if (!wallet) throw new Error("Wallet not found");

    const ousd = Number(wallet.ousd_balance ?? 0);
    if (ousd + 1e-12 < usd) {
      throw new Error(`Need ${usd} OUSD — top up first (have ${round8(ousd)})`);
    }

    const prices = await fetchMajorUsdPrices([major]);
    const price = prices[major];
    if (!(price > 0)) throw new Error(`Could not price ${def.symbol}`);

    const tokenAmt = round12(usd / price);
    if (tokenAmt <= 0) throw new Error("Amount too small");

    const curMajor = Number(
      major === "btc"
        ? wallet.btc_balance
        : major === "eth"
          ? wallet.eth_balance
          : major === "sol"
            ? wallet.sol_balance
            : wallet.pi_balance,
    );

    const patch =
      major === "btc"
        ? { ousd_balance: round8(ousd - usd), btc_balance: round12(curMajor + tokenAmt) }
        : major === "eth"
          ? { ousd_balance: round8(ousd - usd), eth_balance: round12(curMajor + tokenAmt) }
          : major === "sol"
            ? { ousd_balance: round8(ousd - usd), sol_balance: round12(curMajor + tokenAmt) }
            : { ousd_balance: round8(ousd - usd), pi_balance: round12(curMajor + tokenAmt) };

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
      usd_value: usd,
      memo: `Bought ${tokenAmt} ${def.symbol} for ${usd} OUSD @ $${price}`,
      tx_hash: txRef,
    });
    if (txErr) throw new Error(txErr.message);

    return {
      ok: true as const,
      major_id: major,
      symbol: def.symbol,
      token_amount: tokenAmt,
      usd_spent: usd,
      price_usd: price,
      balance: round12(curMajor + tokenAmt),
    };
  });
