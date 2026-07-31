import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Scan to pay — multi-chain QR top-up.
 * Admin receive wallets: Admin → Deposits (deposit_addresses).
 * On-chain verify amount + destination + TX ID → credit OUSD → OpenLedger.
 */

const SubmitSchema = z.object({
  chain_id: z.string().uuid(),
  token_id: z.string().uuid(),
  tx_hash: z.string().trim().min(16).max(120),
  /** Expected USD / token amount from Buy flow (optional match check). */
  expected_amount: z.number().positive().max(50_000).optional(),
  walletId: z.string().uuid().optional(),
});

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function isStableSymbol(symbol: string) {
  return /^(USDC|USDT|CASH|PYUSD|USDG|USD1|DAI|EURC)$/i.test(symbol.trim());
}

/**
 * Verify an on-chain payment to the admin receive address and credit OUSD.
 * Idempotent on transactions.tx_hash.
 */
export const submitScanPayTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubmitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Respect admin maintenance toggle for scan_pay rail
    const { data: methodRow } = await context.supabase
      .from("topup_methods")
      .select("enabled")
      .eq("method_key", "scan_pay")
      .maybeSingle();
    if (methodRow && methodRow.enabled === false) {
      throw new Error("Scan to pay is temporarily unavailable");
    }

    const db = await adminClient();
    const {
      verifyOnChainDeposit,
      isValidTxHash,
      logDepositEvent,
    } = await import("./deposit-gateway.server");

    const { data: chain } = await db
      .from("deposit_chains")
      .select("*")
      .eq("id", data.chain_id)
      .maybeSingle();
    if (!chain || !chain.is_enabled) throw new Error("This blockchain is not available");
    if (chain.maintenance_mode) {
      throw new Error(`${chain.name} deposits are paused for maintenance`);
    }

    const { data: token } = await db
      .from("deposit_tokens")
      .select("*")
      .eq("id", data.token_id)
      .maybeSingle();
    if (!token || token.status !== "active" || !token.deposit_enabled) {
      throw new Error("This token is not accepted");
    }
    if (token.chain_id !== chain.id) throw new Error("Token does not belong to this network");

    const txHash = data.tx_hash.trim();
    if (!isValidTxHash(chain.family, txHash)) {
      throw new Error(`That does not look like a valid ${chain.name} transaction hash`);
    }

    // Already credited via top-up path?
    const { data: existingTx } = await db
      .from("transactions")
      .select("id, amount, wallet_id")
      .eq("tx_hash", txHash)
      .maybeSingle();
    if (existingTx) {
      return {
        ok: true as const,
        alreadyCredited: true as const,
        amount: Number(existingTx.amount),
        status: "credited" as const,
        txHash,
      };
    }

    const { data: addr } = await db
      .from("deposit_addresses")
      .select("*")
      .eq("chain_id", chain.id)
      .eq("is_active", true)
      .or(`token_id.eq.${token.id},token_id.is.null`)
      .order("token_id", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (!addr?.address) {
      throw new Error(
        "No receiving wallet configured. Ask an admin to set an address in Admin → Deposits.",
      );
    }

    const probe = await verifyOnChainDeposit(chain, token, addr.address, txHash);
    if (!probe.found || probe.failed) {
      throw new Error(
        probe.reason ||
          "Transaction not found or failed — check network, TX ID, and that you sent to the OpenPay receive address.",
      );
    }
    if (probe.to && probe.to.toLowerCase() !== String(addr.address).toLowerCase()) {
      // EVM exact; Solana may use ATA — verifyOnChain already checks destination
    }
    if (!(probe.amount > 0)) throw new Error("On-chain amount is zero");

    if (
      data.expected_amount != null &&
      data.expected_amount > 0 &&
      isStableSymbol(token.symbol)
    ) {
      const tol = Math.max(0.01, data.expected_amount * 0.02);
      if (probe.amount + 1e-8 < data.expected_amount - tol) {
        throw new Error(
          `Amount mismatch: expected ~${data.expected_amount} ${token.symbol}, found ${probe.amount}`,
        );
      }
    }

    // Resolve USD value for OUSD credit
    let usdGross = probe.amount;
    if (!isStableSymbol(token.symbol)) {
      const rate = Number(token.usd_rate ?? 0);
      if (!(rate > 0)) {
        throw new Error(
          `${token.symbol} needs a USD rate in Admin → Deposits → Tokens before Scan to pay can credit OUSD`,
        );
      }
      usdGross = Math.round(probe.amount * rate * 100) / 100;
    }
    if (!(usdGross >= 0.01)) throw new Error("Credit amount too small");

    let walletId = data.walletId ?? null;
    if (walletId) {
      const { data: w } = await db
        .from("wallets")
        .select("id")
        .eq("id", walletId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!w) walletId = null;
    }
    if (!walletId) {
      const { data: w } = await db
        .from("wallets")
        .select("id")
        .eq("user_id", userId)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      walletId = w?.id ?? null;
    }
    if (!walletId) throw new Error("Active wallet not found");

    // Record deposit row for audit / OpenLedger trail
    const { data: depRow } = await db
      .from("deposits")
      .insert({
        user_id: userId,
        wallet_id: walletId,
        chain_id: chain.id,
        token_id: token.id,
        chain_key: chain.key,
        token_symbol: token.symbol,
        tx_hash: txHash,
        from_address: probe.from,
        to_address: addr.address,
        amount: probe.amount,
        block_number: probe.blockNumber,
        confirmations: probe.confirmations,
        required_confirmations: chain.required_confirmations,
        status: "confirmed",
        usd_value: usdGross,
      })
      .select("id")
      .maybeSingle();

    await logDepositEvent(
      db,
      depRow?.id ?? null,
      "scan_pay.verified",
      { ...probe, expected_amount: data.expected_amount ?? null },
      userId,
    );

    const { creditTopupWithFee } = await import("./topup-fee");
    const credited = await creditTopupWithFee({
      client: db,
      admin: db,
      userWalletId: walletId,
      grossAmount: usdGross,
      counterparty: `scan:${chain.key}:${txHash.slice(0, 12)}`,
      txHash,
      memo: `Scan to pay · ${probe.amount} ${token.symbol} on ${chain.name} → OUSD`,
    });

    // Explicit OpenLedger mirror (also covered by tx trigger when present)
    try {
      const { data: wallet } = await db
        .from("wallets")
        .select("address")
        .eq("id", walletId)
        .maybeSingle();
      await db.from("ledger_entries").insert({
        wallet_id: walletId,
        from_address: probe.from || "external",
        to_address: wallet?.address ?? addr.address,
        asset: "OUSD",
        amount: credited.netAmount,
        usd_value: credited.netAmount,
        type: "buy",
        status: "confirmed",
        tx_hash: txHash,
        memo: `Scan to pay · ${probe.amount} ${token.symbol} · ${chain.key}`,
        occurred_at: new Date().toISOString(),
      });
    } catch {
      /* non-fatal — trigger may already mirror */
    }

    if (depRow?.id) {
      await db
        .from("deposits")
        .update({
          status: "credited",
          credited_amount: credited.netAmount,
          fee_amount: credited.feeAmount,
          usd_value: usdGross,
        })
        .eq("id", depRow.id);
    }

    return {
      ok: true as const,
      alreadyCredited: false as const,
      amount: credited.netAmount,
      grossAmount: credited.grossAmount,
      feeAmount: credited.feeAmount,
      status: "credited" as const,
      txHash,
      onChainAmount: probe.amount,
      tokenSymbol: token.symbol,
      chainKey: chain.key,
    };
  });
