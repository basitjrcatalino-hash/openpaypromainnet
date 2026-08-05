import type { MajorTokenId } from "@/lib/major-tokens";
import { isMajorTokenId } from "@/lib/major-tokens";
import {
  PERP_MARKETS as REGISTRY_MARKETS,
  getTradeMarket,
  isTradeMarket,
  type PerpMarket as RegistryPerpMarket,
} from "@/lib/trade-markets";

/** Non-stable Spot / Perpetual markets — sourced from Master Token Registry. */
export const PERP_MARKETS = REGISTRY_MARKETS;
export type PerpMarket = RegistryPerpMarket;

export const PERP_MARGIN_ASSETS = ["USDT", "OUSD", "USDC"] as const;
export type PerpMarginAsset = (typeof PERP_MARGIN_ASSETS)[number];

export type PerpSide = "long" | "short";

export const PERP_LEVERAGE_OPTIONS = [1, 2, 3, 5, 10, 20] as const;

export function isPerpMarket(v: string): v is PerpMarket {
  return isTradeMarket(v);
}

export function marketToMajorId(market: PerpMarket): MajorTokenId | null {
  const row = getTradeMarket(market);
  if (row?.majorId) return row.majorId;
  const fallback = market.toLowerCase();
  if (isMajorTokenId(fallback)) return fallback;
  return null;
}

export function unrealizedPnl(opts: {
  side: PerpSide;
  sizeUsd: number;
  entryPrice: number;
  markPrice: number;
  margin: number;
}): number {
  const { side, sizeUsd, entryPrice, markPrice, margin } = opts;
  if (!entryPrice || entryPrice <= 0) return 0;
  const raw =
    side === "long"
      ? sizeUsd * ((markPrice - entryPrice) / entryPrice)
      : sizeUsd * ((entryPrice - markPrice) / entryPrice);
  return Math.max(-margin, Math.round(raw * 1e8) / 1e8);
}

export type PerpPosition = {
  id: string;
  user_id: string;
  wallet_id: string;
  market: PerpMarket;
  side: PerpSide;
  leverage: number;
  margin_asset: PerpMarginAsset;
  margin: number;
  entry_price: number;
  size_usd: number;
  status: "open" | "closed" | "liquidated";
  exit_price: number | null;
  realized_pnl: number | null;
  closed_at: string | null;
  created_at: string;
  liquidation_price?: number | null;
  take_profit_price?: number | null;
  stop_loss_price?: number | null;
  margin_mode?: string | null;
  position_mode?: string | null;
};
