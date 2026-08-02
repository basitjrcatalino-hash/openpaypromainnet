/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buyMajorWithOusd } from "@/lib/buy-major.functions";
import {
  BTC_SWAP_ID,
  ETH_SWAP_ID,
  executeOpenDexSwap,
  OUSD_SWAP_ID,
  PI_SWAP_ID,
  SOL_SWAP_ID,
  USDC_SWAP_ID,
  USDT_SWAP_ID,
} from "@/lib/opendex.functions";
import { PERP_MARKETS, marketToMajorId, type PerpMarket } from "@/lib/perp";
import { PLATFORM_TRADE_FEE_BPS } from "@/lib/platform-treasury";
import { fetchPerpLiveQuote } from "@/lib/tradingview-perps";
import {
  limitIsMarketable,
  mapSpotFill,
  mapSpotOrder,
  type SpotFill,
  type SpotOrder,
  type SpotPayAsset,
} from "@/lib/spot-orders";

const MAJOR_SWAP: Record<PerpMarket, string> = {
  BTC: BTC_SWAP_ID,
  ETH: ETH_SWAP_ID,
  SOL: SOL_SWAP_ID,
  PI: PI_SWAP_ID,
};

const PAY_SWAP: Record<SpotPayAsset, string> = {
  USDT: USDT_SWAP_ID,
  OUSD: OUSD_SWAP_ID,
  USDC: USDC_SWAP_ID,
};

const PlaceSchema = z.object({
  market: z.enum(PERP_MARKETS),
  side: z.enum(["buy", "sell"]),
  price: z.number().positive().max(1e12),
  amount: z.number().positive().max(1e12),
  pay_asset: z.enum(["USDT", "OUSD", "USDC"]),
  client_order_id: z.string().max(64).optional(),
});

const IdSchema = z.object({ id: z.string().uuid() });

async function markUsd(market: PerpMarket): Promise<number> {
  const q = await fetchPerpLiveQuote(market);
  const px = q.markPrice || q.price;
  if (!(px > 0)) throw new Error(`No mark for ${market}`);
  return px;
}

function missingTable(msg: string) {
  return /spot_orders|spot_fills|schema cache|does not exist|spot_place|spot_cancel|spot_complete/i.test(
    msg,
  );
}

export const listSpotOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        market: z.enum(PERP_MARKETS).optional(),
        status: z.enum(["open", "history", "all"]).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<SpotOrder[]> => {
    let q = (context.supabase as any)
      .from("spot_orders")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(80);

    if (data.market) q = q.eq("market", data.market);
    if (data.status === "open") q = q.in("status", ["open", "partial"]);
    if (data.status === "history") q = q.in("status", ["filled", "cancelled"]);

    const { data: rows, error } = await q;
    if (error) {
      if (missingTable(error.message)) return [];
      throw new Error(error.message);
    }
    return (rows ?? []).map((r: any) => mapSpotOrder(r));
  });

export const listSpotFills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ market: z.enum(PERP_MARKETS).optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<SpotFill[]> => {
    let q = (context.supabase as any)
      .from("spot_fills")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (data.market) q = q.eq("market", data.market);
    const { data: rows, error } = await q;
    if (error) {
      if (missingTable(error.message)) return [];
      throw new Error(error.message);
    }
    return (rows ?? []).map((r: any) => mapSpotFill(r));
  });

export const placeSpotLimitOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PlaceSchema.parse(d))
  .handler(async ({ context, data }): Promise<SpotOrder> => {
    const { data: row, error } = await (context.supabase as any).rpc("spot_place_limit_order", {
      _market: data.market,
      _side: data.side,
      _price: data.price,
      _amount: data.amount,
      _pay_asset: data.pay_asset,
      _client_order_id: data.client_order_id ?? null,
    });

    if (error) {
      // Fallback to direct insert if RPC migration not applied yet
      if (missingTable(error.message) || /spot_place_limit_order/i.test(error.message)) {
        const { data: wallet } = await (context.supabase as any)
          .from("wallets")
          .select("id")
          .eq("user_id", context.userId)
          .order("is_active", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!wallet?.id) throw new Error("No wallet");
        const { data: inserted, error: insErr } = await (context.supabase as any)
          .from("spot_orders")
          .insert({
            user_id: context.userId,
            wallet_id: wallet.id,
            market: data.market,
            side: data.side,
            order_type: "limit",
            price: data.price,
            amount: data.amount,
            filled: 0,
            pay_asset: data.pay_asset,
            status: "open",
          })
          .select("*")
          .single();
        if (insErr) {
          if (missingTable(insErr.message)) {
            throw new Error("Spot orders unavailable — apply trading SQL migrations");
          }
          throw new Error(insErr.message);
        }
        return mapSpotOrder(inserted);
      }
      throw new Error(error.message);
    }
    return mapSpotOrder(row);
  });

export const cancelSpotOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ context, data }): Promise<SpotOrder> => {
    const { data: row, error } = await (context.supabase as any).rpc("spot_cancel_order", {
      _order_id: data.id,
    });
    if (error) {
      if (/spot_cancel_order/i.test(error.message)) {
        const now = new Date().toISOString();
        const { data: updated, error: upErr } = await (context.supabase as any)
          .from("spot_orders")
          .update({ status: "cancelled", updated_at: now })
          .eq("id", data.id)
          .eq("user_id", context.userId)
          .in("status", ["open", "partial"])
          .select("*")
          .single();
        if (upErr) throw new Error(upErr.message);
        return mapSpotOrder(updated);
      }
      throw new Error(error.message);
    }
    return mapSpotOrder(row);
  });

