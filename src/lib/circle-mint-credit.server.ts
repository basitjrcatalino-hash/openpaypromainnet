/**
 * Credit OUSD from a settled Circle Mint crypto payment.
 * Idempotent on tx_hash = circle:payment:{paymentId}
 */

import type { CircleCryptoPayment } from "@/lib/circle-mint.server";
import {
  isPaymentSettled,
  paymentUsdAmount,
} from "@/lib/circle-mint.server";

export async function creditCircleMintPayment(opts: {
  userId: string;
  walletId: string;
  payment: CircleCryptoPayment;
  expectedAmount?: number;
}): Promise<{
  ok: true;
  alreadyCredited: boolean;
  amount: number;
  paymentId: string;
}> {
  const { userId, walletId, payment, expectedAmount } = opts;
  if (!isPaymentSettled(payment)) {
    throw new Error(`Circle payment not settled (${payment.status || "unknown"})`);
  }

  const amount = paymentUsdAmount(payment);
  if (!(amount >= 0.01)) throw new Error(`Invalid Circle payment amount: ${amount}`);

  if (
    expectedAmount != null &&
    Number.isFinite(expectedAmount) &&
    Math.abs(amount - expectedAmount) > 0.02
  ) {
    // Allow slight over/under; still credit the settled amount
  }

  const paymentId = payment.id;
  if (!paymentId) throw new Error("Missing Circle payment id");

  const txHash = `circle:payment:${paymentId}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("transactions")
    .select("id, amount")
    .eq("tx_hash", txHash)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      alreadyCredited: true,
      amount: Number(existing.amount),
      paymentId,
    };
  }

  const { creditTopupWithFee } = await import("./topup-fee");
  try {
    const credited = await creditTopupWithFee({
      client: supabaseAdmin,
      admin: supabaseAdmin,
      userWalletId: walletId,
      grossAmount: amount,
      counterparty: `circle:${(payment.paymentIntentId || paymentId).slice(0, 12)}`,
      txHash,
      memo: `Circle Mint deposit · ${payment.transactionHash || paymentId}`,
    });

    await supabaseAdmin
      .from("circle_mint_deposits")
      .update({
        status: "credited",
        circle_payment_id: paymentId,
        tx_hash: payment.transactionHash || txHash,
        updated_at: new Date().toISOString(),
      })
      .eq("payment_intent_id", payment.paymentIntentId || "")
      .eq("user_id", userId);

    return {
      ok: true,
      alreadyCredited: false,
      amount: credited.netAmount,
      paymentId,
    };
  } catch (err) {
    const msg = (err as Error).message ?? "";
    if (/duplicate|unique/i.test(msg)) {
      return {
        ok: true,
        alreadyCredited: true,
        amount,
        paymentId,
      };
    }
    throw err;
  }
}
