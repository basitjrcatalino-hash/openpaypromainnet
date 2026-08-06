import { createFileRoute } from "@tanstack/react-router";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-client-id, x-client-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/** POST /api/public/pro/charges/:id/cancel — cancel an unpaid charge. */
export const Route = createFileRoute("/api/public/pro/charges/$id/cancel")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request, params }) => {
        const {
          readClientCredentials,
          authenticateApp,
          cancelCharge,
          serializeCharge,
          publicOrigin,
        } = await import("@/lib/pro-connect.server");
        let body: Record<string, unknown> = {};
        try {
          const raw = await request.text();
          if (raw) {
            try {
              body = JSON.parse(raw) as Record<string, unknown>;
            } catch {
              body = Object.fromEntries(new URLSearchParams(raw));
            }
          }
        } catch {
          body = {};
        }
        try {
          const { clientId, clientSecret } = readClientCredentials(request, body);
          const app = await authenticateApp(clientId, clientSecret);
          const charge = await cancelCharge(app, params.id);
          return json(serializeCharge(charge, publicOrigin(request)));
        } catch (e) {
          const msg = (e as Error).message || "error";
          const status =
            msg === "invalid_client" ? 401 : msg === "not_found" ? 404 : 400;
          return json({ error: msg }, status);
        }
      },
    },
  },
});
