import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const AIRDROP_ASSETS = ["OUSD", "USDT", "USDC"] as const;
export type AirdropAsset = (typeof AIRDROP_ASSETS)[number];

export const AIRDROP_STATUSES = ["draft", "live", "paused", "ended"] as const;
export type AirdropStatus = (typeof AIRDROP_STATUSES)[number];

export const AIRDROP_CLAIM_MODES = ["open", "code"] as const;
export type AirdropClaimMode = (typeof AIRDROP_CLAIM_MODES)[number];

export type AirdropRequirement = {
  id: string;
  label: string;
  done_hint?: string;
};

export type AirdropCampaign = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  notes: string | null;
  asset: AirdropAsset;
  amount_per_claim: number;
  claim_mode: AirdropClaimMode;
  claim_code: string | null;
  status: AirdropStatus;
  starts_at: string | null;
  ends_at: string | null;
  total_budget: number | null;
  max_claims: number | null;
  claimed_count: number;
  distributed_amount: number;
  require_wallet: boolean;
  require_kyc: boolean;
  requirements: AirdropRequirement[];
  cover_url: string | null;
  badge: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin only");
}

/** Untyped client for tables not yet in generated supabase types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: any): any {
  return client;
}

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

function balanceColumn(asset: AirdropAsset): string {
  if (asset === "OUSD") return "ousd_balance";
  if (asset === "USDT") return "usdt_balance";
  return "usdc_balance";
}

function slugify(raw: string): string {
  const s = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return s || `drop-${Date.now().toString(36)}`;
}

function parseRequirements(raw: unknown): AirdropRequirement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r, i) => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const label = String(o.label ?? "").trim();
      if (!label) return null;
      return {
        id: String(o.id ?? `req-${i + 1}`),
        label: label.slice(0, 200),
        done_hint: o.done_hint ? String(o.done_hint).slice(0, 200) : undefined,
      };
    })
    .filter(Boolean) as AirdropRequirement[];
}

function mapCampaign(row: Record<string, unknown>, redactCode = false): AirdropCampaign {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    subtitle: (row.subtitle as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    notes: redactCode ? null : ((row.notes as string | null) ?? null),
    asset: row.asset as AirdropAsset,
    amount_per_claim: Number(row.amount_per_claim),
    claim_mode: row.claim_mode as AirdropClaimMode,
    claim_code: redactCode ? null : ((row.claim_code as string | null) ?? null),
    status: row.status as AirdropStatus,
    starts_at: (row.starts_at as string | null) ?? null,
    ends_at: (row.ends_at as string | null) ?? null,
    total_budget: row.total_budget != null ? Number(row.total_budget) : null,
    max_claims: row.max_claims != null ? Number(row.max_claims) : null,
    claimed_count: Number(row.claimed_count ?? 0),
    distributed_amount: Number(row.distributed_amount ?? 0),
    require_wallet: row.require_wallet !== false,
    require_kyc: !!row.require_kyc,
    requirements: parseRequirements(row.requirements),
    cover_url: (row.cover_url as string | null) ?? null,
    badge: (row.badge as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function campaignInWindow(c: {
  starts_at: string | null;
  ends_at: string | null;
}): boolean {
  const now = Date.now();
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return false;
  if (c.ends_at && new Date(c.ends_at).getTime() < now) return false;
  return true;
}

const RequirementSchema = z.object({
  id: z.string().trim().min(1).max(40).optional(),
  label: z.string().trim().min(1).max(200),
  done_hint: z.string().trim().max(200).optional(),
});

const CreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  slug: z.string().trim().max(64).optional().nullable(),
  asset: z.enum(AIRDROP_ASSETS),
  amount_per_claim: z.number().positive().max(1_000_000),
  claim_mode: z.enum(AIRDROP_CLAIM_MODES),
  claim_code: z.string().trim().min(4).max(40).optional().nullable(),
  status: z.enum(AIRDROP_STATUSES).optional(),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  total_budget: z.number().positive().max(100_000_000).optional().nullable(),
  max_claims: z.number().int().positive().max(10_000_000).optional().nullable(),
  require_kyc: z.boolean().optional(),
  requirements: z.array(RequirementSchema).max(20).optional(),
  cover_url: z.string().url().optional().nullable().or(z.literal("")),
  badge: z.string().trim().max(40).optional().nullable(),
});

const UpdateSchema = CreateSchema.partial().extend({
  id: z.string().uuid(),
});

const StatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(AIRDROP_STATUSES),
});

const ClaimSchema = z.object({
  campaign_id: z.string().uuid(),
  claim_code: z.string().trim().max(40).optional().nullable(),
});

/** Claim codes live in the service-role-only `airdrop_campaign_secrets` table. */
async function fetchClaimCode(admin: any, campaignId: string): Promise<string | null> {
  const { data } = await admin
    .from("airdrop_campaign_secrets")
    .select("claim_code")
    .eq("campaign_id", campaignId)
    .maybeSingle();
  return (data?.claim_code as string | null) ?? null;
}

