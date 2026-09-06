/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PI_PAYOUT_MAX_OUSD,
  PI_PAYOUT_MIN_OUSD,
  isValidPiWalletAddress,
  normalizePiWalletAddress,
} from "@/lib/pi-payout";

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

const PayoutSchema = z.object({
  to: z.string().trim().min(56).max(64),
  amount: z.number().positive(),
  memo: z.string().trim().max(28).optional().nullable(),
});

/** Whether Pi Wallet payout is configured on the server. */
export const getPiPayoutStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { readPiPayoutConfig } = await import("./pi-payout.server");
  const cfg = readPiPayoutConfig();
  return {
    configured: Boolean(cfg),
    horizon: cfg?.horizon ?? null,
    issuer: cfg?.issuer ?? null,
    min: PI_PAYOUT_MIN_OUSD,
    max: PI_PAYOUT_MAX_OUSD,
  };
});

/**
 * Debit the signed-in user's OUSD balance and pay OpenUSD on the Pi blockchain.
 * All on-chain pre-checks run before the debit; any chain failure fully refunds.
 */
export const sendOusdToPiWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PayoutSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const {
      readPiPayoutConfig,
      preflightPiPayout,
      submitPiPayout,
      PiPayoutError,
      MAINTENANCE_MSG,
    } = await import("./pi-payout.server");

    const cfg = readPiPayoutConfig();
    if (!cfg) throw new Error(MAINTENANCE_MSG);

    const dest = normalizePiWalletAddress(data.to);
    if (!isValidPiWalletAddress(dest))
      throw new Error("Enter a valid Pi Wallet address (56 characters, starts with G).");

    const amount = Number(Number(data.amount).toFixed(2));
    if (!Number.isFinite(amount) || amount < PI_PAYOUT_MIN_OUSD)
      throw new Error(`Amount must be at least ${PI_PAYOUT_MIN_OUSD} OUSD`);
    if (amount > PI_PAYOUT_MAX_OUSD)
      throw new Error(`Amount must be ${PI_PAYOUT_MAX_OUSD.toLocaleString()} OUSD or less per transfer`);

    const memo = String(data.memo || "").trim().slice(0, 28);

    // ---- On-chain pre-checks (before any debit) ----
    let net = cfg;
    try {
      const pre = await preflightPiPayout(cfg, dest, amount);
      net = pre.cfg;
    } catch (e) {
      throw new Error(
        e instanceof PiPayoutError || e instanceof Error ? e.message : MAINTENANCE_MSG,
      );
    }


    // ---- Balance check + debit ----
    const { fetchActiveWallet } = await import("./wallet-utils");
    const wallet = await fetchActiveWallet<{ id: string; address: string; ousd_balance?: number | null }>(
      supabase,
      userId,
      "id, address, ousd_balance",
    );
    if (!wallet) throw new Error("Wallet not found");

    const balance = Number(wallet.ousd_balance ?? 0);
    if (balance + 1e-9 < amount)
      throw new Error(
        `Insufficient balance. Need ${amount.toFixed(2)} OUSD, have ${balance.toFixed(2)} OUSD.`,
      );

    const { error: debitErr } = await supabase
      .from("wallets")
      .update({ ousd_balance: round8(balance - amount) })
      .eq("id", wallet.id)
      .eq("user_id", userId);
    if (debitErr) throw new Error(debitErr.message || "Could not debit wallet");

    const note = `pi_wallet:${dest}${memo ? ` · ${memo}` : ""}`;
    const { data: txRow, error: txErr } = await supabase
      .from("transactions")
      .insert({
        wallet_id: wallet.id,
        type: "send",
        status: "pending",
        token_symbol: "OUSD",
        counterparty: dest,
        amount,
        usd_value: amount,
        memo: note,
      })
      .select("id")
      .maybeSingle();

    const refund = async () => {
      await supabase
        .from("wallets")
        .update({ ousd_balance: round8(balance) })
        .eq("id", wallet.id)
        .eq("user_id", userId);
    };

    if (txErr || !txRow?.id) {
      await refund();
      throw new Error(txErr?.message || "Could not record transfer");
    }

    // ---- Submit chain payment (refund on any failure) ----
    try {
      const txid = await submitPiPayout(net, dest, amount, memo);
      await supabase
        .from("transactions")
        .update({ status: "confirmed", memo: `${note} · tx:${txid}`.slice(0, 500) })
        .eq("id", txRow.id);
      return {
        ok: true as const,
        transaction_id: txRow.id as string,
        pi_txid: txid,
        to: dest,
        amount,
        asset: "OUSD",
        horizon: net.horizon,
      };
    } catch (chainErr) {
      const reason =
        chainErr instanceof Error ? chainErr.message : MAINTENANCE_MSG;
      console.error("[pi-payout] chain submission failed", chainErr);
      await refund();
      await supabase
        .from("transactions")
        .update({ status: "failed", memo: `${note} · failed: ${reason}`.slice(0, 500) })
        .eq("id", txRow.id);
      throw new Error(reason);
    }
  });
