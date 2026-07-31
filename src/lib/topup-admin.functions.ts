import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin only");
}

function randomCode(): string {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n: number) =>
    Array.from({ length: n }, () => alpha[Math.floor(Math.random() * alpha.length)]).join("");
  return `${seg(4)}-${seg(4)}-${seg(4)}`;
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: !!data };
  });

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_first_admin");
    if (error) throw new Error(error.message);
    return { claimed: !!data };
  });

export const getTopupSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("topup_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { id: 1, openpay_payment_url: null, instructions: null, fee_bps: 0, fee_wallet_address: null };
  });

const SettingsSchema = z.object({
  openpay_payment_url: z.string().url().max(500).nullable().optional(),
  instructions: z.string().max(2000).nullable().optional(),
  fee_bps: z.number().int().min(0).max(10_000).optional(),
  fee_wallet_address: z
    .string()
    .max(128)
    .nullable()
    .optional()
    .refine((v) => {
      if (!v) return true;
      const t = v.trim();
      if (/^0x[a-fA-F0-9]{40}$/i.test(t)) return true;
      // @username or username
      const handle = t.replace(/^@+/, "");
      return /^[a-zA-Z0-9_]{2,32}$/.test(handle);
    }, "Use a 0x wallet address or @username (e.g. @openpay)"),
});

export const updateTopupSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("topup_settings")
      .update({
        openpay_payment_url: data.openpay_payment_url ?? null,
        instructions: data.instructions ?? null,
        fee_bps: data.fee_bps ?? 0,
        fee_wallet_address: (() => {
          const raw = data.fee_wallet_address?.trim();
          if (!raw) return null;
          if (/^0x/i.test(raw)) return raw.toLowerCase();
          const handle = raw.replace(/^@+/, "").toLowerCase();
          return handle ? `@${handle}` : null;
        })(),
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    const { clearTopupFeeSettingsCache } = await import("./topup-fee");
    clearTopupFeeSettingsCache();
    return { ok: true };
  });

export const listVouchers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("topup_vouchers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const CreateVoucherSchema = z.object({
  amount_ousd: z.number().positive().max(1_000_000),
  quantity: z.number().int().min(1).max(50).default(1),
  note: z.string().max(200).optional().nullable(),
});

export const createVouchers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateVoucherSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const rows = Array.from({ length: data.quantity }, () => ({
      code: randomCode(),
      amount_ousd: data.amount_ousd,
      note: data.note ?? null,
      created_by: context.userId,
    }));
    const { data: inserted, error } = await context.supabase
      .from("topup_vouchers")
      .insert(rows)
      .select("*");
    if (error) throw new Error(error.message);
    return inserted ?? [];
  });

const DisableSchema = z.object({ id: z.string().uuid() });
export const disableVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DisableSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("topup_vouchers")
      .update({ status: "disabled" })
      .eq("id", data.id)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const RedeemSchema = z.object({ code: z.string().trim().min(4).max(40) });

export const redeemVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RedeemSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = data.code.trim().toUpperCase();

    // Need privileged write to atomically claim a voucher row (RLS only lets
    // admins write, but redemption must be allowed for any signed-in user).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: voucher, error: vErr } = await supabaseAdmin
      .from("topup_vouchers")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!voucher) throw new Error("Voucher not found");
    if (voucher.status !== "active") throw new Error("Voucher already used or disabled");

    // Atomic claim
    const { data: claimed, error: cErr } = await supabaseAdmin
      .from("topup_vouchers")
      .update({
        status: "redeemed",
        redeemed_by: userId,
        redeemed_at: new Date().toISOString(),
      })
      .eq("id", voucher.id)
      .eq("status", "active")
      .select("*")
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!claimed) throw new Error("Voucher already redeemed");

    const { fetchActiveWallet } = await import("./wallet-utils");
    const wallet = await fetchActiveWallet<{ id: string; ousd_balance?: number | null }>(
      supabase,
      userId,
    );
    if (!wallet) throw new Error("Active wallet not found");

    const amount = Number(claimed.amount_ousd);
    const newBal = Number(wallet.ousd_balance ?? 0) + amount;
    const { error: uErr } = await supabase
      .from("wallets")
      .update({ ousd_balance: newBal })
      .eq("id", wallet.id);
    if (uErr) throw new Error(uErr.message);

    await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      type: "buy",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty: `voucher:${claimed.code}`,
      amount,
      usd_value: amount,
      memo: `Voucher redeemed${claimed.note ? ` · ${claimed.note}` : ""}`,
    });
    try {
      const { notifyWalletTransaction } = await import("./tx-alerts.server");
      await notifyWalletTransaction(supabaseAdmin as never, wallet.id, {
        type: "buy",
        token_symbol: "OUSD",
        amount,
        memo: `Voucher redeemed${claimed.note ? ` · ${claimed.note}` : ""}`,
        counterparty: `voucher:${claimed.code}`,
        status: "confirmed",
        wallet_id: wallet.id,
      });
    } catch (e) {
      console.warn("[voucher] tx alert failed", e);
    }

    return { ok: true, amount, balance: newBal };
  });

export const listTopupMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("topup_methods")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const MethodUpdateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(200).nullable().optional(),
  enabled: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(999).optional(),
});

export const updateTopupMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MethodUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("topup_methods").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Upsert every catalog method into `topup_methods` so new providers
 * (Solana Pay, Circle Mint, …) appear in Admin → Top Up and can be hidden
 * for maintenance. Does not overwrite existing `enabled` flags.
 */
export const ensureTopupMethods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { TOPUP_METHOD_CATALOG } = await import("@/lib/topup-methods");

    const { data: existing, error: listErr } = await context.supabase
      .from("topup_methods")
      .select("method_key, enabled");
    if (listErr) throw new Error(listErr.message);

    const have = new Set((existing ?? []).map((r) => r.method_key));
    const missing = TOPUP_METHOD_CATALOG.filter((m) => !have.has(m.method_key));

    if (missing.length) {
      const { error: insertErr } = await context.supabase.from("topup_methods").insert(
        missing.map((m) => ({
          method_key: m.method_key,
          label: m.label,
          description: m.description,
          enabled: m.enabled,
          sort_order: m.sort_order,
        })),
      );
      if (insertErr) throw new Error(insertErr.message);
    }

    const { data, error } = await context.supabase
      .from("topup_methods")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { ok: true, inserted: missing.map((m) => m.method_key), methods: data ?? [] };
  });

export const getPublicTopupInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("topup_settings")
      .select("openpay_payment_url, instructions, fee_bps, fee_wallet_address")
      .eq("id", 1)
      .maybeSingle();
    return data ?? { openpay_payment_url: null, instructions: null, fee_bps: 0, fee_wallet_address: null };
  });