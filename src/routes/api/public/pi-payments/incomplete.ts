import { createFileRoute } from "@tanstack/react-router";

// Called from onIncompletePaymentFound. Finishes whatever stage is pending.
export const Route = createFileRoute("/api/public/pi-payments/incomplete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { paymentId, txid } = (await request.json()) as {
            paymentId?: string; txid?: string;
          };
          if (!paymentId) return Response.json({ error: "Missing paymentId" }, { status: 400 });

          const { getCallerUserId, fetchPiPayment, approvePiPayment, completePiPayment, getAdmin } =
            await import("@/lib/pi-payments.server");

          const userId = await getCallerUserId(request);
          if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

          const payment = await fetchPiPayment(paymentId);
          if (payment.metadata?.supabaseUserId !== userId) {
            return Response.json({ error: "Payment does not belong to caller" }, { status: 403 });
          }

          if (!payment.status.developer_approved) {
            await approvePiPayment(paymentId);
          }

          const useTxid = txid || payment.transaction?.txid;
          if (useTxid && !payment.status.developer_completed) {
            await completePiPayment(paymentId, useTxid);

            const admin = await getAdmin();
            const ousdAmount = Number(payment.amount);
            const { data: existing } = await admin
              .from("pi_payments").select("status").eq("payment_id", paymentId).maybeSingle();

            if (existing?.status !== "completed") {
              const { fetchActiveWallet } = await import("@/lib/wallet-utils");
              const wallet = await fetchActiveWallet<{ id: string; ousd_balance?: number | null }>(
                admin,
                userId,
              );
              if (wallet) {
                await admin.from("wallets")
                  .update({ ousd_balance: Number(wallet.ousd_balance ?? 0) + ousdAmount })
                  .eq("id", wallet.id);
                await admin.from("transactions").insert({
                  wallet_id: wallet.id,
                  type: "buy",
                  status: "confirmed",
                  token_symbol: "OUSD",
                  counterparty: `pi:${paymentId}`,
                  amount: ousdAmount,
                  usd_value: ousdAmount,
                  tx_hash: useTxid,
                  memo: `Pi Network top-up (recovered) · ${payment.memo ?? paymentId}`,
                });
              }
              await admin.from("pi_payments").upsert(
                {
                  user_id: userId,
                  payment_id: paymentId,
                  txid: useTxid,
                  pi_amount: payment.amount,
                  ousd_credited: ousdAmount,
                  memo: payment.memo,
                  metadata: payment.metadata as Record<string, unknown>,
                  status: "completed",
                  completed_at: new Date().toISOString(),
                },
                { onConflict: "payment_id" },
              );
            }
          }

          return Response.json({ ok: true });
        } catch (err) {
          console.error("[pi incomplete]", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
