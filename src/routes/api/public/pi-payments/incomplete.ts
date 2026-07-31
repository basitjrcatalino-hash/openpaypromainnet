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
            const { fetchMajorUsdPrices, ousdFromPiAmount } = await import("@/lib/ledger-majors");
            const piAmount = Number(payment.amount);
            const prices = await fetchMajorUsdPrices(["pi"]);
            const ousdAmount = ousdFromPiAmount(piAmount, prices.pi);
            const { data: existing } = await admin
              .from("pi_payments").select("status").eq("payment_id", paymentId).maybeSingle();

            if (existing?.status !== "completed") {
              const product = payment.metadata?.product;
              const { fetchActiveWallet } = await import("@/lib/wallet-utils");

              if (product === "ousd_donate") {
                const { creditPlatformFeeOusd } = await import("@/lib/platform-treasury");
                const donor = await fetchActiveWallet<{ id: string }>(admin, userId);
                const credited = await creditPlatformFeeOusd(admin, {
                  amount: ousdAmount,
                  memo: `Donate · Pi (recovered) · ${piAmount} π @ $${prices.pi} → ${ousdAmount} OUSD · ${payment.memo ?? paymentId}`,
                  sourceWalletId: donor?.id ?? null,
                  counterparty: `pi-donate:${paymentId}`,
                });
                if (credited.ok) {
                  await admin.from("pi_payments").upsert(
                    {
                      user_id: userId,
                      payment_id: paymentId,
                      txid: useTxid,
                      pi_amount: piAmount,
                      ousd_credited: ousdAmount,
                      memo: payment.memo,
                      metadata: {
                        ...(payment.metadata as Record<string, unknown>),
                        piUsdPrice: prices.pi,
                        ousdGross: ousdAmount,
                      },
                      status: "completed",
                      completed_at: new Date().toISOString(),
                    },
                    { onConflict: "payment_id" },
                  );
                }
              } else {
                const wallet = await fetchActiveWallet<{ id: string; ousd_balance?: number | null }>(
                  admin,
                  userId,
                );
                if (wallet) {
                  const { creditTopupWithFee } = await import("@/lib/topup-fee");
                  const credited = await creditTopupWithFee({
                    client: admin,
                    admin,
                    userWalletId: wallet.id,
                    grossAmount: ousdAmount,
                    counterparty: `pi:${paymentId}`,
                    txHash: useTxid,
                    memo: `Pi Network top-up (recovered) · ${piAmount} π @ $${prices.pi} → ${ousdAmount} OUSD · ${payment.memo ?? paymentId}`,
                  });
                  await admin.from("pi_payments").upsert(
                    {
                      user_id: userId,
                      payment_id: paymentId,
                      txid: useTxid,
                      pi_amount: piAmount,
                      ousd_credited: credited.netAmount,
                      memo: payment.memo,
                      metadata: {
                        ...(payment.metadata as Record<string, unknown>),
                        piUsdPrice: prices.pi,
                        ousdGross: ousdAmount,
                      },
                      status: "completed",
                      completed_at: new Date().toISOString(),
                    },
                    { onConflict: "payment_id" },
                  );
                }
              }
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
