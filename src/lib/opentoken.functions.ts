import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_GRADUATION_TARGET_PI,
  DEFAULT_LAUNCH_FEE_OUSD,
  DEFAULT_TOTAL_SUPPLY,
  DEFAULT_VIRTUAL_PI,
  DEFAULT_VIRTUAL_TOKENS,
  OT_CATEGORIES,
  spotPrice,
  curveFromTokenRow,
} from "@/lib/opentoken/bonding-curve";
import { generateAddress } from "@/lib/wallet-utils";

const categorySchema = z.enum(OT_CATEGORIES);

async function assertStaff(supabase: any, userId: string) {
  const [{ data: isAdmin }, { data: isMod }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "moderator" }),
  ]);
  if (!isAdmin && !isMod) throw new Error("Admin or moderator only");
}

export const createOpenToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(60),
        symbol: z
          .string()
          .trim()
          .min(1)
          .max(10)
          .regex(/^[A-Z0-9]+$/),
        description: z.string().trim().max(1000).optional().nullable(),
        logo_url: z.string().url().optional().nullable().or(z.literal("")),
        banner_url: z.string().url().optional().nullable().or(z.literal("")),
        website: z.string().url().optional().nullable().or(z.literal("")),
        twitter: z.string().max(120).optional().nullable(),
        telegram: z.string().max(120).optional().nullable(),
        discord: z.string().max(120).optional().nullable(),
        category: categorySchema.default("meme"),
        total_supply: z.number().positive().max(1e15).default(DEFAULT_TOTAL_SUPPLY),
        decimals: z.number().int().min(0).max(18).default(9),
        burnable: z.boolean().default(false),
        mintable: z.boolean().default(false),
        wallet_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select("id, ousd_balance")
      .eq("id", data.wallet_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet) throw new Error("Wallet not found");

    const fee = DEFAULT_LAUNCH_FEE_OUSD;
    const ousdBalance = Number(wallet.ousd_balance ?? 0);
    if (ousdBalance < fee) {
      throw new Error(`Launch fee is ${fee} OUSD — insufficient available balance`);
    }

    const initial = curveFromTokenRow({
      curve_virtual_pi: DEFAULT_VIRTUAL_PI,
      curve_virtual_tokens: DEFAULT_VIRTUAL_TOKENS,
      curve_reserve_pi: 0,
      curve_supply_sold: 0,
      total_supply: data.total_supply,
      graduation_target_pi: DEFAULT_GRADUATION_TARGET_PI,
    });
    const price = spotPrice(initial);

    const { error: feeErr } = await supabase
      .from("wallets")
      .update({ ousd_balance: ousdBalance - fee })
      .eq("id", wallet.id)
      .eq("user_id", userId);
    if (feeErr) throw new Error(feeErr.message);

    const row = {
      creator_id: userId,
      name: data.name,
      symbol: data.symbol.toUpperCase(),
      description: data.description || null,
      logo_url: data.logo_url || null,
      banner_url: data.banner_url || null,
      website: data.website || null,
      twitter: data.twitter || null,
      telegram: data.telegram || null,
      discord: data.discord || null,
      category: data.category,
      total_supply: data.total_supply,
      decimals: data.decimals,
      burnable: data.burnable,
      mintable: data.mintable,
      pausable: false,
      contract_address: generateAddress("ot"),
      status: "curve" as const,
      curve_virtual_pi: DEFAULT_VIRTUAL_PI,
      curve_virtual_tokens: DEFAULT_VIRTUAL_TOKENS,
      curve_reserve_pi: 0,
      curve_supply_sold: 0,
      graduation_target_pi: DEFAULT_GRADUATION_TARGET_PI,
      launch_fee_pi: fee,
      price_usd: price,
      market_cap: price * data.total_supply,
      volume_24h: 0,
      change_24h: 0,
      holder_count: 0,
      is_featured: false,
      is_verified: false,
      is_hidden: false,
    };

    const { data: created, error } = await supabase.from("tokens").insert(row).select("*").single();
    if (error) {
      // refund fee on failure
      await supabase
        .from("wallets")
        .update({ ousd_balance: ousdBalance })
        .eq("id", wallet.id);
      throw new Error(error.message);
    }

    try {
      await supabase.from("transactions").insert({
        wallet_id: wallet.id,
        type: "send",
        status: "confirmed",
        token_symbol: "OUSD",
        counterparty: `opentoken:launch:${created.id}`,
        amount: fee,
        usd_value: fee,
        memo: `OpenToken launch fee · ${data.symbol}`,
      });
    } catch {
      /* ledger optional */
    }

    await supabase.from("ot_price_ticks").insert({
      token_id: created.id,
      price,
      market_cap: price * data.total_supply,
    });

    return created;
  });

