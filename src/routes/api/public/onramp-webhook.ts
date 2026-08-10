import { createFileRoute } from "@tanstack/react-router";

import { creditOnrampOrder } from "@/lib/onramp-credit.server";
import { isOnrampOrderComplete, verifyOnrampWebhook } from "@/lib/onramp.server";
import { parseWalletIdFromOnrampMerchantId } from "@/lib/onramp";

/**
 * Onramp.money webhook — credits OUSD when an on-ramp order completes.
 * Configure in the Onramp merchant dashboard:
 *   https://<host>/api/public/onramp-webhook
 * Optional HMAC: ONRAMP_WEBHOOK_SECRET (raw-body HMAC, header X-Onramp-Signature).
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "content-type, x-onramp-signature, onramp-signature, authorization",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

type OnrampWebhookPayload = {
  orderId?: string | number;
  status?: string | number;
  merchantRecognitionId?: string;
  fiatAmount?: string | number;
  actualQuantity?: string | number;
  coinAmount?: string | number;
  coinCode?: string;
  type?: string;
  data?: Record<string, unknown>;
};

export const Route = createFileRoute("/api/public/onramp-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig =
          request.headers.get("x-onramp-signature") ||
          request.headers.get("onramp-signature");
        if (!verifyOnrampWebhook(raw, sig)) {
          return json({ error: "Invalid signature" }, 401);
        }

        let parsed: OnrampWebhookPayload;
        try {
          parsed = JSON.parse(raw) as OnrampWebhookPayload;
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const p = { ...(parsed.data as OnrampWebhookPayload | undefined), ...parsed };

        const merchantId = p.merchantRecognitionId;
        const orderId = String(p.orderId ?? merchantId ?? "");
        if (!orderId) return json({ error: "Missing orderId" }, 400);

        if (!isOnrampOrderComplete(p.status)) {
          return json({ ok: true, ignored: true, status: p.status ?? null });
        }

        const walletId = parseWalletIdFromOnrampMerchantId(merchantId);
        if (!walletId) return json({ error: "Unknown merchantRecognitionId" }, 404);

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data: wallet } = await supabaseAdmin
          .from("wallets")
          .select("id, user_id")
          .eq("id", walletId)
          .maybeSingle();
        if (!wallet?.user_id) return json({ error: "Wallet not found" }, 404);

        try {
          const result = await creditOnrampOrder({
            orderId,
            merchantRecognitionId: merchantId ?? null,
            userId: wallet.user_id,
            walletId,
            fiatAmount: p.fiatAmount != null ? Number(p.fiatAmount) : null,
            coinAmount:
              p.actualQuantity != null
                ? Number(p.actualQuantity)
                : p.coinAmount != null
                  ? Number(p.coinAmount)
                  : null,
          });
          return json(result);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[onramp-webhook]", (err as Error).message);
          return json({ error: (err as Error).message }, 500);
        }
      },
    },
  },
});
