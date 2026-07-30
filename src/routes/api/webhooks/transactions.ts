import { createFileRoute } from "@tanstack/react-router";

/**
 * Supabase Database Webhook target (optional):
 * Table `transactions` → INSERT → POST this URL with service secret.
 * Header: `x-webhook-secret: ${TX_WEBHOOK_SECRET}`
 */
export const Route = createFileRoute("/api/webhooks/transactions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const secret = process.env.TX_WEBHOOK_SECRET?.trim();
          const hdr = request.headers.get("x-webhook-secret") || "";
          if (!secret) {
            return Response.json({ error: "Webhook not configured" }, { status: 503 });
          }
          if (hdr !== secret) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }


          const payload = (await request.json()) as {
            type?: string;
            record?: Record<string, unknown>;
            wallet_id?: string;
          };
          const tx = (payload.record || payload) as Record<string, unknown>;
          const walletId = String(tx.wallet_id || payload.wallet_id || "");
          if (!walletId || !tx.id) {
            return Response.json({ error: "Missing wallet_id or id" }, { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { notifyWalletTransaction } = await import("@/lib/tx-alerts.server");
          await notifyWalletTransaction(supabaseAdmin as never, walletId, {
            id: String(tx.id),
            type: String(tx.type ?? "activity"),
            token_symbol: (tx.token_symbol as string) ?? null,
            amount: tx.amount as number,
            memo: (tx.memo as string) ?? null,
            counterparty: (tx.counterparty as string) ?? null,
            status: (tx.status as string) ?? null,
            created_at: (tx.created_at as string) ?? null,
            wallet_id: walletId,
          });

          return Response.json({ ok: true });
        } catch (err) {
          console.error("[tx webhook]", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
