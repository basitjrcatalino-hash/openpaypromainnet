import { createServerFn } from "@tanstack/react-start";
import { fetchAllPerpLiveQuotes, type PerpLiveQuote } from "@/lib/tradingview-perps";

/** Live perpetual marks — Binance → Gate/Bybit → CoinGecko (Binance is often geo-blocked on serverless). */
export const getPerpLiveQuotes = createServerFn({ method: "GET" }).handler(
  async (): Promise<PerpLiveQuote[]> => {
    try {
      return await fetchAllPerpLiveQuotes();
    } catch (e) {
      // Surface a clear error to the client instead of empty $0 quotes
      throw new Error(
        e instanceof Error ? e.message : "Unable to load perpetual market data",
      );
    }
  },
);
