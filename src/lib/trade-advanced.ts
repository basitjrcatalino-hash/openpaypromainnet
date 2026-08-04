import type { DepthLevel, ExchangeDepthBook } from "@/lib/exchange-depth";
import type { PerpMarket, PerpSide } from "@/lib/perp";

/* ------------------------------------------------------------------ */
/* Order kinds                                                         */
/* ------------------------------------------------------------------ */

export const SPOT_ORDER_KINDS = [
  "market",
  "limit",
  "stop_limit",
  "stop_market",
  "trailing_stop",
] as const;
export type SpotOrderKind = (typeof SPOT_ORDER_KINDS)[number];

export const TIME_IN_FORCE = ["gtc", "ioc", "fok"] as const;
export type TimeInForce = (typeof TIME_IN_FORCE)[number];

export const TRIGGER_DIRECTIONS = ["above", "below"] as const;
export type TriggerDirection = (typeof TRIGGER_DIRECTIONS)[number];

export function orderKindLabel(kind: SpotOrderKind): string {
  switch (kind) {
    case "market":
      return "Market";
    case "limit":
      return "Limit";
    case "stop_limit":
      return "Stop limit";
    case "stop_market":
      return "Stop market";
    case "trailing_stop":
      return "Trailing stop";
  }
}

export function isTriggerKind(kind: SpotOrderKind): boolean {
  return kind === "stop_limit" || kind === "stop_market" || kind === "trailing_stop";
}

/** Default trigger side: buy stops fire when price rises, sell stops when it falls. */
export function defaultTriggerDirection(side: "buy" | "sell"): TriggerDirection {
  return side === "buy" ? "above" : "below";
}

export function triggerHit(
  direction: TriggerDirection,
  triggerPrice: number,
  mark: number,
): boolean {
  if (!(triggerPrice > 0) || !(mark > 0)) return false;
  return direction === "above" ? mark >= triggerPrice : mark <= triggerPrice;
}

/** Trailing stop: ref tracks the best price seen; fires once price retraces `pct`. */
export function trailingStopPrice(
  direction: TriggerDirection,
  ref: number,
  pct: number,
): number {
  if (!(ref > 0) || !(pct > 0)) return 0;
  return direction === "below" ? ref * (1 - pct / 100) : ref * (1 + pct / 100);
}

/* ------------------------------------------------------------------ */
/* Order book precision / aggregation                                  */
/* ------------------------------------------------------------------ */

/** Sensible tick sizes for a given price magnitude, smallest first. */
export function precisionOptions(price: number): number[] {
  const px = price > 0 ? price : 1;
  const base = Math.pow(10, Math.floor(Math.log10(px)) - 4);
  return [base, base * 2, base * 5, base * 10, base * 50].map((t) =>
    Number(t.toPrecision(2)),
  );
}

export function formatTick(tick: number): string {
  if (tick >= 1) return String(Math.round(tick));
  const decimals = Math.min(8, Math.max(0, Math.ceil(-Math.log10(tick))));
  return tick.toFixed(decimals);
}

/** Group raw levels into `tick`-sized price buckets (OKX precision selector). */
export function aggregateLevels(
  levels: DepthLevel[],
  tick: number,
  side: "bid" | "ask",
): DepthLevel[] {
  if (!levels.length || !(tick > 0)) return levels;
  const buckets = new Map<number, number>();
  for (const l of levels) {
    const raw = l.price / tick;
    const bucket = (side === "bid" ? Math.floor(raw) : Math.ceil(raw)) * tick;
    const key = Number(bucket.toFixed(10));
    buckets.set(key, (buckets.get(key) ?? 0) + l.amount);
  }
  const out = [...buckets.entries()].map(([price, amount]) => ({ price, amount }));
  out.sort((a, b) => (side === "bid" ? b.price - a.price : a.price - b.price));
  return out;
}

/* ------------------------------------------------------------------ */
/* Depth chart                                                          */
/* ------------------------------------------------------------------ */

export type DepthPoint = { price: number; cumulative: number };

export type DepthSeries = {
  bids: DepthPoint[];
  asks: DepthPoint[];
  mid: number;
  minPrice: number;
  maxPrice: number;
  maxCumulative: number;
};

/** Cumulative bid/ask curves clipped to ±`spanPct` around mid. */
export function buildDepthSeries(
  book: ExchangeDepthBook | undefined,
  spanPct: number,
  midOverride?: number,
): DepthSeries | null {
  const mid = midOverride && midOverride > 0 ? midOverride : (book?.mid ?? 0);
  if (!book || !(mid > 0)) return null;

  const lo = mid * (1 - spanPct / 100);
  const hi = mid * (1 + spanPct / 100);

  const bids: DepthPoint[] = [];
  let cum = 0;
  for (const l of [...book.bids].sort((a, b) => b.price - a.price)) {
    if (l.price < lo) break;
    cum += l.amount;
    bids.push({ price: l.price, cumulative: cum });
  }

  const asks: DepthPoint[] = [];
  cum = 0;
  for (const l of [...book.asks].sort((a, b) => a.price - b.price)) {
    if (l.price > hi) break;
    cum += l.amount;
    asks.push({ price: l.price, cumulative: cum });
  }

  if (!bids.length && !asks.length) return null;

  const maxCumulative = Math.max(
    bids[bids.length - 1]?.cumulative ?? 0,
    asks[asks.length - 1]?.cumulative ?? 0,
    0.00000001,
  );

  return { bids, asks, mid, minPrice: lo, maxPrice: hi, maxCumulative };
}

/* ------------------------------------------------------------------ */
/* Risk maths                                                           */
/* ------------------------------------------------------------------ */

export function liquidationPrice(side: PerpSide, entry: number, leverage: number): number {
  if (!(entry > 0) || !(leverage >= 1)) return 0;
  const px = side === "long" ? entry * (1 - 1 / leverage) : entry * (1 + 1 / leverage);
  return Math.max(0, px);
}

export function bankruptcyPrice(side: PerpSide, entry: number, leverage: number): number {
  return liquidationPrice(side, entry, leverage);
}

/** Maintenance margin at a flat 0.5% of notional. */
export function maintenanceMargin(sizeUsd: number): number {
  return Math.max(0, sizeUsd) * 0.005;
}

export function marginRatio(margin: number, pnl: number, sizeUsd: number): number {
  const equity = margin + pnl;
  const mm = maintenanceMargin(sizeUsd);
  if (!(mm > 0)) return 0;
  return equity / mm;
}

export function roePct(pnl: number, margin: number): number {
  if (!(margin > 0)) return 0;
  return (pnl / margin) * 100;
}

/* ------------------------------------------------------------------ */
/* CSV export                                                           */
/* ------------------------------------------------------------------ */

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): boolean {
  const csv = toCsv(rows);
  if (!csv || typeof document === "undefined") return false;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/* ------------------------------------------------------------------ */
/* Recently viewed markets                                              */
/* ------------------------------------------------------------------ */

const RECENT_KEY = "openpay_trade_recent";

export function loadRecentMarkets(): PerpMarket[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as PerpMarket[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentMarket(market: PerpMarket): PerpMarket[] {
  const next = [market, ...loadRecentMarkets().filter((m) => m !== market)].slice(0, 8);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export const TRADE_FAVORITES_KEY = "openpay_trade_favorites";

export function loadTradeFavorites(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRADE_FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : ["BTC", "ETH"];
  } catch {
    return [];
  }
}

export function saveTradeFavorites(list: string[]): void {
  try {
    localStorage.setItem(TRADE_FAVORITES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