async function writeClaimCode(
  admin: any,
  campaignId: string,
  code: string | null,
): Promise<void> {
  if (code) {
    const { error } = await admin
      .from("airdrop_campaign_secrets")
      .upsert(
        { campaign_id: campaignId, claim_code: code, updated_at: new Date().toISOString() },
        { onConflict: "campaign_id" },
      );
    if (error) {
      if (/duplicate|unique/i.test(error.message)) throw new Error("Claim code already exists");
      throw new Error(error.message);
    }
  } else {
    await admin.from("airdrop_campaign_secrets").delete().eq("campaign_id", campaignId);
  }
}

export const listAirdropCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await db(supabaseAdmin)
      .from("airdrop_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: secrets } = await db(supabaseAdmin)
      .from("airdrop_campaign_secrets")
      .select("campaign_id, claim_code");
    const codes = new Map<string, string>(
      (secrets ?? []).map((s: { campaign_id: string; claim_code: string }) => [
        s.campaign_id,
        s.claim_code,
      ]),
    );
    return (data ?? []).map((r: Record<string, unknown>) =>
      mapCampaign({ ...r, claim_code: codes.get(String(r.id)) ?? null }, false),
    );
  });

export const createAirdropCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { userId, supabase } = context;

    if (data.claim_mode === "code" && !data.claim_code?.trim()) {
      throw new Error("Claim code is required for code campaigns");
    }

    const slug = slugify(data.slug?.trim() || data.title);
    const claimCode =
      data.claim_mode === "code" ? data.claim_code!.trim().toUpperCase() : null;
    const requirements = (data.requirements ?? []).map((r, i) => ({
      id: r.id?.trim() || `req-${i + 1}`,
      label: r.label.trim(),
      done_hint: r.done_hint?.trim() || undefined,
    }));

    if (
      data.total_budget != null &&
      data.total_budget + 1e-12 < data.amount_per_claim
    ) {
      throw new Error("Total budget must be at least one claim amount");
    }

    const row = {
      slug,
      title: data.title.trim(),
      subtitle: data.subtitle?.trim() || null,
      description: data.description?.trim() || null,
      notes: data.notes?.trim() || null,
      asset: data.asset,
      amount_per_claim: round8(data.amount_per_claim),
      claim_mode: data.claim_mode,
      status: data.status ?? "draft",
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
      total_budget: data.total_budget != null ? round8(data.total_budget) : null,
      max_claims: data.max_claims ?? null,
      require_wallet: true,
      require_kyc: !!data.require_kyc,
      requirements,
      cover_url: data.cover_url?.trim() || null,
      badge: data.badge?.trim() || null,
      created_by: userId,
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await db(supabaseAdmin)
      .from("airdrop_campaigns")
      .insert(row)
      .select("*")
      .single();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        throw new Error("Slug or claim code already exists");
      }
      throw new Error(error.message);
    }
    await writeClaimCode(db(supabaseAdmin), String((created as { id: string }).id), claimCode);
    return mapCampaign({ ...(created as Record<string, unknown>), claim_code: claimCode }, false);
  });

