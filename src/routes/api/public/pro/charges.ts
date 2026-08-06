import { createFileRoute } from "@tanstack/react-router";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-client-id, x-client-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

/**
 * POST /api/public/pro/charges — create a Pro Pay checkout (client credentials).
 * GET  /api/public/pro/charges — list charges for the app (?status=&limit=).
 */
export const Route = createFileRoute("/api/public/pro/charges")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const {
          readClientCredentials,
          authenticateApp,
          listCharges,
          serializeCharge,
          publicOrigin,
        } = await import("@/lib/pro-connect.server");
        const url = new URL(request.url);
        const body: Record<string, unknown> = {
          client_id: url.searchParams.get("client_id") ?? undefined,
          client_secret: url.searchParams.get("client_secret") ?? undefined,
        };
        try {
          const { clientId, clientSecret } = readClientCredentials(request, body);
          const app = await authenticateApp(clientId, clientSecret);
          const status = url.searchParams.get("status")?.trim() || undefined;
          const limitRaw = Number(url.searchParams.get("limit") ?? 25);
          const rows = await listCharges(app, {
            status,
            limit: Number.isFinite(limitRaw) ? limitRaw : 25,
          });
          const origin = publicOrigin(request);
          return json({
            charges: rows.map((c) => serializeCharge(c, origin)),
          });
        } catch (e) {
          const msg = (e as Error).message || "unauthorized";
          return json({ error: msg }, msg === "invalid_client" ? 401 : 400);
        }
      },
      POST: async ({ request }) => {
        const {
          readClientCredentials,
          authenticateApp,
          createCharge,
          serializeCharge,
          publicOrigin,
        } = await import("@/lib/pro-connect.server");
        const body = await parseBody(request);
        try {
          const { clientId, clientSecret } = readClientCredentials(request, body);
          const app = await authenticateApp(clientId, clientSecret);
          const amount = Number(body.amount);
          if (!(amount > 0)) {
            return json({ error: "invalid_request", message: "amount must be > 0" }, 400);
          }
          const charge = await createCharge({
            app,
            amount,
            description: body.description != null ? String(body.description) : null,
            reference: body.reference != null ? String(body.reference) : null,
            success_url: body.success_url != null ? String(body.success_url) : null,
            cancel_url: body.cancel_url != null ? String(body.cancel_url) : null,
            expires_in: body.expires_in != null ? Number(body.expires_in) : undefined,
          });
          return json(serializeCharge(charge, publicOrigin(request)), 201);
        } catch (e) {
          const msg = (e as Error).message || "error";
          const status = msg === "invalid_client" ? 401 : 400;
          return json({ error: msg }, status);
        }
      },
    },
  },
});
