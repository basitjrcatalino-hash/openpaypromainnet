/**
 * Credit OUSD after a completed Banxa Hosted Checkout buy.
 * Idempotent on tx_hash = banxa:{orderId}.
 */

export async function creditBanxaTopupOrder(opts: {
  banxaOrderId: string;
  externalOrderId?: string | null;
  userId: string;
  walletId?: string | null;
  fiatAmount: number;
  cryptoAmount?: number | null;
  usdExchangeRate?: number | null;
}): Promise<{ ok: true; alreadyCredited: boolean; amount: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const txHash = `banxa:${opts.banxaOrderId}`;
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
    };
  }

  // Prefer stablecoin received; else fiat×USD rate; else fiat (USD rails).
  let gross = 0;
  if (opts.cryptoAmount != null && opts.cryptoAmount > 0) {
    gross = opts.cryptoAmount;
  } else if (
    opts.usdExchangeRate != null &&
    opts.usdExchangeRate > 0 &&
    opts.fiatAmount > 0
  ) {
    gross = opts.fiatAmount * opts.usdExchangeRate;
  } else {
    gross = opts.fiatAmount;
  }
  gross = Math.round(Math.max(0, gross) * 100) / 100;
  if (!(gross >= 0.01)) throw new Error("Invalid Banxa credit amount");

  let walletId = opts.walletId ?? null;
  if (!walletId && opts.externalOrderId) {
    const { data: ord } = await supabaseAdmin
      .from("banxa_topup_orders")
      .select("wallet_id, credited")
      .eq("external_order_id", opts.externalOrderId)
      .maybeSingle();
    if (ord?.credited) {
      return { ok: true, alreadyCredited: true, amount: gross };
    }
    walletId = ord?.wallet_id ?? null;
  }
  if (!walletId) {
    const { data: w } = await supabaseAdmin
      .from("wallets")
      .select("id")
      .eq("user_id", opts.userId)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    walletId = w?.id ?? null;
  }
  if (!walletId) throw new Error("Wallet not found for Banxa credit");

  const { creditTopupWithFee } = await import("./topup-fee");
  const credited = await creditTopupWithFee({
    client: supabaseAdmin,
    admin: supabaseAdmin,
    userWalletId: walletId,
    grossAmount: gross,
    counterparty: `banxa:${opts.banxaOrderId.slice(0, 12)}`,
    txHash,
    memo: `Banxa top-up · ${opts.banxaOrderId}`,
  });

  await supabaseAdmin
    .from("banxa_topup_orders")
    .update({
      status: "complete",
      credited: true,
      banxa_order_id: opts.banxaOrderId,
      updated_at: new Date().toISOString(),
    })
    .or(
      [
        `banxa_order_id.eq.${opts.banxaOrderId}`,
        opts.externalOrderId
          ? `external_order_id.eq.${opts.externalOrderId}`
          : null,
      ]
        .filter(Boolean)
        .join(","),
    );

  return {
    ok: true,
    alreadyCredited: false,
    amount: credited.netAmount,
  };
}
