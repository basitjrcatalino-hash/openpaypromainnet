import { createServerFn } from "@tanstack/react-start";
import { fetchAllPerpLiveQuotes, type PerpLiveQuote } from "@/lib/tradingview-perps";

/** Live perpetual marks from Binance (BTC/ETH/SOL) and OKX/Gate (PI) — same markets as TradingView .P charts. */
export const getPerpLiveQuotes = createServerFn({ method: "GET" }).handler(
  async (): Promise<PerpLiveQuote[]> => {
    return fetchAllPerpLiveQuotes();
  },
);
