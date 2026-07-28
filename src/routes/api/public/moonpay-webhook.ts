import { createFileRoute } from "@tanstack/react-router";
import {
  creditMoonPayWebhookTopup,
  verifyMoonPayWebhookSignature,
  type MoonPayWebhookEvent,
} from "@/lib/moonpay-webhook.server";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "content-type, moonpay-signature-v2, moonpay-signature",
} as const;

function log(level: "info" | "warn" | "error", msg: string, extra?: unknown) {
  // eslint-disable-next-line no-console
  console[level](`[moonpay-webhook] ${msg}`, extra ?? "");
}

export const Route = createFileRoute("/api/public/moonpay-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const raw = await request.text();
        const secret =
          process.env.MOONPAY_WEBHOOK_KEY ||
          process.env.MOONPAY_WEBHOOK_SECRET ||
          "";
        const sig =
          request.headers.get("moonpay-signature-v2") ||
          request.headers.get("Moonpay-Signature-V2");

        if (!secret) {
          log("error", "MOONPAY_WEBHOOK_KEY not configured");
          return new Response(JSON.stringify({ error: "Webhook not configured" }), {
            status: 503,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        if (!verifyMoonPayWebhookSignature(raw, sig, secret)) {
          log("warn", "invalid signature");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        let payload: MoonPayWebhookEvent;
        try {
          payload = JSON.parse(raw) as MoonPayWebhookEvent;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        const type = String(payload.type || "");
        const data = payload.data ?? {};
        const status = String(data.status || "").toLowerCase();
        const transactionId = data.id;
        const userId = data.externalCustomerId;
        const amount = Number(data.baseCurrencyAmount);

        // Only credit on completed buy updates / creates
        const isComplete =
          status === "completed" &&
          (/transaction_updated|transaction_created|transaction\.updated|transaction\.created/i.test(
            type,
          ) ||
            !type);

        if (!isComplete) {
          log("info", `ignored type=${type} status=${status}`);
          return new Response(JSON.stringify({ ok: true, ignored: true }), {
            status: 200,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        if (!transactionId || !userId || !(amount >= 1)) {
          log("warn", "missing fields", { transactionId, userId, amount });
          return new Response(JSON.stringify({ error: "Missing credit fields" }), {
            status: 400,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        try {
          const result = await creditMoonPayWebhookTopup({
            transactionId,
            amount,
            userId,
            externalTransactionId: data.externalTransactionId,
          });
          log(
            "info",
            `credited amount=${result.amount} already=${result.alreadyCredited} tx=${transactionId}`,
          );
          return new Response(JSON.stringify({ ...result }), {
            status: 200,
            headers: { "content-type": "application/json", ...CORS },
          });
        } catch (err) {
          log("error", "credit failed", (err as Error).message);
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
