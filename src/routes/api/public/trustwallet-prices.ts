import { createFileRoute } from "@tanstack/react-router";
import {
  trustWalletConfigured,
  trustWalletTickers,
} from "@/lib/trustwallet.server";

/**
 * POST { currency?: "USD", assets: string[] }
 * → Trust Wallet index prices (HMAC signed server-side).
 */
export const Route = createFileRoute("/api/public/trustwallet-prices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!trustWalletConfigured()) {
            return Response.json(
              { configured: false, tickers: [], error: "not_configured" },
              { status: 503 },
            );
          }
          const body = (await request.json().catch(() => ({}))) as {
            currency?: string;
            assets?: string[];
          };
          const assets = Array.isArray(body.assets) ? body.assets.slice(0, 50) : [];
          if (!assets.length) {
            return Response.json({ error: "assets required" }, { status: 400 });
          }
          const res = await trustWalletTickers(
            assets,
            body.currency?.trim() || "USD",
          );
          if (!res.ok) {
            return Response.json(
              { configured: true, tickers: [], error: res.error },
              { status: 502 },
            );
          }
          return Response.json({ configured: true, tickers: res.tickers });
        } catch (err) {
          console.error("[trustwallet-prices]", err);
          return Response.json(
            { error: (err as Error).message || "prices failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
