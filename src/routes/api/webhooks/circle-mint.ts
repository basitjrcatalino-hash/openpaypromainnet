/**
 * Circle Mint payments webhook — /api/webhooks/circle-mint
 *
 * Listens for payment settlement notifications and credits OUSD.
 * Reconciles via paymentIntentId → circle_mint_deposits.
 *
 * Docs: https://developers.circle.com/circle-mint/howtos/receive-stablecoin-payin
 */

import { createFileRoute } from "@tanstack/react-router";
import { verifyCircleWebhook } from "@/lib/circle";
import {
  getCirclePayment,
  isPaymentSettled,
  listCirclePayments,
  type CircleCryptoPayment,
} from "@/lib/circle-mint.server";
import { creditCircleMintPayment } from "@/lib/circle-mint-credit.server";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "content-type, x-circle-signature, x-circle-key-id, X-Circle-Signature, X-Circle-Key-Id",
} as const;

function jsonOk(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

function asPayment(data: Record<string, unknown>): CircleCryptoPayment | null {
  const id = data.id ? String(data.id) : "";
  if (!id) return null;
  return {
    id,
    type: data.type ? String(data.type) : "payment",
    status: data.status ? String(data.status) : undefined,
    amount: data.amount as CircleCryptoPayment["amount"],
    settlementAmount: data.settlementAmount as CircleCryptoPayment["settlementAmount"],
    paymentIntentId: data.paymentIntentId ? String(data.paymentIntentId) : undefined,
    transactionHash: data.transactionHash ? String(data.transactionHash) : undefined,
    depositAddress: data.depositAddress as CircleCryptoPayment["depositAddress"],
  };
}

export const Route = createFileRoute("/api/webhooks/circle-mint")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature =
          request.headers.get("x-circle-signature") ||
          request.headers.get("X-Circle-Signature");
        const keyId =
          request.headers.get("x-circle-key-id") ||
          request.headers.get("X-Circle-Key-Id");

        const skip =
          String(process.env.CIRCLE_WEBHOOK_SKIP_VERIFY || "").toLowerCase() === "true" ||
          process.env.CIRCLE_WEBHOOK_SKIP_VERIFY === "1";

        if (!skip && !verifyCircleWebhook(raw, signature, keyId)) {
          return jsonOk({ error: "Invalid signature" }, 401);
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return jsonOk({ error: "Invalid JSON" }, 400);
        }

        const eventType = String(
          payload.notificationType || payload.type || "",
        ).toLowerCase();
        const data = (payload.notification || payload.data || payload) as Record<
          string,
          unknown
        >;

        // payments notifications
        const looksLikePayment =
          eventType.includes("payment") ||
          data.paymentIntentId != null ||
          String(data.type || "") === "payment";

        if (!looksLikePayment) {
          return jsonOk({ ignored: true, eventType });
        }

        let payment = asPayment(data);
        if (payment?.id && !isPaymentSettled(payment)) {
          try {
            payment = await getCirclePayment(payment.id);
          } catch {
            /* keep payload payment */
          }
        }

        if (!payment?.paymentIntentId && payment?.id) {
          try {
            payment = await getCirclePayment(payment.id);
          } catch {
            /* ignore */
          }
        }

        const intentId = payment?.paymentIntentId
          ? String(payment.paymentIntentId)
          : data.paymentIntentId
            ? String(data.paymentIntentId)
            : "";

        if (!intentId) {
          return jsonOk({ ignored: true, reason: "no paymentIntentId" });
        }

        // If notification only has intent, list payments
        if (!payment || !isPaymentSettled(payment)) {
          const listed = await listCirclePayments({
            paymentIntentId: intentId,
            pageSize: 20,
          });
          payment = listed.find(isPaymentSettled) || payment;
        }

        if (!payment || !isPaymentSettled(payment)) {
          return jsonOk({ ok: true, pending: true, intentId });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: row } = await supabaseAdmin
          .from("circle_mint_deposits")
          .select("*")
          .eq("payment_intent_id", intentId)
          .maybeSingle();

        if (!row) {
          return jsonOk({ ok: true, unmatched: true, intentId });
        }

        if (row.status === "credited") {
          return jsonOk({ ok: true, alreadyCredited: true });
        }

        const credited = await creditCircleMintPayment({
          userId: String(row.user_id),
          walletId: String(row.wallet_id),
          payment,
          expectedAmount: Number(row.expected_amount),
        });

        return jsonOk({
          ok: true,
          credited: !credited.alreadyCredited,
          amount: credited.amount,
          paymentId: credited.paymentId,
        });
      },
    },
  },
});
