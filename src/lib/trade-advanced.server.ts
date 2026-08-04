/* eslint-disable @typescript-eslint/no-explicit-any */
import { executeSpotMarketTrade } from "@/lib/spot-orders.functions";
import { mapSpotOrder, type SpotOrder } from "@/lib/spot-orders";
import {
  defaultTriggerDirection,
  trailingStopPrice,
  triggerHit,
  type TriggerDirection,
} from "@/lib/trade-advanced";

export type TriggerRow = SpotOrder & {
  trigger_price: number | null;
  trigger_direction: TriggerDirection | null;
  trail_percent: number | null;
  trail_ref: number | null;
  oco_group: string | null;
};

export function mapTriggerRow(raw: Record<string, unknown>): TriggerRow {
  const base = mapSpotOrder(raw);
  return {
    ...base,
    trigger_price: raw.trigger_price == null ? null : Number(raw.trigger_price),
    trigger_direction:
      raw.trigger_direction == null ? null : (String(raw.trigger_direction) as TriggerDirection),
    trail_percent: raw.trail_percent == null ? null : Number(raw.trail_percent),
    trail_ref: raw.trail_ref == null ? null : Number(raw.trail_ref),
    oco_group: raw.oco_group == null ? null : String(raw.oco_group),
  };
}

/** Effective stop price for a resting trigger order at the current mark. */
export function effectiveStop(order: TriggerRow, mark: number): number {
  if (order.order_type !== "trailing_stop") return order.trigger_price ?? 0;
  const dir = order.trigger_direction ?? defaultTriggerDirection(order.side);
  const ref = order.trail_ref && order.trail_ref > 0 ? order.trail_ref : mark;
  return trailingStopPrice(dir, ref, order.trail_percent ?? 0);
}

/**
 * Evaluate one resting trigger order against the live mark.
 * - trailing stops ratchet their reference price
 * - stop-limit converts into a resting limit order
 * - stop-market settles immediately at mark
 * Returns what happened so the caller can report counts.
 */
export async function evaluateTriggerOrder(
  supabase: any,
  order: TriggerRow,
  mark: number,
): Promise<"idle" | "trailed" | "armed" | "filled"> {
  const dir = order.trigger_direction ?? defaultTriggerDirection(order.side);

  if (order.order_type === "trailing_stop") {
    const ref = order.trail_ref && order.trail_ref > 0 ? order.trail_ref : mark;
    const better = dir === "below" ? Math.max(ref, mark) : Math.min(ref, mark);
    if (better !== ref) {
      await supabase
        .from("spot_orders")
        .update({ trail_ref: better, updated_at: new Date().toISOString() })
        .eq("id", order.id);
      order.trail_ref = better;
      return "trailed";
    }
  }

  const stop = effectiveStop(order, mark);
  if (!triggerHit(dir, stop, mark)) return "idle";

  const now = new Date().toISOString();

  if (order.order_type === "stop_limit") {
    await supabase
      .from("spot_orders")
      .update({ order_type: "limit", triggered_at: now, updated_at: now })
      .eq("id", order.id)
      .eq("status", "open");
    return "armed";
  }

  await executeSpotMarketTrade({
    data: {
      wallet_id: order.wallet_id,
      market: order.market,
      side: order.side,
      amount: order.amount - order.filled,
      price: mark,
      pay_asset: order.pay_asset,
    },
  });

  await supabase
    .from("spot_orders")
    .update({
      status: "filled",
      filled: order.amount,
      avg_fill_price: mark,
      triggered_at: now,
      filled_at: now,
      updated_at: now,
    })
    .eq("id", order.id);

  await cancelOcoSiblings(supabase, order);
  return "filled";
}

/** One-cancels-other: kill the other leg once this one fills. */
export async function cancelOcoSiblings(supabase: any, order: TriggerRow): Promise<void> {
  if (!order.oco_group) return;
  await supabase
    .from("spot_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("oco_group", order.oco_group)
    .neq("id", order.id)
    .in("status", ["open", "partial"]);
}
