import { createFileRoute } from "@tanstack/react-router";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-client-id, x-client-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/** GET /api/public/pro/charges/:id — poll charge status (client credentials). */
export const Route = createFileRoute("/api/public/pro/charges/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        const {
          readClientCredentials,
          authenticateApp,
          getCharge,
          serializeCharge,
          publicOrigin,
        } = await import("@/lib/pro-connect.server");
        try {
          const { clientId, clientSecret } = readClientCredentials(request, {});
          const app = await authenticateApp(clientId, clientSecret);
          const charge = await getCharge(params.id);
          if (!charge || charge.app_id !== app.id) {
            return json({ error: "not_found" }, 404);
          }
          return json(serializeCharge(charge, publicOrigin(request)));
        } catch (e) {
          const msg = (e as Error).message || "unauthorized";
          return json({ error: msg }, msg === "invalid_client" ? 401 : 400);
        }
      },
    },
  },
});
