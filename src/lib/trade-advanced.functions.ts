/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PERP_MARKETS } from "@/lib/perp";
import { mapSpotOrder, type SpotOrder } from "@/lib/spot-orders";
import { fetchPerpLiveQuote } from "@/lib/tradingview-perps";
import { evaluateTriggerOrder, mapTriggerRow } from "@/lib/trade-advanced.server";

const TriggerSchema = z.object({
  market: z.enum(PERP_MARKETS),
  side: z.enum(["buy", "sell"]),
  order_type: z.enum(["stop_limit", "stop_market", "trailing_stop"]),
  amount: z.number().positive().max(1e12),
  pay_asset: z.enum(["USDT", "OUSD", "USDC"]),
  trigger_price: z.number().positive().max(1e12).optional(),
  trigger_direction: z.enum(["above", "below"]).optional(),
  price: z.number().positive().max(1e12).optional(),
  trail_percent: z.number().positive().max(50).optional(),
  trail_ref: z.number().positive().max(1e12).optional(),
  post_only: z.boolean().optional(),
  reduce_only: z.boolean().optional(),
  time_in_force: z.enum(["gtc", "ioc", "fok"]).optional(),
  oco_group: z.string().uuid().optional(),
});

export const placeTriggerOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TriggerSchema.parse(d))
  .handler(async ({ context, data }): Promise<SpotOrder> => {
    const { data: row, error } = await (context.supabase as any).rpc(
      "spot_place_trigger_order",
      {
        _market: data.market,
        _side: data.side,
        _order_type: data.order_type,
        _amount: data.amount,
        _pay_asset: data.pay_asset,
        _trigger_price: data.trigger_price ?? null,
        _trigger_direction: data.trigger_direction ?? null,
        _price: data.price ?? null,
        _trail_percent: data.trail_percent ?? null,
        _trail_ref: data.trail_ref ?? null,
        _post_only: data.post_only ?? false,
        _reduce_only: data.reduce_only ?? false,
        _time_in_force: data.time_in_force ?? "gtc",
        _oco_group: data.oco_group ?? null,
      },
    );
    if (error) throw new Error(error.message);
    return mapSpotOrder(row);
  });

/** Place both legs of an OCO (take-profit limit + protective stop). */
export const placeOcoOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        market: z.enum(PERP_MARKETS),
        side: z.enum(["buy", "sell"]),
        amount: z.number().positive().max(1e12),
        pay_asset: z.enum(["USDT", "OUSD", "USDC"]),
        limit_price: z.number().positive().max(1e12),
        stop_price: z.number().positive().max(1e12),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<SpotOrder[]> => {
    const group = crypto.randomUUID();
    const out: SpotOrder[] = [];

    const { data: limitRow, error: limitErr } = await (context.supabase as any).rpc(
      "spot_place_limit_order",
      {
        _market: data.market,
        _side: data.side,
        _price: data.limit_price,
        _amount: data.amount,
        _pay_asset: data.pay_asset,
        _client_order_id: `oco:${group}`,
      },
    );
    if (limitErr) throw new Error(limitErr.message);
    await (context.supabase as any)
      .from("spot_orders")
      .update({ oco_group: group })
      .eq("id", limitRow.id);
    out.push(mapSpotOrder({ ...limitRow, oco_group: group }));

    const { data: stopRow, error: stopErr } = await (context.supabase as any).rpc(
      "spot_place_trigger_order",
      {
        _market: data.market,
        _side: data.side,
        _order_type: "stop_market",
        _amount: data.amount,
        _pay_asset: data.pay_asset,
        _trigger_price: data.stop_price,
        _trigger_direction: data.side === "buy" ? "above" : "below",
        _price: null,
        _trail_percent: null,
        _trail_ref: null,
        _post_only: false,
        _reduce_only: false,
        _time_in_force: "gtc",
        _oco_group: group,
      },
    );
    if (stopErr) throw new Error(stopErr.message);
    out.push(mapSpotOrder(stopRow));

    return out;
  });

/** Walk resting trigger orders: ratchet trailing stops, arm/fire the rest. */
export const processTriggerOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ market: z.enum(PERP_MARKETS) }).parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ filled: number; armed: number }> => {
    const { data: rows, error } = await (context.supabase as any)
      .from("spot_orders")
      .select("*")
      .eq("user_id", context.userId)
      .eq("market", data.market)
      .in("order_type", ["stop_limit", "stop_market", "trailing_stop"])
      .in("status", ["open", "partial"])
      .limit(25);
    if (error || !rows?.length) return { filled: 0, armed: 0 };

    const quote = await fetchPerpLiveQuote(data.market);
    const mark = quote.markPrice || quote.price;
    if (!(mark > 0)) return { filled: 0, armed: 0 };

    let filled = 0;
    let armed = 0;
    for (const raw of rows) {
      try {
        const outcome = await evaluateTriggerOrder(
          context.supabase,
          mapTriggerRow(raw),
          mark,
        );
        if (outcome === "filled") filled += 1;
        if (outcome === "armed") armed += 1;
      } catch {
        /* leave resting — venue or balance error */
      }
    }
    return { filled, armed };
  });

export const cancelAllSpotOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ market: z.enum(PERP_MARKETS).optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ cancelled: number }> => {
    let q = (context.supabase as any)
      .from("spot_orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .in("status", ["open", "partial"]);
    if (data.market) q = q.eq("market", data.market);
    const { data: rows, error } = await q.select("id");
    if (error) throw new Error(error.message);
    return { cancelled: rows?.length ?? 0 };
  });

export const setPositionTpSl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        take_profit: z.number().positive().max(1e12).nullable().optional(),
        stop_loss: z.number().positive().max(1e12).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await (context.supabase as any).rpc("perp_set_tpsl", {
      _position_id: data.id,
      _take_profit: data.take_profit ?? null,
      _stop_loss: data.stop_loss ?? null,
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const addPositionMargin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), amount: z.number().positive().max(1e12) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await (context.supabase as any).rpc("perp_add_margin", {
      _position_id: data.id,
      _amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return row;
  });