export const updateAirdropCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;

    const patch: Record<string, unknown> = {};
    if (rest.title != null) patch.title = rest.title.trim();
    if (rest.subtitle !== undefined) patch.subtitle = rest.subtitle?.trim() || null;
    if (rest.description !== undefined) {
      patch.description = rest.description?.trim() || null;
    }
    if (rest.notes !== undefined) patch.notes = rest.notes?.trim() || null;
    if (rest.slug != null) patch.slug = slugify(rest.slug);
    if (rest.asset != null) patch.asset = rest.asset;
    if (rest.amount_per_claim != null) {
      patch.amount_per_claim = round8(rest.amount_per_claim);
    }
    if (rest.claim_mode != null) patch.claim_mode = rest.claim_mode;
    const nextCode =
      rest.claim_code === undefined
        ? undefined
        : rest.claim_code?.trim()
          ? rest.claim_code.trim().toUpperCase()
          : null;
    if (rest.status != null) patch.status = rest.status;
    if (rest.starts_at !== undefined) patch.starts_at = rest.starts_at || null;
    if (rest.ends_at !== undefined) patch.ends_at = rest.ends_at || null;
    if (rest.total_budget !== undefined) {
      patch.total_budget =
        rest.total_budget != null ? round8(rest.total_budget) : null;
    }
    if (rest.max_claims !== undefined) patch.max_claims = rest.max_claims ?? null;
    if (rest.require_kyc !== undefined) patch.require_kyc = !!rest.require_kyc;
    if (rest.requirements !== undefined) {
      patch.requirements = rest.requirements.map((r, i) => ({
        id: r.id?.trim() || `req-${i + 1}`,
        label: r.label.trim(),
        done_hint: r.done_hint?.trim() || undefined,
      }));
    }
    if (rest.cover_url !== undefined) {
      patch.cover_url = rest.cover_url?.trim() || null;
    }
    if (rest.badge !== undefined) patch.badge = rest.badge?.trim() || null;

    const mode = (patch.claim_mode as string | undefined) ?? undefined;
    const code = nextCode;
    if (mode === "code" && (code === null || code === "")) {
      throw new Error("Claim code is required for code campaigns");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await db(supabaseAdmin)
      .from("airdrop_campaigns")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        throw new Error("Slug or claim code already exists");
      }
      throw new Error(error.message);
    }
    if (!updated) throw new Error("Campaign not found");
    if (nextCode !== undefined) await writeClaimCode(db(supabaseAdmin), id, nextCode);
    const existingCode = nextCode !== undefined ? nextCode : await fetchClaimCode(db(supabaseAdmin), id);
    return mapCampaign(
      { ...(updated as Record<string, unknown>), claim_code: existingCode },
      false,
    );
  });

export const setAirdropStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await db(supabaseAdmin)
      .from("airdrop_campaigns")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Campaign not found");
    return mapCampaign(updated as Record<string, unknown>, false);
  });

export const listLiveAirdrops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await db(context.supabase)
      .from("airdrop_campaigns")
      .select(
        "id, slug, title, subtitle, description, notes, asset, amount_per_claim, claim_mode, status, starts_at, ends_at, total_budget, max_claims, claimed_count, distributed_amount, require_wallet, require_kyc, requirements, cover_url, badge, created_by, created_at, updated_at",
      )
      .eq("status", "live")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map((r: Record<string, unknown>) => mapCampaign(r, true))
      .filter((c: AirdropCampaign) => campaignInWindow(c));
  });

export const getAirdropClaimStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await db(context.supabase)
      .from("airdrop_claims")
      .select("campaign_id, amount, asset, created_at")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      campaign_id: string;
      amount: number;
      asset: string;
      created_at: string;
    }>;
  });

