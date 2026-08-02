import type { PerpMarket } from "@/lib/perp";
import { PERP_TV } from "@/lib/tradingview-perps";

export type TradeMode = "spot" | "futures";

export type DepthLevel = { price: number; amount: number };

export type ExchangeDepthBook = {
  market: PerpMarket;
  mode: TradeMode;
  mid: number;
  bids: DepthLevel[];
  asks: DepthLevel[];
  source: string;
  updatedAt: number;
};

const SPOT_TV: Record<PerpMarket, string> = {
  BTC: "BINANCE:BTCUSDT",
  ETH: "BINANCE:ETHUSDT",
  SOL: "BINANCE:SOLUSDT",
  PI: "OKX:PIUSDT",
};

export function tvSymbolForMode(market: PerpMarket, mode: TradeMode): string {
  return mode === "futures" ? PERP_TV[market].tvSymbol : SPOT_TV[market];
}

export function pairLabel(market: PerpMarket, mode: TradeMode): string {
  return mode === "futures" ? `${market}USDT` : `${market}/USDT`;
}

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : NaN;
}

async function fetchJson(url: string, ms = 8_000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function parseBinanceBook(
  market: PerpMarket,
  mode: TradeMode,
  body: { bids?: string[][]; asks?: string[][] },
  source: string,
): ExchangeDepthBook {
  const bids = (body.bids ?? [])
    .map(([p, a]) => ({ price: num(p), amount: num(a) }))
    .filter((l) => l.price > 0 && l.amount > 0)
    .slice(0, 12);
  const asks = (body.asks ?? [])
    .map(([p, a]) => ({ price: num(p), amount: num(a) }))
    .filter((l) => l.price > 0 && l.amount > 0)
    .slice(0, 12);
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const mid = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;
  return { market, mode, mid, bids, asks, source, updatedAt: Date.now() };
}

function syntheticBook(
  market: PerpMarket,
  mode: TradeMode,
  mid: number,
  source = "Synthetic",
): ExchangeDepthBook {
  const px = mid > 0 ? mid : 1;
  const step =
    px >= 1000 ? px * 0.00015 : px >= 10 ? px * 0.0004 : px >= 1 ? px * 0.001 : px * 0.004;
  const bids: DepthLevel[] = [];
  const asks: DepthLevel[] = [];
  for (let i = 0; i < 10; i++) {
    const amt = (0.05 + Math.random() * 0.45) * (1 + i * 0.15);
    bids.push({ price: px - step * (i + 1), amount: amt });
    asks.push({ price: px + step * (i + 1), amount: amt * (0.9 + Math.random() * 0.3) });
  }
  return { market, mode, mid: px, bids, asks, source, updatedAt: Date.now() };
}

async function fetchBinanceDepth(
  market: PerpMarket,
  mode: TradeMode,
  symbol: string,
): Promise<ExchangeDepthBook> {
  const url =
    mode === "futures"
      ? `https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=20`
      : `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`;
  const body = (await fetchJson(url)) as { bids?: string[][]; asks?: string[][] };
  return parseBinanceBook(
    market,
    mode,
    body,
    mode === "futures" ? "Binance Futures" : "Binance Spot",
  );
}

async function fetchGateSpotDepth(market: PerpMarket, contract: string): Promise<ExchangeDepthBook> {
  const body = (await fetchJson(
    `https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${contract}&limit=20`,
  )) as { bids?: string[][]; asks?: string[][] };
  return parseBinanceBook(market, "spot", body, "Gate Spot");
}

async function fetchGateFuturesDepth(
  market: PerpMarket,
  contract: string,
): Promise<ExchangeDepthBook> {
  const body = (await fetchJson(
    `https://api.gateio.ws/api/v4/futures/usdt/order_book?contract=${contract}&limit=20`,
  )) as { bids?: Array<{ p?: string; s?: number }>; asks?: Array<{ p?: string; s?: number }> };
  const bids = (body.bids ?? [])
    .map((r) => ({ price: num(r.p), amount: num(r.s) }))
    .filter((l) => l.price > 0 && l.amount > 0)
    .slice(0, 12);
  const asks = (body.asks ?? [])
    .map((r) => ({ price: num(r.p), amount: num(r.s) }))
    .filter((l) => l.price > 0 && l.amount > 0)
    .slice(0, 12);
  const mid =
    bids[0] && asks[0] ? (bids[0].price + asks[0].price) / 2 : bids[0]?.price || asks[0]?.price || 0;
  return {
    market,
    mode: "futures",
    mid,
    bids,
    asks,
    source: "Gate Futures",
    updatedAt: Date.now(),
  };
}

/** Live order book with venue fallbacks + synthetic ladder. */
export async function fetchExchangeDepth(
  market: PerpMarket,
  mode: TradeMode,
  markHint = 0,
): Promise<ExchangeDepthBook> {
  const cfg = PERP_TV[market];
  const errors: string[] = [];

  const tryOne = async (label: string, fn: () => Promise<ExchangeDepthBook>) => {
    try {
      const book = await fn();
      if (book.bids.length && book.asks.length && book.mid > 0) return book;
      errors.push(`${label}: empty`);
      return null;
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };

  if (cfg.binanceFutures) {
    const q = await tryOne("binance", () => fetchBinanceDepth(market, mode, cfg.binanceFutures!));
    if (q) return q;
  }

  if (cfg.gateFutures) {
    if (mode === "futures") {
      const q = await tryOne("gate-fut", () => fetchGateFuturesDepth(market, cfg.gateFutures!));
      if (q) return q;
    } else {
      const q = await tryOne("gate-spot", () => fetchGateSpotDepth(market, cfg.gateFutures!));
      if (q) return q;
    }
  }

  if (markHint > 0) return syntheticBook(market, mode, markHint);
  throw new Error(`No depth for ${market} (${errors.join("; ") || "unknown"})`);
}

export function buySellRatio(book: ExchangeDepthBook | undefined): { buyPct: number; sellPct: number } {
  if (!book) return { buyPct: 50, sellPct: 50 };
  const bidVol = book.bids.reduce((s, l) => s + l.amount * l.price, 0);
  const askVol = book.asks.reduce((s, l) => s + l.amount * l.price, 0);
  const total = bidVol + askVol;
  if (!(total > 0)) return { buyPct: 50, sellPct: 50 };
  const buyPct = Math.round((bidVol / total) * 100);
  return { buyPct, sellPct: 100 - buyPct };
}

export type RecentTrade = {
  id: string;
  price: number;
  amount: number;
  side: "buy" | "sell";
  time: number;
  source: string;
};

async function fetchBinanceRecentTrades(
  market: PerpMarket,
  mode: TradeMode,
  symbol: string,
): Promise<RecentTrade[]> {
  const url =
    mode === "futures"
      ? `https://fapi.binance.com/fapi/v1/trades?symbol=${symbol}&limit=24`
      : `https://api.binance.com/api/v3/trades?symbol=${symbol}&limit=24`;
  const rows = (await fetchJson(url)) as Array<Record<string, unknown>>;
  return rows
    .map((r, i) => {
      const price = num(r.price);
      const amount = num(r.qty);
      const time = num(r.time) || Date.now();
      const isBuyerMaker = Boolean(r.isBuyerMaker);
      // taker buy when seller was maker
      const side: "buy" | "sell" = isBuyerMaker ? "sell" : "buy";
      return {
        id: String(r.id ?? `${symbol}-${time}-${i}`),
        price,
        amount,
        side,
        time,
        source: mode === "futures" ? "Binance Futures" : "Binance Spot",
      };
    })
    .filter((t) => t.price > 0 && t.amount > 0)
    .reverse();
}

async function fetchGateRecentTrades(
  market: PerpMarket,
  mode: TradeMode,
  contract: string,
): Promise<RecentTrade[]> {
  const url =
    mode === "futures"
      ? `https://api.gateio.ws/api/v4/futures/usdt/trades?contract=${contract}&limit=24`
      : `https://api.gateio.ws/api/v4/spot/trades?currency_pair=${contract}&limit=24`;
  const rows = (await fetchJson(url)) as Array<Record<string, unknown>>;
  return rows
    .map((r, i) => {
      const price = num(r.price);
      const amount = num(r.size ?? r.amount);
      const time = (num(r.create_time_ms) || num(r.create_time) * 1000) || Date.now();
      const sideRaw = String(r.side ?? "").toLowerCase();
      const side: "buy" | "sell" = sideRaw === "sell" || amount < 0 ? "sell" : "buy";
      return {
        id: String(r.id ?? `${contract}-${time}-${i}`),
        price,
        amount: Math.abs(amount),
        side,
        time,
        source: mode === "futures" ? "Gate Futures" : "Gate Spot",
      };
    })
    .filter((t) => t.price > 0 && t.amount > 0);
}

/** Venue recent trades for Trade UI tape. */
export async function fetchRecentTrades(
  market: PerpMarket,
  mode: TradeMode,
): Promise<RecentTrade[]> {
  const cfg = PERP_TV[market];
  const errors: string[] = [];

  if (cfg.binanceFutures) {
    try {
      return await fetchBinanceRecentTrades(market, mode, cfg.binanceFutures);
    } catch (e) {
      errors.push(`binance: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (cfg.gateFutures) {
    try {
      return await fetchGateRecentTrades(market, mode, cfg.gateFutures);
    } catch (e) {
      errors.push(`gate: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`No recent trades for ${market} (${errors.join("; ") || "unknown"})`);
}
