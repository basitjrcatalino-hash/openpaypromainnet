import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-piverify-signature, x-signature",
} as const;

function log(level: "info" | "warn" | "error", msg: string, extra?: unknown) {
  // eslint-disable-next-line no-console
  console[level](`[kyc-webhook] ${msg}`, extra ?? "");
}

export const Route = createFileRoute("/api/public/kyc-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-piverify-signature") ?? request.headers.get("x-signature");
        const { verifyWebhook, normalizeStatus, statusFromEventType } = await import("@/lib/piVerify.server");

        if (!verifyWebhook(raw, sig)) {
          log("warn", "invalid signature");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401, headers: { "content-type": "application/json", ...CORS },
          });
        }

        let payload: any;
        try { payload = JSON.parse(raw); } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400, headers: { "content-type": "application/json", ...CORS },
          });
        }

        // Pi Verify v1 envelope: { id, type, created_at, data: { session_id, external_user_id, status, rejection_reason } }
        const eventData = payload?.data ?? payload;
        const verificationId = eventData?.session_id ?? eventData?.verification_id ?? eventData?.id ?? payload?.id;
        const externalUserId = eventData?.external_user_id ?? eventData?.user_id;
        const status =
          statusFromEventType(payload?.type) ?? normalizeStatus(eventData?.status);
        if (!verificationId && !externalUserId) {
          return new Response(JSON.stringify({ error: "Missing session_id" }), {
            status: 400, headers: { "content-type": "application/json", ...CORS },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();
        const patch: Record<string, unknown> = { kyc_status: status, kyc_updated_at: now };
        if (status === "verified") patch.kyc_verified_at = now;

        const query = supabaseAdmin.from("profiles").update(patch as never);
        const { error } = verificationId
          ? await query.eq("kyc_verification_id", verificationId)
          : await query.eq("id", externalUserId);


        if (error) {
          log("error", "db update failed", error.message);
          return new Response(JSON.stringify({ error: "DB update failed" }), {
            status: 500, headers: { "content-type": "application/json", ...CORS },
          });
        }

        log("info", `updated status=${status} vid=${verificationId}`);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { "content-type": "application/json", ...CORS },
        });
      },
    },
  },
});
