import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

import { creditBanxaTopupOrder } from "@/lib/banxa-credit.server";
import { isBanxaOrderComplete } from "@/lib/banxa.server";

/**
 * Banxa Hosted Checkout webhook.
 * Docs: https://docs.banxa.com/products/hosted-checkout/docs/transaction-lifecycle/webhooks
 *
 * Configure in Banxa Partner Dashboard → webhook URL:
 *   https://<host>/api/public/banxa-webhook
 *
 * Optional HMAC: BANXA_WEBHOOK_SECRET (raw body HMAC-SHA256 hex, header Banxa-Signature / X-Banxa-Signature).
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "content-type, banxa-signature, x-banxa-signature, authorization",
} as const;

function log(level: "info" | "warn" | "error", msg: string, extra?: unknown) {
  // eslint-disable-next-line no-console
  console[level](`[banxa-webhook] ${msg}`, extra ?? "");
}

function verifyBanxaWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): boolean {
  if (!secret) return true; // optional until Banxa shares signing details
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = header.replace(/^sha256=/i, "").trim();
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(given, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return expected === given;
  }
}

type BanxaWebhookPayload = {
  order_id?: string;
  status?: string;
  external_id?: string | null;
  order_type?: string;
  fiat_amount?: string | number;
  fiat_currency?: string;
  crypto_amount?: string | number;
  usd_exchange_rate?: string | number;
  payment_method?: string;
  metadata?: unknown;
};

export const Route = createFileRoute("/api/public/banxa-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const raw = await request.text();
        const secret = process.env.BANXA_WEBHOOK_SECRET?.trim() || "";
        const sig =
          request.headers.get("banxa-signature") ||
          request.headers.get("x-banxa-signature") ||
          request.headers.get("Banxa-Signature");

        if (secret && !verifyBanxaWebhookSignature(raw, sig, secret)) {
          log("warn", "invalid signature");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        let payload: BanxaWebhookPayload;
        try {
          payload = JSON.parse(raw) as BanxaWebhookPayload;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        const orderId = payload.order_id;
        const status = payload.status;
        if (!orderId) {
          return new Response(JSON.stringify({ error: "Missing order_id" }), {
            status: 400,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        if (!isBanxaOrderComplete(status)) {
          log("info", `ignored status=${status} order=${orderId}`);
          // Always 200 so Banxa does not retry forever for intermediate states
          return new Response(JSON.stringify({ ok: true, ignored: true }), {
            status: 200,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        let userId: string | null = null;
        let walletId: string | null = null;
        let fiatAmount = Number(payload.fiat_amount ?? 0);

        const { data: ord } = await supabaseAdmin
          .from("banxa_topup_orders")
          .select("user_id, wallet_id, fiat_amount, external_order_id, credited")
          .or(
            [
              `banxa_order_id.eq.${orderId}`,
              payload.external_id
                ? `external_order_id.eq.${payload.external_id}`
                : null,
            ]
              .filter(Boolean)
              .join(","),
          )
          .maybeSingle();

        if (ord) {
          if (ord.credited) {
            return new Response(
              JSON.stringify({ ok: true, alreadyCredited: true }),
              {
                status: 200,
                headers: { "content-type": "application/json", ...CORS },
              },
            );
          }
          userId = ord.user_id;
          walletId = ord.wallet_id;
          fiatAmount = Number(ord.fiat_amount || fiatAmount);
        }

        // Fallback: external_id = ousd_{walletId}_{ts}
        if (!userId && payload.external_id) {
          const m = /^ousd_([0-9a-f-]{36})_/i.exec(payload.external_id);
          if (m) {
            walletId = m[1];
            const { data: w } = await supabaseAdmin
              .from("wallets")
              .select("id, user_id")
              .eq("id", walletId)
              .maybeSingle();
            userId = w?.user_id ?? null;
          }
        }

        if (!userId) {
          log("warn", "no user mapping", { orderId, external: payload.external_id });
          return new Response(JSON.stringify({ error: "Unknown order" }), {
            status: 404,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        try {
          const result = await creditBanxaTopupOrder({
            banxaOrderId: orderId,
            externalOrderId: payload.external_id ?? ord?.external_order_id,
            userId,
            walletId,
            fiatAmount,
            cryptoAmount: payload.crypto_amount
              ? Number(payload.crypto_amount)
              : null,
            usdExchangeRate: payload.usd_exchange_rate
              ? Number(payload.usd_exchange_rate)
              : null,
          });
          log("info", `credited order=${orderId}`, result);
          return new Response(JSON.stringify({ ...result }), {
            status: 200,
            headers: { "content-type": "application/json", ...CORS },
          });
        } catch (err) {
          log("error", (err as Error).message);
          return new Response(
            JSON.stringify({ error: (err as Error).message }),
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
