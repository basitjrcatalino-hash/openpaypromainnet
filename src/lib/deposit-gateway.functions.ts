import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ helpers */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin only");
  return true;
}

async function notify(db: any, userId: string, title: string, body: string) {
  try {
    await db.from("ot_notifications").insert({ user_id: userId, title, body, href: "/deposit" });
  } catch (err) {
    console.error("[deposit notify]", err);
  }
}

/* ------------------------------------------------------------- user surface */

/** Chains + tokens + receiving addresses available to users. */
export const getDepositConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const [{ data: chains }, { data: tokens }, { data: addresses }] = await Promise.all([
      db.from("deposit_chains").select("*").eq("is_enabled", true).order("sort_order"),
      db.from("deposit_tokens").select("*").eq("status", "active").order("sort_order"),
      db.from("deposit_addresses").select("*").eq("is_active", true),
    ]);
    return {
      chains: chains ?? [],
      tokens: (tokens ?? []).filter((t: any) => t.deposit_enabled),
      addresses: addresses ?? [],
      /** Credits always land in Funding wallet balances. */
      deposit_account: "funding" as const,
    };
  });

export const listMyDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("deposits")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const submitSchema = z.object({
  chain_id: z.string().uuid(),
  token_id: z.string().uuid(),
  tx_hash: z.string().trim().min(16).max(120),
});

/**
 * User reports an outgoing transfer. Everything is re-verified on-chain —
 * the submitted values are only used to locate the transaction.
 */
export const submitDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const {
      verifyOnChainDeposit,
      isValidTxHash,
      logDepositEvent,
      syncDeposit,
    } = await import("./deposit-gateway.server");

    // Rate limit — 10 submissions per user per hour.
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db
      .from("deposits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= 10) throw new Error("Too many deposit checks — please try again later.");

    const { data: chain } = await db
      .from("deposit_chains")
      .select("*")
      .eq("id", data.chain_id)
      .maybeSingle();
    if (!chain || !chain.is_enabled) throw new Error("This blockchain is not available");
    if (chain.maintenance_mode) throw new Error(`${chain.name} deposits are paused for maintenance`);

    const { data: token } = await db
      .from("deposit_tokens")
      .select("*")
      .eq("id", data.token_id)
      .maybeSingle();
    if (!token || token.status !== "active" || !token.deposit_enabled) {
      throw new Error("This token is not accepted for deposits");
    }
    if (token.chain_id !== chain.id) throw new Error("Token does not belong to this network");

    const txHash = data.tx_hash.trim();
    if (!isValidTxHash(chain.family, txHash)) {
      throw new Error(`That does not look like a valid ${chain.name} transaction hash`);
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
    if (!addr) throw new Error("No receiving address is configured for this network yet");

    // Replay / duplicate protection.
    const { data: existing } = await db
      .from("deposits")
      .select("id, user_id, status")
      .eq("chain_key", chain.key)
      .eq("tx_hash", txHash)
      .maybeSingle();
    if (existing) {
      if (existing.user_id !== context.userId) throw new Error("This transaction is already registered");
      return await syncDeposit(db, existing.id);
    }

    const { data: wallet } = await db
      .from("wallets")
      .select("id")
      .eq("user_id", context.userId)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const probe = await verifyOnChainDeposit(chain, token, addr.address, txHash);
    if (probe.failed) {
      throw new Error(
        probe.reason ||
          `This transaction does not match the ${token.symbol} deposit address on ${chain.name}`,
      );
    }

    const { data: created, error: insErr } = await db
      .from("deposits")
      .insert({
        user_id: context.userId,
        wallet_id: wallet?.id ?? null,
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
        status: "pending",
      })
      .select("*")
      .maybeSingle();
    if (insErr) throw new Error(insErr.message);

    await logDepositEvent(db, created.id, "deposit.detected", probe as never, context.userId);
    await notify(
      db,
      context.userId,
      "Deposit detected",
      `We are tracking your ${token.symbol} transfer on ${chain.name}.`,
    );

    const synced = await syncDeposit(db, created.id);
    if (synced?.status === "credited") {
      await notify(
        db,
        context.userId,
        "Deposit credited",
        `${synced.credited_amount} ${token.credit_symbol || token.symbol} added to Funding.`,
      );
    } else if (synced?.status === "failed") {
      await notify(
        db,
        context.userId,
        "Deposit failed",
        synced.error || "Transaction did not match deposit address, token, or network on-chain.",
      );
    }
    return synced;
  });

export const refreshDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: dep } = await db.from("deposits").select("id, user_id, status, token_symbol").eq("id", data.id).maybeSingle();
    if (!dep || dep.user_id !== context.userId) throw new Error("Deposit not found");
    const { syncDeposit } = await import("./deposit-gateway.server");
    const synced = await syncDeposit(db, dep.id);
    if (synced?.status === "credited" && dep.status !== "credited") {
      await notify(
        db,
        context.userId,
        "Deposit credited",
        `${synced.credited_amount} ${synced.token_symbol} added to Funding.`,
      );
    }
    return synced;
  });

/* ------------------------------------------------------------ admin surface */

