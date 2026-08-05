import { createFileRoute } from "@tanstack/react-router";
import {
  trustWalletConfigured,
  trustWalletListings,
} from "@/lib/trustwallet.server";

/** GET trending / category listings from Trust Wallet. */
export const Route = createFileRoute("/api/public/trustwallet-listings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          if (!trustWalletConfigured()) {
            return Response.json(
              { configured: false, docs: [], error: "not_configured" },
              { status: 503 },
            );
          }
          const sp = new URL(request.url).searchParams;
          const res = await trustWalletListings({
            category_id: sp.get("category_id") || "trending",
            currency: sp.get("currency") || "USD",
            sort: sp.get("sort") || undefined,
            limit: Number(sp.get("limit") || 20) || 20,
            networks: sp.get("networks") || undefined,
            cursor: sp.get("cursor") || undefined,
          });
          if (!res.ok) {
            return Response.json(
              { configured: true, docs: [], error: res.error },
              { status: 502 },
            );
          }
          return Response.json({
            configured: true,
            docs: res.data.docs ?? [],
            cursor: res.data.cursor,
          });
        } catch (err) {
          console.error("[trustwallet-listings]", err);
          return Response.json(
            { error: (err as Error).message || "listings failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
