import type { PerpMarket } from "@/lib/perp";
import {
  getTradeMarket,
  listedTradeMarkets,
  tradingViewPerpUrl,
} from "@/lib/trade-markets";

/** TradingView perpetual symbols used on Trade (chart / news / technicals). */
export type PerpTvConfig = {
  market: PerpMarket;
  /** TradingView embed symbol, e.g. OKX:BTCUSDT.P */
  tvSymbol: string;
  /** Public TradingView symbol page */
  tvUrl: string;
  exchangeLabel: string;
  /** Binance USDT-M futures ticker */
  binanceFutures?: string;
  /** Gate.io USDT futures contract */
  gateFutures?: string;
  /** Bybit linear symbol */
  bybitLinear?: string;
  /** OKX swap instrument */
  okxSwap?: string;
  /** CoinGecko id for last-resort mark */
  coingeckoId: string;
};

function toPerpTvConfig(symbol: string): PerpTvConfig {
  const m = getTradeMarket(symbol);
  if (!m) {
    throw new Error(`Missing trade market registry row for ${symbol}`);
  }
  return {
    market: m.symbol as PerpMarket,
    tvSymbol: m.perp_tv,
    tvUrl: tradingViewPerpUrl(m.symbol),
    exchangeLabel: m.okx_swap ? "OKX" : m.binance_futures ? "Binance" : "Gate",
    binanceFutures: m.binance_futures,
    okxSwap: m.okx_swap,
    gateFutures: m.gate_futures,
    bybitLinear: m.bybit_linear,
    coingeckoId: m.coingecko_slug,
  };
}

/** Built from Master Token Registry — do not hardcode per-market TV rows here. */
export const PERP_TV: Record<string, PerpTvConfig> = Object.fromEntries(
  listedTradeMarkets()
    .filter((m) => m.perpetual_enabled)
    .map((m) => [m.symbol, toPerpTvConfig(m.symbol)]),
);

export type PerpLiveQuote = {
  market: PerpMarket;
  price: number;
  change24h: number;
  /** Absolute USD change over ~24h when available */
  changeAbs: number;
  markPrice: number;
  /** Index / spot reference when venue provides it */
  indexPrice?: number;
  high24h?: number;
  low24h?: number;
  /** Quote-currency volume over 24h when available */
  volume24h?: number;
  /** Current funding rate as percent (e.g. 0.01 = 0.01%) */
  fundingRate?: number;
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
    tvSymbol: cfg?.tvSymbol ?? `OKX:${market}USDT.P`,
    tvUrl: cfg?.tvUrl ?? `https://www.tradingview.com/symbols/${market}USDT.P/`,
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
  const high = num(ticker.highPrice);
  const low = num(ticker.lowPrice);
  const vol = num(ticker.quoteVolume);
  const mp = premium ? num(premium.markPrice) : NaN;
  const index = premium ? num(premium.indexPrice) : NaN;
  const funding = premium ? num(premium.lastFundingRate) : NaN;
  const mark = mp > 0 ? mp : last;
  if (!(mark > 0)) throw new Error(`No Binance price for ${symbol}`);
  return {
    ...quoteBase(market),
    price: mark,
    markPrice: mark,
    indexPrice: index > 0 ? index : undefined,
    high24h: high > 0 ? high : undefined,
    low24h: low > 0 ? low : undefined,
    volume24h: vol > 0 ? vol : undefined,
    fundingRate: Number.isFinite(funding) ? funding * 100 : undefined,
    change24h: Number.isFinite(changePct) ? changePct : 0,
    changeAbs: Number.isFinite(changeAbs) ? changeAbs : mark * ((changePct || 0) / 100),
    source: "Binance Futures",
  };
}

