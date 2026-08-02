import type { PerpMarket } from "@/lib/perp";

/** TradingView perpetual symbols used on Trade (chart / news / technicals). */
export type PerpTvConfig = {
  market: PerpMarket;
  /** TradingView embed symbol, e.g. BINANCE:BTCUSDT.P */
  tvSymbol: string;
  /** Public TradingView symbol page */
  tvUrl: string;
  exchangeLabel: string;
  /** Binance USDT-M futures ticker (BTC/ETH/SOL) */
  binanceFutures?: string;
  /** OKX swap instrument (PI) */
  okxSwap?: string;
  /** Gate.io USDT futures contract (PI fallback) */
  gateFutures?: string;
};

export const PERP_TV: Record<PerpMarket, PerpTvConfig> = {
  BTC: {
    market: "BTC",
    tvSymbol: "BINANCE:BTCUSDT.P",
    tvUrl: "https://www.tradingview.com/symbols/BTCUSDT.P/",
    exchangeLabel: "Binance",
    binanceFutures: "BTCUSDT",
  },
  ETH: {
    market: "ETH",
    tvSymbol: "BINANCE:ETHUSDT.P",
    tvUrl: "https://www.tradingview.com/symbols/ETHUSDT.P/",
    exchangeLabel: "Binance",
    binanceFutures: "ETHUSDT",
  },
  SOL: {
    market: "SOL",
    tvSymbol: "BINANCE:SOLUSDT.P",
    tvUrl: "https://www.tradingview.com/symbols/SOLUSDT.P/",
    exchangeLabel: "Binance",
    binanceFutures: "SOLUSDT",
  },
  PI: {
    market: "PI",
    tvSymbol: "OKX:PIUSDT.P",
    tvUrl: "https://www.tradingview.com/symbols/PIUSDT.P/",
    exchangeLabel: "OKX / Gate",
    okxSwap: "PI-USDT-SWAP",
    /** Fallback when OKX is unreachable (region/DNS) */
    gateFutures: "PI_USDT",
  },
};

export type PerpLiveQuote = {
  market: PerpMarket;
  price: number;
  change24h: number;
  /** Absolute USD change over ~24h when available */
  changeAbs: number;
  markPrice: number;
  source: string;
  tvSymbol: string;
  tvUrl: string;
  updatedAt: number;
};

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : NaN;
}

async function fetchBinanceFuturesQuote(
  market: PerpMarket,
  symbol: string,
): Promise<PerpLiveQuote> {
  const cfg = PERP_TV[market];
  const [tickerRes, premiumRes] = await Promise.all([
    fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`, {
      headers: { Accept: "application/json" },
    }),
    fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`, {
      headers: { Accept: "application/json" },
    }),
  ]);
  if (!tickerRes.ok) throw new Error(`Binance ticker ${symbol}: ${tickerRes.status}`);
  const ticker = (await tickerRes.json()) as Record<string, unknown>;
  const last = num(ticker.lastPrice);
  const changePct = num(ticker.priceChangePercent);
  const changeAbs = num(ticker.priceChange);
  let mark = last;
  if (premiumRes.ok) {
    const premium = (await premiumRes.json()) as Record<string, unknown>;
    const mp = num(premium.markPrice);
    if (mp > 0) mark = mp;
  }
  if (!(last > 0) && !(mark > 0)) throw new Error(`No Binance price for ${symbol}`);
  const price = mark > 0 ? mark : last;
  return {
    market,
    price,
    markPrice: mark > 0 ? mark : price,
    change24h: Number.isFinite(changePct) ? changePct : 0,
    changeAbs: Number.isFinite(changeAbs) ? changeAbs : price * ((changePct || 0) / 100),
    source: "Binance Futures",
    tvSymbol: cfg.tvSymbol,
    tvUrl: cfg.tvUrl,
    updatedAt: Date.now(),
  };
}

async function fetchOkxSwapQuote(market: PerpMarket, instId: string): Promise<PerpLiveQuote> {
  const cfg = PERP_TV[market];
  const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`OKX ticker ${instId}: ${res.status}`);
  const body = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const row = body.data?.[0];
  if (!row) throw new Error(`No OKX data for ${instId}`);
  const last = num(row.last);
  const open24h = num(row.open24h);
  const mark = num(row.markPx);
  if (!(last > 0) && !(mark > 0)) throw new Error(`No OKX price for ${instId}`);
  const price = mark > 0 ? mark : last;
  const changeAbs = open24h > 0 ? price - open24h : 0;
  const change24h = open24h > 0 ? (changeAbs / open24h) * 100 : 0;
  return {
    market,
    price,
    markPrice: mark > 0 ? mark : price,
    change24h,
    changeAbs,
    source: "OKX Swap",
    tvSymbol: cfg.tvSymbol,
    tvUrl: cfg.tvUrl,
    updatedAt: Date.now(),
  };
}

async function fetchGateFuturesQuote(
  market: PerpMarket,
  contract: string,
): Promise<PerpLiveQuote> {
  const cfg = PERP_TV[market];
  const res = await fetch(
    `https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=${contract}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Gate ticker ${contract}: ${res.status}`);
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) throw new Error(`No Gate data for ${contract}`);
  const last = num(row.last);
  const mark = num(row.mark_price);
  const changePct = num(row.change_percentage);
  const changeAbs = num(row.change_price);
  if (!(last > 0) && !(mark > 0)) throw new Error(`No Gate price for ${contract}`);
  const price = mark > 0 ? mark : last;
  return {
    market,
    price,
    markPrice: mark > 0 ? mark : price,
    change24h: Number.isFinite(changePct) ? changePct : 0,
    changeAbs: Number.isFinite(changeAbs) ? changeAbs : 0,
    source: "Gate Futures",
    tvSymbol: cfg.tvSymbol,
    tvUrl: cfg.tvUrl,
    updatedAt: Date.now(),
  };
}

export async function fetchPerpLiveQuote(market: PerpMarket): Promise<PerpLiveQuote> {
  const cfg = PERP_TV[market];
  if (cfg.binanceFutures) return fetchBinanceFuturesQuote(market, cfg.binanceFutures);
  if (cfg.okxSwap) {
    try {
      return await fetchOkxSwapQuote(market, cfg.okxSwap);
    } catch {
      if (cfg.gateFutures) return fetchGateFuturesQuote(market, cfg.gateFutures);
      throw new Error(`Unable to load ${market} perpetual mark`);
    }
  }
  if (cfg.gateFutures) return fetchGateFuturesQuote(market, cfg.gateFutures);
  throw new Error(`No exchange feed for ${market}`);
}

export async function fetchAllPerpLiveQuotes(): Promise<PerpLiveQuote[]> {
  const results = await Promise.allSettled(
    (Object.keys(PERP_TV) as PerpMarket[]).map((m) => fetchPerpLiveQuote(m)),
  );
  const out: PerpLiveQuote[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") out.push(r.value);
  }
  if (!out.length) throw new Error("Unable to load perpetual market data");
  return out;
}

export function quoteByMarket(
  quotes: PerpLiveQuote[] | undefined,
  market: PerpMarket,
): PerpLiveQuote | undefined {
  return quotes?.find((q) => q.market === market);
}

/** Map Trade period chips to TradingView chart intervals. */
export function periodToTvInterval(period: string): string {
  switch (period) {
    case "LIVE":
      return "1";
    case "1H":
      return "60";
    case "4H":
      return "240";
    case "1D":
      return "D";
    case "1W":
      return "W";
    case "1M":
      return "M";
    case "1Y":
      return "W";
    case "ALL":
      return "M";
    default:
      return "15";
  }
}
