import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pi-payments/complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { paymentId, txid } = (await request.json()) as {
            paymentId?: string; txid?: string;
          };
          if (!paymentId || !txid) {
            return Response.json({ error: "Missing paymentId or txid" }, { status: 400 });
          }

          const { getCallerUserId, fetchPiPayment, completePiPayment, getAdmin } =
            await import("@/lib/pi-payments.server");

          const userId = await getCallerUserId(request);
          if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

          const payment = await fetchPiPayment(paymentId);
          if (payment.metadata?.supabaseUserId !== userId) {
            return Response.json({ error: "Payment does not belong to caller" }, { status: 403 });
          }
          if (payment.metadata?.product !== "ousd_topup") {
            return Response.json({ error: "Unsupported product" }, { status: 400 });
          }

          const admin = await getAdmin();
          const { data: existing } = await admin
            .from("pi_payments").select("*").eq("payment_id", paymentId).maybeSingle();
          if (existing?.status === "completed") {
            return Response.json({ ok: true, alreadyCompleted: true });
          }

          // Call Pi complete first; Pi verifies the on-chain txid.
          await completePiPayment(paymentId, txid);

          // Credit OUSD 1:1 with Pi to the user's primary wallet.
          const ousdAmount = Number(payment.amount);
          const { data: wallet } = await admin
            .from("wallets").select("*").eq("user_id", userId).limit(1).maybeSingle();
          if (!wallet) throw new Error("No wallet for user");

          const newBalance = Number(wallet.ousd_balance ?? 0) + ousdAmount;
          await admin.from("wallets").update({ ousd_balance: newBalance }).eq("id", wallet.id);

          await admin.from("transactions").insert({
            wallet_id: wallet.id,
            type: "buy",
            status: "confirmed",
            token_symbol: "OUSD",
            counterparty: `pi:${paymentId}`,
            amount: ousdAmount,
            usd_value: ousdAmount,
            tx_hash: txid,
            memo: `Pi Network top-up · ${payment.memo ?? paymentId}`,
          });

          await admin.from("pi_payments").upsert(
            {
              user_id: userId,
              payment_id: paymentId,
              txid,
              pi_amount: payment.amount,
              ousd_credited: ousdAmount,
              memo: payment.memo,
              metadata: payment.metadata as Record<string, unknown>,
              status: "completed",
              completed_at: new Date().toISOString(),
            },
            { onConflict: "payment_id" },
          );

          return Response.json({ ok: true, ousdCredited: ousdAmount });
        } catch (err) {
          console.error("[pi complete]", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