export const claimAirdrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ClaimSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = db(supabaseAdmin);

    const { data: campaign, error: cErr } = await admin
      .from("airdrop_campaigns")
      .select("*")
      .eq("id", data.campaign_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status !== "live") throw new Error("Campaign is not live");
    if (!campaignInWindow(campaign)) {
      throw new Error("Campaign is outside its claim window");
    }

    const asset = campaign.asset as AirdropAsset;
    const amount = round8(Number(campaign.amount_per_claim));
    if (!(amount > 0)) throw new Error("Invalid claim amount");

    if (campaign.claim_mode === "code") {
      const entered = (data.claim_code ?? "").trim().toUpperCase();
      const expected = String((await fetchClaimCode(admin, campaign.id)) ?? "").toUpperCase();
      if (!entered || entered !== expected) {
        throw new Error("Invalid claim code");
      }
    }

    if (campaign.require_kyc) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("kyc_status")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.kyc_status !== "verified") {
        throw new Error("Complete KYC verification before claiming this airdrop");
      }
    }

    const { fetchActiveWallet } = await import("./wallet-utils");
    const col = balanceColumn(asset);
    const wallet = await fetchActiveWallet<Record<string, unknown>>(
      supabase,
      userId,
      `id, ${col}`,
    );
    if (!wallet?.id) {
      throw new Error("Create an OpenPay Pro wallet first");
    }
    const walletId = String(wallet.id);

    const maxClaims =
      campaign.max_claims != null ? Number(campaign.max_claims) : null;
    const budget =
      campaign.total_budget != null ? Number(campaign.total_budget) : null;
    const claimedCount = Number(campaign.claimed_count ?? 0);
    const distributed = Number(campaign.distributed_amount ?? 0);

    if (maxClaims != null && claimedCount >= maxClaims) {
      throw new Error("This airdrop is fully claimed");
    }
    if (budget != null && distributed + amount > budget + 1e-12) {
      throw new Error("Airdrop budget exhausted");
    }

    const txHash = `airdrop:${campaign.id}:${userId}`;

    const { data: claimRow, error: claimErr } = await admin
      .from("airdrop_claims")
      .insert({
        campaign_id: campaign.id,
        user_id: userId,
        wallet_id: walletId,
        asset,
        amount,
        tx_hash: txHash,
      })
      .select("*")
      .maybeSingle();

    if (claimErr) {
      if (/duplicate|unique/i.test(claimErr.message)) {
        throw new Error("You already claimed this airdrop");
      }
      throw new Error(claimErr.message);
    }
    if (!claimRow) throw new Error("Claim failed");

    const curBal = Number(wallet[col] ?? 0) || 0;
    const nextBal = round8(curBal + amount);
    const balPatch =
      asset === "OUSD"
        ? { ousd_balance: nextBal }
        : asset === "USDT"
          ? { usdt_balance: nextBal }
          : { usdc_balance: nextBal };

    const { error: balErr } = await supabase
      .from("wallets")
      .update(balPatch)
      .eq("id", walletId)
      .eq("user_id", userId);
    if (balErr) {
      await admin.from("airdrop_claims").delete().eq("id", claimRow.id);
      throw new Error(balErr.message);
    }

    const memo = `Airdrop · ${campaign.title}`;
    const { data: buyTx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        wallet_id: walletId,
        type: "reward",
        status: "confirmed",
        token_symbol: asset,
        counterparty: `airdrop:${campaign.slug}`,
        amount,
        usd_value: amount,
        memo,
        tx_hash: txHash,
      })
      .select("id, type, token_symbol, amount, memo, counterparty, status, created_at, wallet_id")
      .maybeSingle();
    if (txErr && !/duplicate|unique/i.test(txErr.message)) {
      console.warn("[airdrop] tx insert failed", txErr.message);
    }

    const { error: counterErr } = await admin
      .from("airdrop_campaigns")
      .update({
        claimed_count: claimedCount + 1,
        distributed_amount: round8(distributed + amount),
      })
      .eq("id", campaign.id)
      .eq("claimed_count", claimedCount);
    if (counterErr) {
      console.warn("[airdrop] counter update failed", counterErr.message);
      await admin
        .from("airdrop_campaigns")
        .update({
          claimed_count: claimedCount + 1,
          distributed_amount: round8(distributed + amount),
        })
        .eq("id", campaign.id);
    }

    try {
      const { notifyWalletTransaction } = await import("./tx-alerts.server");
      await notifyWalletTransaction(supabaseAdmin as never, walletId, buyTx ?? {
        type: "reward",
        token_symbol: asset,
        amount,
        memo,
        counterparty: `airdrop:${campaign.slug}`,
        status: "confirmed",
        wallet_id: walletId,
      });
    } catch (e) {
      console.warn("[airdrop] alert failed", e);
    }

    return {
      ok: true as const,
      campaign_id: campaign.id,
      asset,
      amount,
      balance: nextBal,
      title: String(campaign.title),
    };
  });
