/**
 * Circle webhook endpoint — /api/webhooks/circle
 *
 * Verifies X-Circle-Signature / X-Circle-Key-Id, then handles:
 * - wallet.created
 * - transaction.created / transaction.completed
 * - deposit / inbound completions
 *
 * Dedupes by provider_tx_id / tx_hash to prevent double-credit.
 */

import { createFileRoute } from "@tanstack/react-router";
import { verifyCircleWebhook } from "@/lib/circle";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "content-type, x-circle-signature, x-circle-key-id, X-Circle-Signature, X-Circle-Key-Id",
} as const;

function log(level: "info" | "warn" | "error", msg: string, extra?: unknown) {
  // eslint-disable-next-line no-console
  console[level](`[circle-webhook] ${msg}`, extra ?? "");
}

type CircleNotification = {
  notificationType?: string;
  notification?: Record<string, unknown>;
  type?: string;
  data?: Record<string, unknown>;
};

export const Route = createFileRoute("/api/webhooks/circle")({
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

        if (!verifyCircleWebhook(raw, signature, keyId)) {
          log("warn", "invalid signature");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        let payload: CircleNotification;
        try {
          payload = JSON.parse(raw) as CircleNotification;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        const eventType = String(
          payload.notificationType || payload.type || "",
        ).toLowerCase();
        const data = (payload.notification || payload.data || {}) as Record<
          string,
          unknown
        >;

        log("info", `event=${eventType}`);

          try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          const db = supabaseAdmin as unknown as { from: (t: string) => any };

          if (eventType.includes("wallet") && eventType.includes("creat")) {
            // wallet.created — already persisted on ensureCryptoWallet; acknowledge
            return jsonOk({ handled: "wallet.created" });
          }

          const isTx =
            eventType.includes("transaction") ||
            eventType.includes("transfer") ||
            eventType.includes("deposit");

          if (!isTx) {
            return jsonOk({ ignored: true, eventType });
          }

          const state = String(data.state || data.status || "").toUpperCase();
          const providerTxId = String(data.id || data.transactionId || "");
          const txHash = data.txHash ? String(data.txHash) : null;
          const walletId = String(data.walletId || data.destinationWalletId || "");
          const amounts = data.amounts as string[] | undefined;
          const amount = Number(amounts?.[0] ?? data.amount ?? 0);
          const blockchain = String(data.blockchain || data.network || "ETH");
          const token = String(data.tokenId || data.tokenAddress || "NATIVE");

          const inbound =
            String(data.transactionType || "").toUpperCase().includes("INBOUND") ||
            String(data.operation || "").toUpperCase() === "RECEIVE" ||
            eventType.includes("deposit");

          const direction = inbound ? "deposit" : "withdraw";
          const completed =
            state === "COMPLETE" ||
            state === "COMPLETED" ||
            state === "CONFIRMED" ||
            eventType.includes("completed") ||
            eventType.includes("complete");

          if (!walletId && !providerTxId) {
            return jsonOk({ ignored: true, reason: "no wallet/tx id" });
          }

          // Find OpenPay user via Circle wallet id
          let cryptoWallet: {
            id: string;
            user_id: string;
            blockchain: string;
          } | null = null;

          if (walletId) {
            const { data: row } = await db
              .from("crypto_wallets")
              .select("id, user_id, blockchain")
              .eq("circle_wallet_id", walletId)
              .maybeSingle();
            if (row?.id && row?.user_id) {
              cryptoWallet = {
                id: String(row.id),
                user_id: String(row.user_id),
                blockchain: String(row.blockchain || blockchain),
              };
            }
          }

          if (!cryptoWallet) {
            log("warn", "wallet not found for circle id", walletId);
            return jsonOk({ ignored: true, reason: "unknown wallet" });
          }

          // Prevent duplicate deposits
          if (providerTxId) {
            const { data: dup } = await db
              .from("crypto_transactions")
              .select("id")
              .eq("provider_tx_id", providerTxId)
              .maybeSingle();
            if (dup) {
              // Update status if completed
              if (completed) {
                await db
                  .from("crypto_transactions")
                  .update({
                    status: "COMPLETE",
                    tx_hash: txHash,
                  })
                  .eq("id", (dup as { id: string }).id);
              }
              return jsonOk({ deduped: true });
            }
          }

          if (txHash) {
            const { data: dupHash } = await db
              .from("crypto_transactions")
              .select("id")
              .eq("tx_hash", txHash)
              .maybeSingle();
            if (dupHash) return jsonOk({ deduped: true, by: "tx_hash" });
          }

          const { error: insertErr } = await db
            .from("crypto_transactions")
            .insert({
              user_id: cryptoWallet.user_id,
              wallet_id: cryptoWallet.id,
              tx_hash: txHash,
              token,
              amount: Number.isFinite(amount) ? amount : 0,
              network: blockchain || cryptoWallet.blockchain,
              status: completed ? "COMPLETE" : state || "PENDING",
              direction,
              provider_tx_id: providerTxId || null,
            });

          if (insertErr && !/duplicate|unique/i.test(insertErr.message)) {
            log("error", "insert failed", insertErr.message);
            return new Response(JSON.stringify({ error: insertErr.message }), {
              status: 500,
              headers: { "content-type": "application/json", ...CORS },
            });
          }

          // Best-effort in-app notification
          if (completed && direction === "deposit") {
            try {
              await db.from("notifications").insert({
                user_id: cryptoWallet.user_id,
                title: "Crypto deposit received",
                body: `${amount} ${token} on ${blockchain}`,
                type: "deposit",
              });
            } catch {
              /* notifications table may not exist / optional */
            }
          }

          return jsonOk({
            handled: eventType,
            direction,
            completed,
          });
        } catch (err) {
          log("error", "handler failed", err);
          return new Response(
            JSON.stringify({ error: (err as Error).message || "Server error" }),
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

function jsonOk(body: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok: true, ...body }), {
    status: 200,
    headers: { "content-type": "application/json", ...CORS },
  });
}
