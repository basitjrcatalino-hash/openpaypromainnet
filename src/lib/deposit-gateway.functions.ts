import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDepositConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isAdminCtx } = await import("./admin-guard.server");
    const isAdmin = await isAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: chains }, { data: tokens }, { data: addresses }] = await Promise.all([
      supabaseAdmin.from("deposit_chains").select("*").order("sort_order"),
      supabaseAdmin.from("deposit_tokens").select("*").order("sort_order"),
      supabaseAdmin.from("deposit_addresses").select("*"),
    ]);

    return {
      isAdmin,
      chains: (chains ?? []).filter((c: any) => isAdmin || c.is_enabled),
      tokens: (tokens ?? []).filter((t: any) => isAdmin || (t.status === "active" && t.deposit_enabled)),
      addresses: (addresses ?? []).filter((a: any) => isAdmin || a.is_active),
    };
  });

export const listMyDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("deposits")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const submitDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        chainId: z.string().uuid(),
        tokenId: z.string().uuid(),
        txHash: z.string().trim().min(16).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getActiveWallet, syncDeposit, logDepositAudit } = await import("./deposit-gateway.server");

    const { data: chain } = await supabaseAdmin
      .from("deposit_chains")
      .select("*")
      .eq("id", data.chainId)
      .maybeSingle();
    const { data: token } = await supabaseAdmin
      .from("deposit_tokens")
      .select("*")
      .eq("id", data.tokenId)
      .maybeSingle();
    if (!chain || !token) throw new Error("Unsupported network or token");
    if (!chain.is_enabled || chain.maintenance_mode) throw new Error("This network is currently paused");
    if (!token.deposit_enabled || token.status !== "active") throw new Error("Deposits are disabled for this token");

    const { data: address } = await supabaseAdmin
      .from("deposit_addresses")
      .select("*")
      .eq("chain_id", data.chainId)
      .eq("is_active", true)
      .order("token_id", { nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (!address) throw new Error("No receiving address is configured for this network yet");

    const { data: existing } = await supabaseAdmin
      .from("deposits")
      .select("id, user_id")
      .eq("chain_key", chain.key)
      .ilike("tx_hash", data.txHash)
      .maybeSingle();
    if (existing) {
      if (existing.user_id !== context.userId) throw new Error("This transaction has already been claimed");
      await syncDeposit(existing.id);
      return { id: existing.id, duplicate: true };
    }

    const wallet = await getActiveWallet(context.userId);

    const { data: created, error } = await supabaseAdmin
      .from("deposits")
      .insert({
        user_id: context.userId,
        wallet_id: wallet?.id ?? null,
        chain_id: chain.id,
        token_id: token.id,
        chain_key: chain.key,
        token_symbol: token.symbol,
        tx_hash: data.txHash,
        to_address: address.address,
        amount: 0,
        required_confirmations: chain.required_confirmations,
        status: "pending",
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logDepositAudit(created.id, "submitted", { txHash: data.txHash }, context.userId);
    try {
      await syncDeposit(created.id);
    } catch {
      /* verification retried by the monitor */
    }
    return { id: created.id, duplicate: false };
  });

export const refreshDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: dep } = await context.supabase
      .from("deposits")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (!dep) throw new Error("Deposit not found");
    const { syncDeposit } = await import("./deposit-gateway.server");
    return await syncDeposit(data.id);
  });

/* ---------------------------------- admin --------------------------------- */

export const adminListDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdminCtx } = await import("./admin-guard.server");
    await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: deposits }, { data: logs }] = await Promise.all([
      supabaseAdmin.from("deposits").select("*").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("deposit_audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    return { deposits: deposits ?? [], logs: logs ?? [] };
  });

export const adminSaveChain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        key: z.string().trim().min(2).max(40),
        name: z.string().trim().min(2).max(60),
        family: z.enum(["evm", "solana"]),
        chain_id: z.number().int().nullable().optional(),
        rpc_url: z.string().trim().max(300).nullable().optional(),
        explorer_url: z.string().trim().max(300).nullable().optional(),
        required_confirmations: z.number().int().min(1).max(200),
        bridge_status: z.string().trim().max(40).default("native"),
        is_enabled: z.boolean(),
        maintenance_mode: z.boolean(),
        sort_order: z.number().int().default(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdminCtx } = await import("./admin-guard.server");
    await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("deposit_chains").upsert(data as any, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSaveToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
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
        deposit_fee_bps: z.number().int().min(0).max(10000),
        credit_symbol: z.string().trim().max(12).default("OUSD"),
        usd_rate: z.number().min(0).nullable().optional(),
        status: z.enum(["active", "disabled"]),
        sort_order: z.number().int().default(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdminCtx } = await import("./admin-guard.server");
    await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("deposit_tokens").upsert(data as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSaveAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        chain_id: z.string().uuid(),
        token_id: z.string().uuid().nullable().optional(),
        address: z.string().trim().min(10).max(120),
        label: z.string().trim().max(60).nullable().optional(),
        memo_tag: z.string().trim().max(60).nullable().optional(),
        is_active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdminCtx } = await import("./admin-guard.server");
    await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("deposit_addresses")
      .upsert({ ...data, created_by: context.userId } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResolveDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["recheck", "credit", "reject"]),
        amount: z.number().min(0).optional(),
        reason: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdminCtx } = await import("./admin-guard.server");
    await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { creditDeposit, syncDeposit, logDepositAudit } = await import("./deposit-gateway.server");

    if (data.action === "recheck") return await syncDeposit(data.id);
    if (data.action === "reject") {
      await supabaseAdmin
        .from("deposits")
        .update({ status: "rejected", error: data.reason ?? "Rejected by admin" } as any)
        .eq("id", data.id);
      await logDepositAudit(data.id, "rejected", { reason: data.reason }, context.userId);
      return { status: "rejected" };
    }
    if (typeof data.amount === "number" && data.amount > 0) {
      await supabaseAdmin.from("deposits").update({ amount: data.amount } as any).eq("id", data.id);
    }
    await logDepositAudit(data.id, "manual_credit", { amount: data.amount }, context.userId);
    return await creditDeposit(data.id);
  });

export const adminPauseAllChains = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ paused: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdminCtx } = await import("./admin-guard.server");
    await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("deposit_chains")
      .update({ maintenance_mode: data.paused } as any)
      .not("id", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
