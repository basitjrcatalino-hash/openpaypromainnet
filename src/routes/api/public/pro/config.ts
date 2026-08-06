import { createFileRoute } from "@tanstack/react-router";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-id, x-client-secret",
};

/** OpenPay Pro Connect discovery document. */
export const Route = createFileRoute("/api/public/pro/config")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const { publicOrigin } = await import("@/lib/pro-connect.server");
        const origin = publicOrigin(request);
        return Response.json(
          {
            issuer: origin,
            product: "OpenPay Pro Connect",
            authorization_endpoint: `${origin}/pro/authorize`,
            token_endpoint: `${origin}/api/public/pro/oauth/token`,
            userinfo_endpoint: `${origin}/api/public/pro/user/me`,
            balance_endpoint: `${origin}/api/public/pro/user/balance`,
            charges_endpoint: `${origin}/api/public/pro/charges`,
            checkout_url_template: `${origin}/pro/checkout/{charge_id}`,
            scopes_supported: ["profile", "balance", "payments"],
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code"],
            currency: "OUSD",
            docs: `${origin}/docs/integrations`,
          },
          { headers: CORS },
        );
      },
    },
  },
});
