import { verifyChainTransfer, type ChainConfig, type TokenConfig } from "./chain-verify.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Admin;
}

export async function logDepositAudit(
  depositId: string | null,
  action: string,
  detail: Record<string, unknown> = {},
  actorId: string | null = null,
) {
  const db = await admin();
  await db.from("deposit_audit_logs").insert({
    deposit_id: depositId,
    action,
    detail: detail as any,
    actor_id: actorId,
  } as any);
}

export async function getActiveWallet(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("wallets")
    .select("id, user_id, address, ousd_balance")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as { id: string; user_id: string; address: string; ousd_balance: number } | null;
}

/** Credits a confirmed deposit exactly once (idempotent on deposits.status). */
export async function creditDeposit(depositId: string) {
  const db = await admin();
  const { data: dep } = await db.from("deposits").select("*").eq("id", depositId).maybeSingle();
  if (!dep) throw new Error("Deposit not found");
  if (dep.status === "credited") return { credited: false, alreadyCredited: true };

  const wallet = dep.wallet_id
    ? ((
        await db.from("wallets").select("id, user_id, address, ousd_balance").eq("id", dep.wallet_id).maybeSingle()
      ).data as any)
    : await getActiveWallet(dep.user_id);
  if (!wallet) throw new Error("No wallet found for this user");

  const { data: token } = dep.token_id
    ? await db.from("deposit_tokens").select("*").eq("id", dep.token_id).maybeSingle()
    : { data: null as any };

  const rate = Number(token?.usd_rate ?? 0) || 1;
  const gross = Number(dep.amount) * rate;
  const feeBps = Number(token?.deposit_fee_bps ?? 0);
  const fee = Math.max(0, (gross * feeBps) / 10000);
  const net = Math.max(0, gross - fee);

  const { data: tx, error: txErr } = await db
    .from("transactions")
    .insert({
      wallet_id: wallet.id,
      type: "receive",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty: dep.from_address ?? dep.chain_key,
      amount: net,
      usd_value: net,
      tx_hash: dep.tx_hash,
      memo: `Crypto deposit · ${dep.amount} ${dep.token_symbol} on ${dep.chain_key}`,
    } as any)
    .select("id")
    .single();
  if (txErr) throw new Error(txErr.message);

  await db
    .from("wallets")
    .update({ ousd_balance: Number(wallet.ousd_balance ?? 0) + net })
    .eq("id", wallet.id);

  const { data: ledger } = await db
    .from("ledger_entries")
    .select("id")
    .eq("tx_id", tx.id)
    .maybeSingle();

  await db
    .from("deposits")
    .update({
      status: "credited",
      credited_amount: net,
      fee_amount: fee,
      usd_value: gross,
      transaction_id: tx.id,
      ledger_entry_id: ledger?.id ?? null,
      credited_at: new Date().toISOString(),
    } as any)
    .eq("id", depositId);

  await db.from("ot_notifications").insert({
    user_id: dep.user_id,
    title: "Deposit credited",
    body: `${dep.amount} ${dep.token_symbol} received on ${dep.chain_key} — ${net.toFixed(2)} OUSD credited.`,
    href: "/deposit",
  } as any);

  await logDepositAudit(depositId, "credited", { net, fee, gross });
  return { credited: true, net, fee };
}

/** Re-checks a pending deposit against the blockchain and advances its state. */
export async function syncDeposit(depositId: string) {
  const db = await admin();
  const { data: dep } = await db.from("deposits").select("*").eq("id", depositId).maybeSingle();
  if (!dep) throw new Error("Deposit not found");
  if (dep.status === "credited" || dep.status === "rejected") return { status: dep.status };

  const { data: chain } = await db.from("deposit_chains").select("*").eq("id", dep.chain_id!).maybeSingle();
  const { data: token } = await db.from("deposit_tokens").select("*").eq("id", dep.token_id!).maybeSingle();
  if (!chain || !token) throw new Error("Chain or token configuration missing");
  if (chain.maintenance_mode) return { status: dep.status, paused: true };

  const result = await verifyChainTransfer({
    chain: chain as unknown as ChainConfig,
    token: token as unknown as TokenConfig,
    txHash: dep.tx_hash,
    toAddress: dep.to_address,
  });

  if (!result.found) {
    await db.from("deposits").update({ status: "pending", confirmations: 0 } as any).eq("id", depositId);
    return { status: "pending", confirmations: 0 };
  }
  if (result.failed) {
    await db
      .from("deposits")
      .update({ status: "failed", error: result.reason ?? "Verification failed" } as any)
      .eq("id", depositId);
    await logDepositAudit(depositId, "failed", { reason: result.reason });
    return { status: "failed", error: result.reason };
  }

  const required = Number(chain.required_confirmations ?? 12);
  const patch: Record<string, unknown> = {
    amount: result.amount,
    from_address: result.from,
    block_number: result.blockNumber,
    confirmations: result.confirmations,
    required_confirmations: required,
  };

  if (result.confirmations < required) {
    patch.status = "confirming";
    await db.from("deposits").update(patch as any).eq("id", depositId);
    return { status: "confirming", confirmations: result.confirmations, required };
  }

  if (Number(token.min_deposit ?? 0) > 0 && result.amount < Number(token.min_deposit)) {
    patch.status = "failed";
    patch.error = `Below the ${token.min_deposit} ${token.symbol} minimum`;
    await db.from("deposits").update(patch as any).eq("id", depositId);
    return { status: "failed", error: patch.error };
  }

  patch.status = "confirmed";
  patch.confirmed_at = new Date().toISOString();
  await db.from("deposits").update(patch as any).eq("id", depositId);
  const credited = await creditDeposit(depositId);
  return { status: "credited", confirmations: result.confirmations, ...credited };
}
