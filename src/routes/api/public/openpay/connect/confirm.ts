import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

async function authorizePartner(request: Request): Promise<{ ok: true } | Response> {
  const key =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (!key) return json({ error: "Missing Authorization Bearer or x-api-key" }, 401);

  const master =
    process.env.OPENPAY_PARTNER_API_KEY ||
    process.env.OPENPAY_API_KEY ||
    process.env.OPENPAY_TRANSFER_API_KEY ||
    process.env.LEDGER_MASTER_API_KEY;
  if (master && key === master) return { ok: true };

  // Also accept issued ledger-style keys hashed in DB (optional)
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ledger_api_keys")
      .select("id, active")
      .eq("key_hash", sha256(key))
      .eq("active", true)
      .maybeSingle();
    if (data) return { ok: true };
  } catch {
    /* service role may be missing — ignore */
  }

  return json({ error: "Invalid API key" }, 401);
}

/**
 * Legacy OpenPay → OpenPay Pro connect confirm (HMAC codes).
 * Prefer the official OAuth 2.0 flow: /connect → /oauth/token → /user/me
 * (see docs/PARTNER_TRANSFER_API.md).
 *
 * POST /api/public/openpay/connect/confirm
 * Authorization: Bearer <OPENPAY_PARTNER_API_KEY>
 */
export const Route = createFileRoute("/api/public/openpay/connect/confirm")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () =>
        json({
          service: "OpenPay Pro Connect Confirm",
          usage:
            "POST with partner API key after user consents on OpenPay. Returns a signed code for redirect_uri or for Pro completeOpenPayConnect.",
        }),
      POST: async ({ request }) => {
        try {
          const auth = await authorizePartner(request);
          if (auth instanceof Response) return auth;

          const body = (await request.json()) as {
            state?: string;
            account?: {
              account_number?: string;
              username?: string;
              name?: string;
              email?: string;
              user_id?: string;
            };
            redirect_uri?: string;
          };

          if (!body.state || !body.account) {
            return json({ error: "state and account are required" }, 400);
          }

          const { verifyConnectState, createConnectCode } = await import(
            "@/lib/openpay-connect.server"
          );
          // Validate state is still fresh (binds to a Pro user)
          verifyConnectState(body.state);
          const code = createConnectCode(body.account);

          if (body.redirect_uri) {
            const url = new URL(body.redirect_uri);
            url.searchParams.set("code", code);
            url.searchParams.set("state", body.state);
            return json({
              ok: true,
              code,
              state: body.state,
              redirect_url: url.toString(),
            });
          }

          return json({ ok: true, code, state: body.state });
        } catch (err) {
          return json({ error: (err as Error).message }, 400);
        }
      },
    },
  },
});
