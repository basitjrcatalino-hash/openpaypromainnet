import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
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

  const { partnerKeyFromEnv } = await import("@/lib/openpay-inbound.server");
  const master = partnerKeyFromEnv();
  if (master && key === master) return { ok: true };

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
    /* ignore */
  }

  return json({ error: "Invalid API key" }, 401);
}

/**
 * OpenPay → OpenPay Pro inbound transfer
 *
 * After an OpenPay user pays/sends to the partner tag with note pro_xfer:@user:ref,
 * OpenPay (or your backend) calls this to credit the Pro wallet.
 *
 * POST /api/public/openpay/inbound
 * Authorization: Bearer opk_live_…
 * Body: {
 *   to: "@alice" | "0x…" | "uid_<uuid>" | "<uuid>",
 *   amount: 25.00,
 *   openpay_tx_id: "required-unique",
 *   note?: "pro_xfer:0x…:ref" | "pro_xfer:@alice:ref",
 *   from_username?: string,
 *   from_account?: string
 * }
 */
export const Route = createFileRoute("/api/public/openpay/inbound")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () =>
        json({
          service: "OpenPay → OpenPay Pro inbound transfer",
          usage:
            "POST with partner API key after OpenPay user sends OUSD destined for a Pro user. Note format: pro_xfer:@username:ref",
          docs: "/docs/openpay#openpay-to-pro",
        }),
      POST: async ({ request }) => {
        try {
          const auth = await authorizePartner(request);
          if (auth instanceof Response) return auth;

          const body = (await request.json()) as {
            to?: string;
            amount?: number;
            openpay_tx_id?: string;
            note?: string;
            from_username?: string;
            from_account?: string;
          };

          const amount = Number(body.amount);
          if (!body.to || !(amount > 0)) {
            return json({ error: "to and amount are required" }, 400);
          }
          if (!body.openpay_tx_id) {
            return json({ error: "openpay_tx_id is required for idempotency" }, 400);
          }

          const { parseInboundNote, creditProUserFromOpenPay } = await import(
            "@/lib/openpay-inbound.server"
          );
          const parsed = body.note ? parseInboundNote(body.note) : null;
          const toHandle = parsed?.handle || body.to;

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const result = await creditProUserFromOpenPay({
            admin: supabaseAdmin,
            toHandle,
            amount,
            openpayTxId: body.openpay_tx_id,
            note: body.note,
            fromLabel: body.from_username
              ? `@${body.from_username.replace(/^@+/, "")}`
              : body.from_account,
          });

          return json({
            ok: true,
            ...result,
            to: toHandle,
            amount,
            openpay_tx_id: body.openpay_tx_id,
          });
        } catch (err) {
          return json({ error: (err as Error).message }, 400);
        }
      },
    },
  },
});