async function fetchOkxSwapQuote(market: PerpMarket, instId: string): Promise<PerpLiveQuote> {
  const [tickerBody, fundingBody] = await Promise.all([
    fetchJson(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`) as Promise<{
      data?: Array<Record<string, unknown>>;
    }>,
    fetchJson(`https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`)
      .then((j) => j as { data?: Array<Record<string, unknown>> })
      .catch(() => null),
  ]);
  const row = tickerBody.data?.[0];
  if (!row) throw new Error(`No OKX data for ${instId}`);
  const last = num(row.last);
  const open24h = num(row.open24h);
  const markRaw = num(row.markPx);
  const index = num(row.idxPx);
  const high = num(row.high24h);
  const low = num(row.low24h);
  const vol = num(row.volCcy24h);
  const mark = markRaw > 0 ? markRaw : last;
  if (!(mark > 0)) throw new Error(`No OKX price for ${instId}`);
  const changeAbs = open24h > 0 ? mark - open24h : 0;
  const change24h = open24h > 0 ? (changeAbs / open24h) * 100 : 0;
  const fundingRaw = fundingBody?.data?.[0] ? num(fundingBody.data[0].fundingRate) : NaN;
  return {
    ...quoteBase(market),
    price: mark,
    markPrice: mark,
    indexPrice: index > 0 ? index : undefined,
    high24h: high > 0 ? high : undefined,
    low24h: low > 0 ? low : undefined,
    volume24h: vol > 0 ? vol : undefined,
    fundingRate: Number.isFinite(fundingRaw) ? fundingRaw * 100 : undefined,
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
  const index = num(row.index_price);
  const changePct = num(row.change_percentage);
  const changeAbs = num(row.change_price);
  const high = num(row.high_24h);
  const low = num(row.low_24h);
  const vol = num(row.volume_24h_quote);
  const funding = num(row.funding_rate);
  const mark = markRaw > 0 ? markRaw : last;
  if (!(mark > 0)) throw new Error(`No Gate price for ${contract}`);
  return {
    ...quoteBase(market),
    price: mark,
    markPrice: mark,
    indexPrice: index > 0 ? index : undefined,
    high24h: high > 0 ? high : undefined,
    low24h: low > 0 ? low : undefined,
    volume24h: vol > 0 ? vol : undefined,
    fundingRate: Number.isFinite(funding) ? funding * 100 : undefined,
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
  const index = num(row.indexPrice);
  const high = num(row.highPrice24h);
  const low = num(row.lowPrice24h);
  const vol = num(row.turnover24h);
  const funding = num(row.fundingRate);
  const changePct = num(row.price24hPcnt) * 100; // Bybit returns fraction
  const mark = markRaw > 0 ? markRaw : last;
  if (!(mark > 0)) throw new Error(`No Bybit price for ${symbol}`);
  const prev = mark / (1 + (Number.isFinite(changePct) ? changePct : 0) / 100);
  const changeAbs = Number.isFinite(prev) && prev > 0 ? mark - prev : 0;
  return {
    ...quoteBase(market),
    price: mark,
    markPrice: mark,
    indexPrice: index > 0 ? index : undefined,
    high24h: high > 0 ? high : undefined,
    low24h: low > 0 ? low : undefined,
    volume24h: vol > 0 ? vol : undefined,
    fundingRate: Number.isFinite(funding) ? funding * 100 : undefined,
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
  if (!cfg) throw new Error(`Unknown perpetual market: ${market}`);
  const errors: string[] = [];

  const tryOne = async (label: string, fn: () => Promise<PerpLiveQuote>) => {
    try {
      return await fn();
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };

  // Prefer OKX (matches chart symbols), then Binance / Gate / Bybit
  if (cfg.okxSwap) {
    const q = await tryOne("okx", () => fetchOkxSwapQuote(market, cfg.okxSwap!));
    if (q) return q;
  }
  if (cfg.binanceFutures) {
    const q = await tryOne("binance", () => fetchBinanceFuturesQuote(market, cfg.binanceFutures!));
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
  const results: PromiseSettledResult<PerpLiveQuote>[] = new Array(markets.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(6, markets.length) }, async () => {
    while (cursor < markets.length) {
      const idx = cursor++;
      const m = markets[idx]!;
      try {
        results[idx] = { status: "fulfilled", value: await fetchPerpLiveQuote(m) };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);

  const out: PerpLiveQuote[] = [];
  const errors: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if (r.status === "fulfilled") out.push(r.value);
    else
      errors.push(
        `${markets[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
      );
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
