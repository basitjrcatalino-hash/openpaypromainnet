import { createFileRoute } from "@tanstack/react-router";
import {
  trustWalletConfigured,
  trustWalletSearchAssets,
} from "@/lib/trustwallet.server";

/** GET ?query=&networks=&limit= — token search via Trust Wallet API. */
export const Route = createFileRoute("/api/public/trustwallet-search")({
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
          const query = sp.get("query")?.trim() || "";
          if (!query) {
            return Response.json({ error: "query required" }, { status: 400 });
          }
          const res = await trustWalletSearchAssets({
            query,
            networks: sp.get("networks") || undefined,
            limit: Number(sp.get("limit") || 20) || 20,
          });
          if (!res.ok) {
            return Response.json(
              { configured: true, docs: [], error: res.error },
              { status: 502 },
            );
          }
          return Response.json({
            configured: true,
            total: res.data.total ?? 0,
            docs: res.data.docs ?? [],
          });
        } catch (err) {
          console.error("[trustwallet-search]", err);
          return Response.json(
            { error: (err as Error).message || "search failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
