import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pi-payments/complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { paymentId, txid } = (await request.json()) as {
            paymentId?: string;
            txid?: string;
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
          const product = payment.metadata?.product;
          if (product !== "ousd_topup" && product !== "ousd_donate") {
            return Response.json({ error: "Unsupported product" }, { status: 400 });
          }

          const admin = await getAdmin();
          const { data: existing } = await admin
            .from("pi_payments")
            .select("*")
            .eq("payment_id", paymentId)
            .maybeSingle();
          if (existing?.status === "completed") {
            return Response.json({ ok: true, alreadyCompleted: true });
          }

          // Call Pi complete first; Pi verifies the on-chain txid.
          await completePiPayment(paymentId, txid);

          const { fetchActiveWallet } = await import("@/lib/wallet-utils");
          const { fetchMajorUsdPrices, ousdFromPiAmount } = await import("@/lib/ledger-majors");
          const piAmount = Number(payment.amount);
          const prices = await fetchMajorUsdPrices(["pi"]);
          const ousdAmount = ousdFromPiAmount(piAmount, prices.pi);

          let ousdCredited = ousdAmount;
          let feeAmount = 0;

          if (product === "ousd_donate") {
            const { creditPlatformFeeOusd } = await import("@/lib/platform-treasury");
            const donor = await fetchActiveWallet<{ id: string; address: string }>(admin, userId);
            const credited = await creditPlatformFeeOusd(admin, {
              amount: ousdAmount,
              memo: `Donate · Pi · ${piAmount} π @ $${prices.pi} → ${ousdAmount} OUSD · ${payment.memo ?? paymentId}`,
              sourceWalletId: donor?.id ?? null,
              counterparty: `pi-donate:${paymentId}`,
            });
            if (!credited.ok) {
              throw new Error(credited.skipped || "Could not credit donation treasury");
            }
            ousdCredited = ousdAmount;
            feeAmount = 0;
          } else {
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
              memo: `Pi Network top-up · ${piAmount} π @ $${prices.pi} → ${ousdAmount} OUSD · ${payment.memo ?? paymentId}`,
            });
            ousdCredited = credited.netAmount;
            feeAmount = credited.feeAmount;
          }

          await admin.from("pi_payments").upsert(
            {
              user_id: userId,
              payment_id: paymentId,
              txid,
              pi_amount: piAmount,
              ousd_credited: ousdCredited,
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

          return Response.json({
            ok: true,
            ousdCredited,
            feeAmount,
            donated: product === "ousd_donate",
          });
        } catch (err) {
          console.error("[pi complete]", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
