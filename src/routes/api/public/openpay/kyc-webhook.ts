import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "content-type, x-openpay-signature, x-openpay-event",
} as const;

function log(level: "info" | "warn" | "error", msg: string, extra?: unknown) {
  // eslint-disable-next-line no-console
  console[level](`[openpay-kyc-webhook] ${msg}`, extra ?? "");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/openpay/kyc-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-openpay-signature");
        const eventHeader = request.headers.get("x-openpay-event");

        const {
          verifyOpenPayKycWebhook,
          partnerStatusFromEventType,
          mapPartnerStatusToPro,
        } = await import("@/lib/openpay-kyc.server");

        if (!verifyOpenPayKycWebhook(raw, sig)) {
          log("warn", "invalid signature");
          return json({ error: "Invalid signature" }, 401);
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const data = (payload.data ?? payload) as Record<string, unknown>;
        const eventType = String(payload.type ?? eventHeader ?? "");
        const partnerStatus =
          partnerStatusFromEventType(eventType) ||
          (typeof data.status === "string" ? data.status : null);

        if (!partnerStatus) {
          return json({ error: "Unknown event type" }, 400);
        }

        const externalUserId = String(
          data.external_user_id ?? data.user_id ?? "",
        ).trim();
        const applicationId = String(data.application_id ?? "").trim() || null;
        const review = (data.review ?? {}) as {
          rejection_reason?: string | null;
          admin_notes?: string | null;
        };

        if (!externalUserId && !applicationId) {
          return json({ error: "Missing external_user_id" }, 400);
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const now = new Date().toISOString();
        const proStatus = mapPartnerStatusToPro(partnerStatus);

        let userId = externalUserId;
        if (!userId && applicationId) {
          const { data: link } = await supabaseAdmin
            .from("openpay_kyc_links")
            .select("user_id")
            .eq("application_id", applicationId)
            .maybeSingle();
          userId = String(link?.user_id ?? "");
        }

        if (!userId) {
          log("warn", "no user for webhook", { applicationId, eventType });
          return json({ error: "User not found" }, 404);
        }

        const profilePatch: Record<string, unknown> = {
          kyc_status: proStatus,
          kyc_updated_at: now,
        };
        if (applicationId) profilePatch.kyc_verification_id = applicationId;
        if (proStatus === "verified") profilePatch.kyc_verified_at = now;

        const { error: profileErr } = await supabaseAdmin
          .from("profiles")
          .update(profilePatch as never)
          .eq("id", userId);

        if (profileErr) {
          log("error", "profile update failed", profileErr.message);
          return json({ error: "DB update failed" }, 500);
        }

        const { error: linkErr } = await supabaseAdmin
          .from("openpay_kyc_links")
          .upsert(
            {
              user_id: userId,
              external_ref: `pro_${userId}`,
              application_id: applicationId,
              status: partnerStatus,
              rejection_reason: review.rejection_reason ?? null,
              admin_notes: review.admin_notes ?? null,
              last_event_at: now,
              updated_at: now,
            } as never,
            { onConflict: "external_ref" },
          );

        if (linkErr) {
          log("error", "kyc link upsert failed", linkErr.message);
          return json({ error: "Link update failed" }, 500);
        }

        log("info", `updated user=${userId} status=${partnerStatus} event=${eventType}`);
        return json({ received: true, ok: true });
      },
    },
  },
});
