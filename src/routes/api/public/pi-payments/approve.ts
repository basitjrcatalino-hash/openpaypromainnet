import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pi-payments/approve")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { paymentId } = (await request.json()) as { paymentId?: string };
          if (!paymentId) return Response.json({ error: "Missing paymentId" }, { status: 400 });

          const { getCallerUserId, fetchPiPayment, approvePiPayment, getAdmin } =
            await import("@/lib/pi-payments.server");

          const userId = await getCallerUserId(request);
          if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

          const payment = await fetchPiPayment(paymentId);
          if (payment.metadata?.product !== "ousd_topup" && payment.metadata?.product !== "ousd_donate") {
            return Response.json({ error: "Unsupported product" }, { status: 400 });
          }
          if (payment.metadata?.supabaseUserId !== userId) {
            return Response.json({ error: "Payment does not belong to caller" }, { status: 403 });
          }

          const admin = await getAdmin();
          await admin.from("pi_payments").upsert(
            {
              user_id: userId,
              payment_id: paymentId,
              pi_amount: payment.amount,
              memo: payment.memo,
              metadata: payment.metadata as Record<string, unknown>,
              status: "approved",
              approved_at: new Date().toISOString(),
            },
            { onConflict: "payment_id" },
          );

          await approvePiPayment(paymentId);
          return Response.json({ ok: true });
        } catch (err) {
          console.error("[pi approve]", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
