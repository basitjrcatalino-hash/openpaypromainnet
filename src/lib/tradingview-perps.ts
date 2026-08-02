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
  /** Gate.io USDT futures contract — works in more regions than Binance */
  gateFutures?: string;
  /** Bybit linear symbol */
  bybitLinear?: string;
  /** OKX swap instrument (PI) */
  okxSwap?: string;
  /** CoinGecko id for last-resort mark */
  coingeckoId: string;
};

export const PERP_TV: Record<PerpMarket, PerpTvConfig> = {
  BTC: {
    market: "BTC",
    tvSymbol: "BINANCE:BTCUSDT.P",
    tvUrl: "https://www.tradingview.com/symbols/BTCUSDT.P/",
    exchangeLabel: "Binance",
    binanceFutures: "BTCUSDT",
    gateFutures: "BTC_USDT",
    bybitLinear: "BTCUSDT",
    coingeckoId: "bitcoin",
  },
  ETH: {
    market: "ETH",
    tvSymbol: "BINANCE:ETHUSDT.P",
    tvUrl: "https://www.tradingview.com/symbols/ETHUSDT.P/",
    exchangeLabel: "Binance",
    binanceFutures: "ETHUSDT",
    gateFutures: "ETH_USDT",
    bybitLinear: "ETHUSDT",
    coingeckoId: "ethereum",
  },
  SOL: {
    market: "SOL",
    tvSymbol: "BINANCE:SOLUSDT.P",
    tvUrl: "https://www.tradingview.com/symbols/SOLUSDT.P/",
    exchangeLabel: "Binance",
    binanceFutures: "SOLUSDT",
    gateFutures: "SOL_USDT",
    bybitLinear: "SOLUSDT",
    coingeckoId: "solana",
  },
  PI: {
    market: "PI",
    tvSymbol: "OKX:PIUSDT.P",
    tvUrl: "https://www.tradingview.com/symbols/PIUSDT.P/",
    exchangeLabel: "OKX / Gate",
    okxSwap: "PI-USDT-SWAP",
    gateFutures: "PI_USDT",
    coingeckoId: "pi-network",
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

function quoteBase(market: PerpMarket): Pick<PerpLiveQuote, "market" | "tvSymbol" | "tvUrl" | "updatedAt"> {
  const cfg = PERP_TV[market];
  return {
    market,
    tvSymbol: cfg.tvSymbol,
    tvUrl: cfg.tvUrl,
    updatedAt: Date.now(),
  };
}

async function fetchJson(url: string, ms = 8_000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchBinanceFuturesQuote(
  market: PerpMarket,
  symbol: string,
): Promise<PerpLiveQuote> {
  const [ticker, premium] = await Promise.all([
    fetchJson(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`) as Promise<
      Record<string, unknown>
    >,
    fetchJson(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`)
      .then((j) => j as Record<string, unknown>)
      .catch(() => null),
  ]);
  const last = num(ticker.lastPrice);
  const changePct = num(ticker.priceChangePercent);
  const changeAbs = num(ticker.priceChange);
  const mp = premium ? num(premium.markPrice) : NaN;
  const mark = mp > 0 ? mp : last;
  if (!(mark > 0)) throw new Error(`No Binance price for ${symbol}`);
  return {
    ...quoteBase(market),
    price: mark,
    markPrice: mark,
    change24h: Number.isFinite(changePct) ? changePct : 0,
    changeAbs: Number.isFinite(changeAbs) ? changeAbs : mark * ((changePct || 0) / 100),
    source: "Binance Futures",
  };
}

async function fetchOkxSwapQuote(market: PerpMarket, instId: string): Promise<PerpLiveQuote> {
  const body = (await fetchJson(
    `https://www.okx.com/api/v5/market/ticker?instId=${instId}`,
  )) as { data?: Array<Record<string, unknown>> };
  const row = body.data?.[0];
  if (!row) throw new Error(`No OKX data for ${instId}`);
  const last = num(row.last);
  const open24h = num(row.open24h);
  const markRaw = num(row.markPx);
  const mark = markRaw > 0 ? markRaw : last;
  if (!(mark > 0)) throw new Error(`No OKX price for ${instId}`);
  const changeAbs = open24h > 0 ? mark - open24h : 0;
  const change24h = open24h > 0 ? (changeAbs / open24h) * 100 : 0;
  return {
    ...quoteBase(market),
    price: mark,
    markPrice: mark,
    change24h,
    changeAbs,
    source: "OKX Swap",
  };
}

async function fetchGateFuturesQuote(
  market: PerpMarket,
  contract: string,
): Promise<PerpLiveQuote> {
  const rows = (await fetchJson(
    `https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=${contract}`,
  )) as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) throw new Error(`No Gate data for ${contract}`);
  const last = num(row.last);
  const markRaw = num(row.mark_price);
  const changePct = num(row.change_percentage);
  const changeAbs = num(row.change_price);
  const mark = markRaw > 0 ? markRaw : last;
  if (!(mark > 0)) throw new Error(`No Gate price for ${contract}`);
  return {
    ...quoteBase(market),
    price: mark,
    markPrice: mark,
    change24h: Number.isFinite(changePct) ? changePct : 0,
    changeAbs: Number.isFinite(changeAbs) ? changeAbs : 0,
    source: "Gate Futures",
  };
}

async function fetchBybitLinearQuote(
  market: PerpMarket,
  symbol: string,
): Promise<PerpLiveQuote> {
  const body = (await fetchJson(
    `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`,
  )) as { result?: { list?: Array<Record<string, unknown>> } };
  const row = body.result?.list?.[0];
  if (!row) throw new Error(`No Bybit data for ${symbol}`);
  const last = num(row.lastPrice);
  const markRaw = num(row.markPrice);
  const changePct = num(row.price24hPcnt) * 100; // Bybit returns fraction
  const mark = markRaw > 0 ? markRaw : last;
  if (!(mark > 0)) throw new Error(`No Bybit price for ${symbol}`);
  const prev = mark / (1 + (Number.isFinite(changePct) ? changePct : 0) / 100);
  const changeAbs = Number.isFinite(prev) && prev > 0 ? mark - prev : 0;
  return {
    ...quoteBase(market),
    price: mark,
    markPrice: mark,
    change24h: Number.isFinite(changePct) ? changePct : 0,
    changeAbs,
    source: "Bybit Perps",
  };
}

async function fetchCoinGeckoQuote(market: PerpMarket, id: string): Promise<PerpLiveQuote> {
  const body = (await fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true`,
  )) as Record<string, { usd?: number; usd_24h_change?: number }>;
  const row = body[id];
  const mark = num(row?.usd);
  const changePct = num(row?.usd_24h_change);
  if (!(mark > 0)) throw new Error(`No CoinGecko price for ${id}`);
  const changeAbs = Number.isFinite(changePct) ? mark * (changePct / 100) : 0;
  return {
    ...quoteBase(market),
    price: mark,
    markPrice: mark,
    change24h: Number.isFinite(changePct) ? changePct : 0,
    changeAbs,
    source: "CoinGecko",
  };
}

/** Try exchange feeds in order — Binance is geo-blocked on many serverless regions. */
export async function fetchPerpLiveQuote(market: PerpMarket): Promise<PerpLiveQuote> {
  const cfg = PERP_TV[market];
  const errors: string[] = [];

  const tryOne = async (label: string, fn: () => Promise<PerpLiveQuote>) => {
    try {
      return await fn();
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };

  // Prefer venues that match TradingView listing, then resilient fallbacks
  if (cfg.binanceFutures) {
    const q = await tryOne("binance", () => fetchBinanceFuturesQuote(market, cfg.binanceFutures!));
    if (q) return q;
  }
  if (cfg.okxSwap) {
    const q = await tryOne("okx", () => fetchOkxSwapQuote(market, cfg.okxSwap!));
    if (q) return q;
  }
  if (cfg.gateFutures) {
    const q = await tryOne("gate", () => fetchGateFuturesQuote(market, cfg.gateFutures!));
    if (q) return q;
  }
  if (cfg.bybitLinear) {
    const q = await tryOne("bybit", () => fetchBybitLinearQuote(market, cfg.bybitLinear!));
    if (q) return q;
  }
  {
    const q = await tryOne("coingecko", () => fetchCoinGeckoQuote(market, cfg.coingeckoId));
    if (q) return q;
  }

  throw new Error(`Unable to load ${market} mark (${errors.join("; ")})`);
}

export async function fetchAllPerpLiveQuotes(): Promise<PerpLiveQuote[]> {
  const markets = Object.keys(PERP_TV) as PerpMarket[];
  const results = await Promise.allSettled(markets.map((m) => fetchPerpLiveQuote(m)));
  const out: PerpLiveQuote[] = [];
  const errors: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if (r.status === "fulfilled") out.push(r.value);
    else errors.push(`${markets[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  }
  if (!out.length) {
    throw new Error(`Unable to load perpetual market data (${errors.join("; ")})`);
  }
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