export const adminDepositOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await admin();
    const [{ data: chains }, { data: tokens }, { data: addresses }, { data: deposits }, { data: logs }] =
      await Promise.all([
        db.from("deposit_chains").select("*").order("sort_order"),
        db.from("deposit_tokens").select("*").order("sort_order"),
        db.from("deposit_addresses").select("*").order("created_at", { ascending: false }),
        db.from("deposits").select("*").order("created_at", { ascending: false }).limit(100),
        db.from("deposit_audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
    return {
      chains: chains ?? [],
      tokens: tokens ?? [],
      addresses: addresses ?? [],
      deposits: deposits ?? [],
      logs: logs ?? [],
    };
  });

const chainSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().trim().min(2).max(40).regex(/^[a-z0-9_-]+$/),
  name: z.string().trim().min(2).max(60),
  chain_id: z.number().int().nullable().optional(),
  family: z.enum(["evm", "solana", "bitcoin", "other"]),
  rpc_url: z.string().trim().url().max(300).nullable().optional(),
  explorer_url: z.string().trim().url().max(300).nullable().optional(),
  required_confirmations: z.number().int().min(1).max(1000),
  bridge_status: z.string().trim().max(40),
  is_enabled: z.boolean(),
  maintenance_mode: z.boolean(),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

export const adminSaveChain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => chainSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const payload = { ...data, rpc_url: data.rpc_url || null, explorer_url: data.explorer_url || null };
    const { data: row, error } = data.id
      ? await db.from("deposit_chains").update(payload).eq("id", data.id).select("*").maybeSingle()
      : await db.from("deposit_chains").insert(payload).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    const { logDepositEvent } = await import("./deposit-gateway.server");
    await logDepositEvent(db, null, data.id ? "chain.updated" : "chain.created", { key: data.key }, context.userId);
    return row;
  });

const tokenSchema = z.object({
  id: z.string().uuid().optional(),
  chain_id: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  symbol: z.string().trim().min(1).max(20),
  contract_address: z.string().trim().max(120).nullable().optional(),
  decimals: z.number().int().min(0).max(36),
  deposit_enabled: z.boolean(),
  withdrawal_enabled: z.boolean(),
  min_deposit: z.number().min(0),
  max_deposit: z.number().min(0).nullable().optional(),
  deposit_fee_bps: z.number().int().min(0).max(2000),
  credit_symbol: z.string().trim().min(1).max(20),
  usd_rate: z.number().min(0).nullable().optional(),
  status: z.enum(["active", "paused", "delisted"]),
});

export const adminSaveToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const payload = {
      ...data,
      symbol: data.symbol.toUpperCase(),
      credit_symbol: data.credit_symbol.toUpperCase(),
      contract_address: data.contract_address?.trim() || null,
      max_deposit: data.max_deposit ?? null,
      usd_rate: data.usd_rate ?? null,
    };
    const { data: row, error } = data.id
      ? await db.from("deposit_tokens").update(payload).eq("id", data.id).select("*").maybeSingle()
      : await db.from("deposit_tokens").insert(payload).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    const { logDepositEvent } = await import("./deposit-gateway.server");
    await logDepositEvent(db, null, data.id ? "token.updated" : "token.created", { symbol: payload.symbol }, context.userId);
    return row;
  });

const addressSchema = z.object({
  id: z.string().uuid().optional(),
  chain_id: z.string().uuid(),
  token_id: z.string().uuid().nullable().optional(),
  address: z.string().trim().min(20).max(120),
  label: z.string().trim().max(80).nullable().optional(),
  memo_tag: z.string().trim().max(80).nullable().optional(),
  is_active: z.boolean(),
});

export const adminSaveAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addressSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { isValidAddressFor, logDepositEvent } = await import("./deposit-gateway.server");
    const { data: chain } = await db.from("deposit_chains").select("family, name").eq("id", data.chain_id).maybeSingle();
    if (!chain) throw new Error("Chain not found");
    if (!isValidAddressFor(chain.family, data.address)) {
      throw new Error(`That is not a valid ${chain.name} address`);
    }
    const payload = {
      ...data,
      token_id: data.token_id ?? null,
      label: data.label || null,
      memo_tag: data.memo_tag || null,
      created_by: context.userId,
    };
    const { data: row, error } = data.id
      ? await db.from("deposit_addresses").update(payload).eq("id", data.id).select("*").maybeSingle()
      : await db.from("deposit_addresses").insert(payload).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    await logDepositEvent(db, null, data.id ? "address.updated" : "address.created", { address: data.address }, context.userId);
    return row;
  });

export const adminDeleteRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ table: z.enum(["deposit_tokens", "deposit_addresses", "deposit_chains"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { error } = await db.from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    const { logDepositEvent } = await import("./deposit-gateway.server");
    await logDepositEvent(db, null, `${data.table}.deleted`, { id: data.id }, context.userId);
    return { ok: true };
  });

/** Emergency pause — flips maintenance mode on every chain. */
export const adminPauseAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paused: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { error } = await db.from("deposit_chains").update({ maintenance_mode: data.paused }).neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
    const { logDepositEvent } = await import("./deposit-gateway.server");
    await logDepositEvent(db, null, data.paused ? "gateway.paused" : "gateway.resumed", {}, context.userId);
    return { ok: true };
  });

export const adminDepositAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), action: z.enum(["sync", "credit", "fail"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { syncDeposit, creditDeposit, logDepositEvent } = await import("./deposit-gateway.server");
    if (data.action === "sync") return await syncDeposit(db, data.id);
    if (data.action === "credit") {
      const row = await creditDeposit(db, data.id);
      await logDepositEvent(db, data.id, "deposit.manual_credit", {}, context.userId);
      return row;
    }
    const { data: row } = await db
      .from("deposits")
      .update({ status: "failed", error: "Rejected by admin" })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    await logDepositEvent(db, data.id, "deposit.rejected", {}, context.userId);
    return row;
  });