export const buyOpenToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        token_id: z.string().uuid(),
        wallet_id: z.string().uuid(),
        pi_amount: z.number().positive().max(1_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("ot_execute_trade", {
      p_token_id: data.token_id,
      p_wallet_id: data.wallet_id,
      p_side: "buy",
      p_pi_amount: data.pi_amount,
      p_token_amount: null,
    });
    if (error) throw new Error(error.message);
    return result as {
      side: string;
      pi_amount: number;
      token_amount: number;
      price: number;
      graduated: boolean;
    };
  });

export const sellOpenToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        token_id: z.string().uuid(),
        wallet_id: z.string().uuid(),
        token_amount: z.number().positive(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("ot_execute_trade", {
      p_token_id: data.token_id,
      p_wallet_id: data.wallet_id,
      p_side: "sell",
      p_pi_amount: null,
      p_token_amount: data.token_amount,
    });
    if (error) throw new Error(error.message);
    return result as {
      side: string;
      pi_amount: number;
      token_amount: number;
      price: number;
      graduated: boolean;
    };
  });

export const reportOpenToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        token_id: z.string().uuid(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("ot_reports").insert({
      token_id: data.token_id,
      reporter_id: userId,
      reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateOpenToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        token_id: z.string().uuid(),
        is_featured: z.boolean().optional(),
        is_hidden: z.boolean().optional(),
        is_verified: z.boolean().optional(),
        status: z.enum(["curve", "graduated", "halted"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStaff(supabase, userId);
    const patch: {
      is_featured?: boolean;
      is_hidden?: boolean;
      is_verified?: boolean;
      status?: "curve" | "graduated" | "halted";
    } = {};
    if (data.is_featured !== undefined) patch.is_featured = data.is_featured;
    if (data.is_hidden !== undefined) patch.is_hidden = data.is_hidden;
    if (data.is_verified !== undefined) patch.is_verified = data.is_verified;
    if (data.status !== undefined) patch.status = data.status;
    const { error } = await supabase.from("tokens").update(patch).eq("id", data.token_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminReviewReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        report_id: z.string().uuid(),
        status: z.enum(["reviewed", "dismissed", "actioned"]),
        hide_token: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStaff(supabase, userId);
    const { data: report, error } = await supabase
      .from("ot_reports")
      .update({
        status: data.status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      })
      .eq("id", data.report_id)
      .select("token_id")
      .single();
    if (error) throw new Error(error.message);
    if (data.hide_token && report?.token_id) {
      await supabase.from("tokens").update({ is_hidden: true }).eq("id", report.token_id);
    }
    return { ok: true };
  });

export const getOpenTokenAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const { data: isMod } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "moderator",
    });
    const staff = !!(isAdmin || isMod);
    if (!staff) return { isStaff: false as const };

    const [
      { count: tokenCount },
      { count: tradeCount },
      { count: openReports },
      { data: recentReports },
    ] = await Promise.all([
      supabase.from("tokens").select("*", { count: "exact", head: true }),
      supabase.from("ot_trades").select("*", { count: "exact", head: true }),
      supabase.from("ot_reports").select("*", { count: "exact", head: true }).eq("status", "open"),
      supabase
        .from("ot_reports")
        .select("*, tokens(name, symbol)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      isStaff: true as const,
      isAdmin: !!isAdmin,
      tokens: tokenCount ?? 0,
      trades: tradeCount ?? 0,
      open_reports: openReports ?? 0,
      reports: recentReports ?? [],
    };
  });
