import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Consent screen context for `/pro/authorize`. */
export const getProAuthorizeContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        client_id: z.string().trim().min(4),
        redirect_uri: z.string().trim().url(),
        scope: z.string().trim().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const {
      findAppByClientId,
      redirectUriAllowed,
      normalizeScope,
      getProfileSummary,
    } = await import("@/lib/pro-connect.server");
    const app = await findAppByClientId(data.client_id);
    if (!app || !app.active) return { error: "unknown_client" as const };
    if (!redirectUriAllowed(app, data.redirect_uri)) {
      return { error: "redirect_uri_mismatch" as const };
    }
    const scope = normalizeScope(data.scope);
    const me = await getProfileSummary(context.userId);
    return {
      error: null,
      app: {
        name: app.name,
        description: app.description,
        logo_url: app.logo_url,
        website_url: app.website_url,
      },
      scope,
      redirect_uri: data.redirect_uri,
      user: me,
    };
  });

/** Approve consent → one-time authorization code appended to the app redirect URI. */
export const approveProAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        client_id: z.string().trim().min(4),
        redirect_uri: z.string().trim().url(),
        scope: z.string().trim().optional(),
        state: z.string().trim().max(512).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const {
      findAppByClientId,
      redirectUriAllowed,
      normalizeScope,
      issueAuthorizationCode,
    } = await import("@/lib/pro-connect.server");
    const app = await findAppByClientId(data.client_id);
    if (!app || !app.active) throw new Error("Unknown application");
    if (!redirectUriAllowed(app, data.redirect_uri)) throw new Error("redirect_uri mismatch");
    const scope = normalizeScope(data.scope);
    const code = await issueAuthorizationCode({
      appId: app.id,
      userId: context.userId,
      redirectUri: data.redirect_uri,
      scope,
    });
    const url = new URL(data.redirect_uri);
    url.searchParams.set("code", code);
    url.searchParams.set("scope", scope);
    if (data.state) url.searchParams.set("state", data.state);
    return { redirect_url: url.toString() };
  });

/** Checkout page data for `/pro/checkout/$id`. */
export const getProCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getCharge, expandStatus, getActiveWallet, admin, getProfileSummary } = await import(
      "@/lib/pro-connect.server"
    );
    const charge = await getCharge(data.id);
    if (!charge) throw new Error("Charge not found");
    const db = await admin();
    const { data: app } = await db
      .from("pro_oauth_apps")
      .select("name, logo_url, website_url, owner_user_id")
      .eq("id", charge.app_id)
      .maybeSingle();
    const owner = app?.owner_user_id ? await getProfileSummary(app.owner_user_id) : null;
    const wallet = await getActiveWallet(context.userId);
    return {
      charge: {
        id: charge.id,
        amount: Number(charge.amount),
        currency: charge.currency,
        description: charge.description,
        reference: charge.reference,
        status: expandStatus(charge),
        success_url: charge.success_url,
        cancel_url: charge.cancel_url,
        expires_at: charge.expires_at,
      },
      app: {
        name: app?.name ?? "Connected app",
        logo_url: app?.logo_url ?? null,
        website_url: app?.website_url ?? null,
        handle: owner?.username ? `@${owner.username}` : null,
      },
      balance: wallet?.ousd_balance ?? 0,
    };
  });

/** Pay a Pro Pay charge from the signed-in user's OUSD balance. */
export const payProCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { payCharge } = await import("@/lib/pro-connect.server");
    const res = await payCharge(data.id, context.userId);
    return { ok: true, amount: res.amount, success_url: res.charge.success_url };
  });

/* ------------------------------------------------------------------ */
/* Developer app management                                            */
/* ------------------------------------------------------------------ */

export const listProApps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin } = await import("@/lib/pro-connect.server");
    const db = await admin();
    const { data, error } = await db
      .from("pro_oauth_apps")
      .select(
        "id, name, description, logo_url, website_url, client_id, secret_prefix, redirect_uris, scopes, active, created_at",
      )
      .eq("owner_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createProApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(60),
        description: z.string().trim().max(200).optional().nullable(),
        website_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
        logo_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
        redirect_uris: z.array(z.string().trim().url()).min(1).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, newClientId, newClientSecret, sha256 } = await import(
      "@/lib/pro-connect.server"
    );
    const db = await admin();
    const clientId = newClientId();
    const secret = newClientSecret();
    const { data: row, error } = await db
      .from("pro_oauth_apps")
      .insert({
        owner_user_id: context.userId,
        name: data.name,
        description: data.description || null,
        website_url: data.website_url || null,
        logo_url: data.logo_url || null,
        client_id: clientId,
        client_secret_hash: sha256(secret),
        secret_prefix: secret.slice(0, 18),
        redirect_uris: data.redirect_uris,
      })
      .select(
        "id, name, description, logo_url, website_url, client_id, secret_prefix, redirect_uris, scopes, active, created_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return { app: row, client_secret: secret };
  });

export const updateProApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(2).max(60).optional(),
        description: z.string().trim().max(200).nullable().optional(),
        website_url: z.string().trim().url().nullable().optional(),
        logo_url: z.string().trim().url().nullable().optional(),
        redirect_uris: z.array(z.string().trim().url()).min(1).max(10).optional(),
        active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = await import("@/lib/pro-connect.server");
    const db = await admin();
    const { id, ...patch } = data;
    const { error } = await db
      .from("pro_oauth_apps")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rotateProAppSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, newClientSecret, sha256 } = await import("@/lib/pro-connect.server");
    const db = await admin();
    const secret = newClientSecret();
    const { error } = await db
      .from("pro_oauth_apps")
      .update({
        client_secret_hash: sha256(secret),
        secret_prefix: secret.slice(0, 18),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("owner_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { client_secret: secret };
  });

export const deleteProApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await import("@/lib/pro-connect.server");
    const db = await admin();
    const { error } = await db
      .from("pro_oauth_apps")
      .delete()
      .eq("id", data.id)
      .eq("owner_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProAppCharges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await import("@/lib/pro-connect.server");
    const db = await admin();
    const { data: app } = await db
      .from("pro_oauth_apps")
      .select("id")
      .eq("id", data.id)
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!app) throw new Error("App not found");
    const { data: rows } = await db
      .from("pro_charges")
      .select("id, amount, currency, description, reference, status, paid_at, created_at")
      .eq("app_id", data.id)
      .order("created_at", { ascending: false })
      .limit(25);
    return rows ?? [];
  });

/** Apps the signed-in user has connected (granted access to). */
export const listProConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin } = await import("@/lib/pro-connect.server");
    const db = await admin();
    const { data } = await db
      .from("pro_oauth_tokens")
      .select("id, scope, created_at, last_used_at, revoked_at, app_id")
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    const rows = data ?? [];
    if (!rows.length) return [];
    const { data: apps } = await db
      .from("pro_oauth_apps")
      .select("id, name, logo_url, website_url")
      .in(
        "id",
        rows.map((r) => r.app_id),
      );
    const byId = new Map((apps ?? []).map((a) => [a.id, a]));
    return rows.map((r) => ({
      id: r.id,
      scope: r.scope,
      created_at: r.created_at,
      last_used_at: r.last_used_at,
      app: byId.get(r.app_id) ?? { id: r.app_id, name: "App", logo_url: null, website_url: null },
    }));
  });

export const revokeProConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await import("@/lib/pro-connect.server");
    const db = await admin();
    const { error } = await db
      .from("pro_oauth_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
