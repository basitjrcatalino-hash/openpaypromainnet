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

          // Credit OUSD 1:1 with Pi to the user's activated wallet.
          const { fetchActiveWallet } = await import("@/lib/wallet-utils");
          const ousdAmount = Number(payment.amount);
          const wallet = await fetchActiveWallet<{ id: string; ousd_balance?: number | null }>(
            admin,
            userId,
          );
          if (!wallet) throw new Error("No active wallet for user");

          const { creditTopupWithFee } = await import("@/lib/topup-fee");
          const credited = await creditTopupWithFee({
            client: admin,
            admin,
            userWalletId: wallet.id,
            grossAmount: ousdAmount,
            counterparty: `pi:${paymentId}`,
            txHash: txid,
            memo: `Pi Network top-up · ${payment.memo ?? paymentId}`,
          });

          await admin.from("pi_payments").upsert(
            {
              user_id: userId,
              payment_id: paymentId,
              txid,
              pi_amount: payment.amount,
              ousd_credited: credited.netAmount,
              memo: payment.memo,
              metadata: payment.metadata as Record<string, unknown>,
              status: "completed",
              completed_at: new Date().toISOString(),
            },
            { onConflict: "payment_id" },
          );

          return Response.json({
            ok: true,
            ousdCredited: credited.netAmount,
            feeAmount: credited.feeAmount,
          });
        } catch (err) {
          console.error("[pi complete]", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