async function settleAndCompleteFill(
  supabase: any,
  order: SpotOrder,
  mark: number,
): Promise<SpotOrder> {
  const fillPrice = order.price;
  const fillAmount = order.amount - order.filled;

  if (order.side === "buy") {
    const usd = Math.round(fillAmount * fillPrice * 1e8) / 1e8;
    await buyMajorWithOusd({
      data: {
        wallet_id: order.wallet_id,
        major_id: marketToMajorId(order.market),
        usd_amount: usd,
        pay_asset: order.pay_asset,
      },
    });
  } else {
    await executeOpenDexSwap({
      data: {
        wallet_id: order.wallet_id,
        from_id: MAJOR_SWAP[order.market],
        to_id: PAY_SWAP[order.pay_asset],
        amount: fillAmount,
        slippage: 1,
      },
    });
  }

  const feeUsd = Math.round(fillAmount * fillPrice * (PLATFORM_TRADE_FEE_BPS / 10_000) * 1e8) / 1e8;

  const { data: row, error } = await supabase.rpc("spot_complete_fill", {
    _order_id: order.id,
    _fill_price: fillPrice,
    _fill_amount: fillAmount,
    _fee_usd: feeUsd,
    _mark_price: mark,
    _tx_id: null,
  });

  if (error) {
    // Fallback when complete_fill RPC missing
    if (/spot_complete_fill/i.test(error.message) || missingTable(error.message)) {
      const now = new Date().toISOString();
      const { data: updated, error: upErr } = await supabase
        .from("spot_orders")
        .update({
          status: "filled",
          filled: order.amount,
          avg_fill_price: fillPrice,
          filled_at: now,
          updated_at: now,
        })
        .eq("id", order.id)
        .select("*")
        .single();
      if (upErr) throw new Error(upErr.message);
      return mapSpotOrder(updated);
    }
    throw new Error(error.message);
  }
  return mapSpotOrder(row);
}

/** Try to fill one open limit if mark is marketable. */
export const fillSpotLimitOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ context, data }): Promise<SpotOrder> => {
    const { data: row, error } = await (context.supabase as any)
      .from("spot_orders")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Order not found");
    const order = mapSpotOrder(row);
    if (order.status === "filled" || order.status === "cancelled") return order;

    const mark = await markUsd(order.market);
    if (!limitIsMarketable(order.side, order.price, mark)) return order;

    return settleAndCompleteFill(context.supabase, order, mark);
  });

/** Poll open orders and fill any that are marketable. */
export const processSpotOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ market: z.enum(PERP_MARKETS).optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ filled: number }> => {
    let q = (context.supabase as any)
      .from("spot_orders")
      .select("*")
      .eq("user_id", context.userId)
      .in("status", ["open", "partial"])
      .limit(20);
    if (data.market) q = q.eq("market", data.market);
    const { data: rows, error } = await q;
    if (error || !rows?.length) return { filled: 0 };

    let filled = 0;
    for (const raw of rows) {
      const order = mapSpotOrder(raw);
      try {
        const mark = await markUsd(order.market);
        if (!limitIsMarketable(order.side, order.price, mark)) continue;
        await settleAndCompleteFill(context.supabase, order, mark);
        filled += 1;
      } catch {
        /* leave open — balance or venue error */
      }
    }
    return { filled };
  });

export const listSpotTradeHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ market: z.enum(PERP_MARKETS).optional() }).parse(d ?? {}),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<
      {
        id: string;
        side: string;
        amount: number;
        price?: number | null;
        memo?: string | null;
        created_at: string;
        token_symbol?: string | null;
      }[]
    > => {
      // Prefer spot_fills when available
      let fq = (context.supabase as any)
        .from("spot_fills")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (data.market) fq = fq.eq("market", data.market);
      const { data: fills, error: fillErr } = await fq;
      if (!fillErr && fills?.length) {
        return fills.map((r: any) => {
          const f = mapSpotFill(r);
          return {
            id: f.id,
            side: f.side,
            amount: f.amount,
            price: f.price,
            memo: `${f.side} ${f.market}`,
            created_at: f.created_at,
            token_symbol: f.market,
          };
        });
      }

      const { data: wallet } = await (context.supabase as any)
        .from("wallets")
        .select("id")
        .eq("user_id", context.userId)
        .order("is_active", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!wallet?.id) return [];

      let q = (context.supabase as any)
        .from("transactions")
        .select("id, type, amount, usd_value, memo, created_at, token_symbol")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(40);

      if (data.market) {
        q = q.ilike("token_symbol", data.market);
      }

      const { data: rows, error } = await q;
      if (error) return [];
      return (rows ?? []).map((r: any) => ({
        id: String(r.id),
        side: String(r.type ?? ""),
        amount: Number(r.amount ?? 0),
        price:
          r.usd_value != null && Number(r.amount) > 0
            ? Number(r.usd_value) / Number(r.amount)
            : null,
        memo: r.memo ?? null,
        created_at: String(r.created_at),
        token_symbol: r.token_symbol ?? null,
      }));
    },
  );
