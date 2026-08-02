import type { PerpMarket } from "@/lib/perp";

export type SpotOrderSide = "buy" | "sell";
export type SpotOrderStatus = "open" | "partial" | "filled" | "cancelled";
export type SpotPayAsset = "USDT" | "OUSD" | "USDC";

export type SpotOrder = {
  id: string;
  user_id: string;
  wallet_id: string;
  market: PerpMarket;
  side: SpotOrderSide;
  order_type: "market" | "limit";
  price: number;
  amount: number;
  filled: number;
  pay_asset: SpotPayAsset;
  status: SpotOrderStatus;
  avg_fill_price?: number | null;
  client_order_id?: string | null;
  created_at: string;
  updated_at: string;
  filled_at: string | null;
};

export type SpotFill = {
  id: string;
  order_id: string;
  user_id: string;
  wallet_id: string;
  market: PerpMarket;
  side: SpotOrderSide;
  price: number;
  amount: number;
  quote_amount: number;
  fee_usd: number;
  pay_asset: SpotPayAsset;
  mark_price?: number | null;
  created_at: string;
};

export function mapSpotOrder(r: Record<string, unknown>): SpotOrder {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    wallet_id: String(r.wallet_id),
    market: String(r.market).toUpperCase() as PerpMarket,
    side: String(r.side).toLowerCase() as SpotOrderSide,
    order_type: (String(r.order_type || "limit").toLowerCase() as "market" | "limit") || "limit",
    price: Number(r.price),
    amount: Number(r.amount),
    filled: Number(r.filled ?? 0),
    pay_asset: String(r.pay_asset).toUpperCase() as SpotPayAsset,
    status: String(r.status).toLowerCase() as SpotOrderStatus,
    avg_fill_price: r.avg_fill_price == null ? null : Number(r.avg_fill_price),
    client_order_id: r.client_order_id == null ? null : String(r.client_order_id),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    filled_at: r.filled_at == null ? null : String(r.filled_at),
  };
}

export function mapSpotFill(r: Record<string, unknown>): SpotFill {
  return {
    id: String(r.id),
    order_id: String(r.order_id),
    user_id: String(r.user_id),
    wallet_id: String(r.wallet_id),
    market: String(r.market).toUpperCase() as PerpMarket,
    side: String(r.side).toLowerCase() as SpotOrderSide,
    price: Number(r.price),
    amount: Number(r.amount),
    quote_amount: Number(r.quote_amount ?? 0),
    fee_usd: Number(r.fee_usd ?? 0),
    pay_asset: String(r.pay_asset).toUpperCase() as SpotPayAsset,
    mark_price: r.mark_price == null ? null : Number(r.mark_price),
    created_at: String(r.created_at),
  };
}

/** Limit buy fills when mark <= limit; sell when mark >= limit. */
export function limitIsMarketable(side: SpotOrderSide, limitPrice: number, mark: number): boolean {
  if (!(limitPrice > 0) || !(mark > 0)) return false;
  return side === "buy" ? mark <= limitPrice : mark >= limitPrice;
}
