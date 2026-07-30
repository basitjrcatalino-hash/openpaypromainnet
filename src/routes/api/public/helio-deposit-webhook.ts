import { createFileRoute } from "@tanstack/react-router";
import {
  creditHelioDepositWebhookTopup,
  helioWebhookAuthOk,
  verifyHelioWebhookSignature,
  type HelioDepositWebhookPayload,
} from "@/lib/helio-deposit-webhook.server";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "content-type, authorization, x-signature, x-transaction-id",
} as const;

function log(level: "info" | "warn" | "error", msg: string, extra?: unknown) {
  // eslint-disable-next-line no-console
  console[level](`[helio-deposit-webhook] ${msg}`, extra ?? "");
}

export const Route = createFileRoute("/api/public/helio-deposit-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const raw = await request.text();
        const sharedToken =
          process.env.HELIO_WEBHOOK_SHARED_TOKEN?.trim() ||
          process.env.HELIO_WEBHOOK_SECRET?.trim() ||
          "";

        if (!sharedToken) {
          log("error", "HELIO_WEBHOOK_SHARED_TOKEN not configured");
          return new Response(JSON.stringify({ error: "Webhook not configured" }), {
            status: 503,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        const sig =
          request.headers.get("x-signature") ||
          request.headers.get("X-Signature");
        const auth = request.headers.get("authorization");

        if (!helioWebhookAuthOk(auth, sharedToken)) {
          log("warn", "invalid Authorization bearer");
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        if (!verifyHelioWebhookSignature(raw, sig, sharedToken)) {
          log("warn", "invalid X-Signature");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        let payload: HelioDepositWebhookPayload;
        try {
          payload = JSON.parse(raw) as HelioDepositWebhookPayload;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        const event = String(payload.event || "");
        if (event !== "DEPOSIT_TX_CONFIRMED") {
          log("info", `ignored event=${event}`);
          return new Response(JSON.stringify({ ok: true, ignored: true }), {
            status: 200,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        try {
          const result = await creditHelioDepositWebhookTopup(payload);
          log(
            "info",
            `credited amount=${result.amount} already=${result.alreadyCredited} user=${result.userId}`,
          );
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "content-type": "application/json", ...CORS },
          });
        } catch (err) {
          log("error", (err as Error).message);
          return new Response(
            JSON.stringify({ error: (err as Error).message || "Credit failed" }),
            {
              status: 500,
              headers: { "content-type": "application/json", ...CORS },
            },
          );
        }
      },
    },
  },
});
