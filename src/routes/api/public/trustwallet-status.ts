import { createFileRoute } from "@tanstack/react-router";
import { trustWalletConfigured } from "@/lib/trustwallet.server";

/** Public health for Trust Wallet API credentials (no secrets returned). */
export const Route = createFileRoute("/api/public/trustwallet-status")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          configured: trustWalletConfigured(),
          base: "https://tws.trustwallet.com",
          docs: "https://portal.trustwallet.com/dashboard/docs",
        });
      },
    },
  },
});
