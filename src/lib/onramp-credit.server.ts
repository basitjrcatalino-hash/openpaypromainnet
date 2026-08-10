/**
 * Credit OUSD after a completed Onramp.money on-ramp order.
 * Idempotent on tx_hash = onramp:{orderId}.
 */

export async function creditOnrampOrder(opts: {
  orderId: string;
  merchantRecognitionId?: string | null;
  userId: string;
  walletId?: string | null;
  fiatAmount?: number | null;
  coinAmount?: number | null;
}): Promise<{ ok: true; alreadyCredited: boolean; amount: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const txHash = `onramp:${opts.orderId}`;
  const { data: existing } = await supabaseAdmin
    .from("transactions")
    .select("id, amount")
    .eq("tx_hash", txHash)
    .maybeSingle();

  if (existing) {
    return { ok: true, alreadyCredited: true, amount: Number(existing.amount) };
  }

  // Stablecoin received is the truth; fall back to fiat amount.
  let gross = 0;
  if (opts.coinAmount != null && opts.coinAmount > 0) gross = opts.coinAmount;
  else if (opts.fiatAmount != null && opts.fiatAmount > 0) gross = opts.fiatAmount;
  gross = Math.round(Math.max(0, gross) * 100) / 100;
  if (!(gross >= 0.01)) throw new Error("Invalid Onramp credit amount");

  let walletId = opts.walletId ?? null;
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
  if (!walletId) throw new Error("Wallet not found for Onramp credit");

  const { creditTopupWithFee } = await import("./topup-fee");
  const credited = await creditTopupWithFee({
    client: supabaseAdmin,
    admin: supabaseAdmin,
    userWalletId: walletId,
    grossAmount: gross,
    counterparty: `onramp:${String(opts.orderId).slice(0, 12)}`,
    txHash,
  });

  return {
    ok: true,
    alreadyCredited: false,
    amount: Number((credited as { net?: number })?.net ?? gross),
  };
}
