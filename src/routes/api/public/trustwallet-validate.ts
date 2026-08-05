import { createFileRoute } from "@tanstack/react-router";
import {
  trustWalletConfigured,
  trustWalletValidateAddress,
} from "@/lib/trustwallet.server";

/** GET ?address=&asset_id=&type= — address / tx risk validation. */
export const Route = createFileRoute("/api/public/trustwallet-validate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          if (!trustWalletConfigured()) {
            return Response.json(
              { configured: false, error: "not_configured" },
              { status: 503 },
            );
          }
          const sp = new URL(request.url).searchParams;
          const address = sp.get("address")?.trim() || "";
          if (!address) {
            return Response.json({ error: "address required" }, { status: 400 });
          }
          const type = sp.get("type");
          const res = await trustWalletValidateAddress({
            address,
            asset_id: sp.get("asset_id") || undefined,
            type:
              type === "transaction" || type === "address" ? type : "address",
          });
          if (!res.ok) {
            return Response.json(
              { configured: true, error: res.error, data: res.data },
              { status: 502 },
            );
          }
          return Response.json({ configured: true, ...res.data });
        } catch (err) {
          console.error("[trustwallet-validate]", err);
          return Response.json(
            { error: (err as Error).message || "validate failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
