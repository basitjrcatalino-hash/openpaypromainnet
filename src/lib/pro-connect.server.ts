/**
 * OpenPay Pro Connect — third-party integration engine (server-only).
 *
 * Gives external apps two rails:
 *   1. OpenPay Pro Auth  — OAuth 2.0 authorization-code sign-in (`/pro/authorize`)
 *   2. OpenPay Pro Pay   — charges paid from the user's OpenPay Pro OUSD balance
 *
 * Never import this file from a route component — it reads the service-role client.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const PRO_SCOPES = ["profile", "balance", "payments"] as const;
export type ProScope = (typeof PRO_SCOPES)[number];

export const PRO_TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
export const PRO_CODE_TTL_SEC = 600; // 10 minutes

export function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

function safeEq(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function newClientId() {
  return `opro_live_${randomBytes(10).toString("hex")}`;
}
export function newClientSecret() {
  return `oprs_live_${randomBytes(24).toString("hex")}`;
}
export function newAuthorizationCode() {
  return `oprc_${randomBytes(24).toString("hex")}`;
}
export function newAccessToken() {
  return `oprat_${randomBytes(28).toString("hex")}`;
}

export function normalizeScope(raw?: string | null): string {
  const parts = String(raw || "profile")
    .split(/[\s,+]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => (PRO_SCOPES as readonly string[]).includes(s));
  const uniq = Array.from(new Set(parts.length ? parts : ["profile"]));
  return uniq.join(" ");
}

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type ProApp = {
  id: string;
  owner_user_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  client_id: string;
  client_secret_hash: string;
  redirect_uris: string[];
  scopes: string[];
  active: boolean;
};

export async function findAppByClientId(clientId: string): Promise<ProApp | null> {
  const db = await admin();
  const { data } = await db
    .from("pro_oauth_apps")
    .select(
      "id, owner_user_id, name, description, logo_url, website_url, client_id, client_secret_hash, redirect_uris, scopes, active",
    )
    .eq("client_id", clientId.trim())
    .maybeSingle();
  return (data as ProApp | null) ?? null;
}

/** Authenticate an app with client_id + client_secret (Basic or JSON body). */
export async function authenticateApp(
  clientId: string,
  clientSecret: string,
): Promise<ProApp> {
  const app = await findAppByClientId(clientId);
  if (!app || !app.active) throw new Error("invalid_client");
  if (!clientSecret || !safeEq(app.client_secret_hash, sha256(clientSecret.trim()))) {
    throw new Error("invalid_client");
  }
  return app;
}

/** Read client credentials from Basic auth header or a JSON/form body. */
export function readClientCredentials(
  request: Request,
  body: Record<string, unknown>,
): { clientId: string; clientSecret: string } {
  const auth = request.headers.get("authorization") || "";
  if (/^basic\s+/i.test(auth)) {
    const decoded = Buffer.from(auth.replace(/^basic\s+/i, ""), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx > 0) {
      return { clientId: decoded.slice(0, idx), clientSecret: decoded.slice(idx + 1) };
    }
  }
  return {
    clientId: String(body.client_id ?? request.headers.get("x-client-id") ?? "").trim(),
    clientSecret: String(
      body.client_secret ?? request.headers.get("x-client-secret") ?? "",
    ).trim(),
  };
}

export function redirectUriAllowed(app: ProApp, uri: string): boolean {
  const target = uri.trim().replace(/\/$/, "");
  return (app.redirect_uris || []).some((u) => u.trim().replace(/\/$/, "") === target);
}

export async function issueAuthorizationCode(opts: {
  appId: string;
  userId: string;
  redirectUri: string;
  scope: string;
}): Promise<string> {
  const db = await admin();
  const code = newAuthorizationCode();
  const { error } = await db.from("pro_oauth_codes").insert({
    code_hash: sha256(code),
    app_id: opts.appId,
    user_id: opts.userId,
    redirect_uri: opts.redirectUri,
    scope: opts.scope,
    expires_at: new Date(Date.now() + PRO_CODE_TTL_SEC * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

export async function exchangeAuthorizationCode(opts: {
  app: ProApp;
  code: string;
  redirectUri?: string;
}): Promise<{ access_token: string; expires_in: number; scope: string; user_id: string }> {
  const db = await admin();
  const { data: row } = await db
    .from("pro_oauth_codes")
    .select("id, app_id, user_id, redirect_uri, scope, expires_at, used_at")
    .eq("code_hash", sha256(opts.code.trim()))
    .maybeSingle();
  if (!row || row.app_id !== opts.app.id) throw new Error("invalid_grant");
  if (row.used_at) throw new Error("invalid_grant");
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("invalid_grant");
  if (
    opts.redirectUri &&
    opts.redirectUri.trim().replace(/\/$/, "") !== row.redirect_uri.replace(/\/$/, "")
  ) {
    throw new Error("invalid_grant");
  }

  await db.from("pro_oauth_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);

  const token = newAccessToken();
  const { error } = await db.from("pro_oauth_tokens").insert({
    token_hash: sha256(token),
    app_id: opts.app.id,
    user_id: row.user_id,
    scope: row.scope,
    expires_at: new Date(Date.now() + PRO_TOKEN_TTL_SEC * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);

  return {
    access_token: token,
    expires_in: PRO_TOKEN_TTL_SEC,
    scope: row.scope,
    user_id: row.user_id,
  };
}

export type ProTokenContext = { app: ProApp; userId: string; scope: string; tokenId: string };

export async function resolveAccessToken(request: Request): Promise<ProTokenContext> {
  const raw =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.headers.get("x-access-token")?.trim() ||
    "";
  if (!raw) throw new Error("missing_token");
  const db = await admin();
  const { data: row } = await db
    .from("pro_oauth_tokens")
    .select("id, app_id, user_id, scope, expires_at, revoked_at")
    .eq("token_hash", sha256(raw))
    .maybeSingle();
  if (!row || row.revoked_at) throw new Error("invalid_token");
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("token_expired");

  const { data: app } = await db
    .from("pro_oauth_apps")
    .select(
      "id, owner_user_id, name, description, logo_url, website_url, client_id, client_secret_hash, redirect_uris, scopes, active",
    )
    .eq("id", row.app_id)
    .maybeSingle();
  if (!app || !app.active) throw new Error("invalid_token");

  void db
    .from("pro_oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(() => undefined);

  return { app: app as ProApp, userId: row.user_id, scope: row.scope, tokenId: row.id };
}

export function hasScope(scope: string, needed: ProScope): boolean {
  return scope.split(/\s+/).includes(needed);
}

/* ------------------------------------------------------------------ */
/* Profile + balance                                                    */
/* ------------------------------------------------------------------ */

export type ProWallet = { id: string; address: string; ousd_balance: number };

export async function getActiveWallet(userId: string): Promise<ProWallet | null> {
  const db = await admin();
  const { data } = await db
    .from("wallets")
    .select("id, address, ousd_balance, is_active, created_at")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1);
  const w = (data ?? [])[0];
  if (!w) return null;
  return { id: w.id, address: w.address, ousd_balance: Number(w.ousd_balance ?? 0) };
}

export async function getProfileSummary(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  const wallet = await getActiveWallet(userId);
  return {
    user_id: userId,
    username: data?.username ?? null,
    display_name: data?.display_name ?? null,
    avatar_url: data?.avatar_url ?? null,
    wallet_address: wallet?.address ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Charges                                                              */
/* ------------------------------------------------------------------ */

export type ProCharge = {
  id: string;
  app_id: string;
  amount: number;
  currency: string;
  description: string | null;
  reference: string | null;
  status: string;
  payer_user_id: string | null;
  success_url: string | null;
  cancel_url: string | null;
  paid_at: string | null;
  expires_at: string;
  created_at: string;
};

export function checkoutUrl(origin: string, chargeId: string) {
  return `${origin.replace(/\/$/, "")}/pro/checkout/${chargeId}`;
}

export function publicOrigin(request?: Request): string {
  const env = (process.env.OPENPAY_PRO_PUBLIC_ORIGIN || process.env.VITE_APP_URL || "").trim();
  if (env) return env.replace(/\/$/, "");
  if (request) {
    try {
      return new URL(request.url).origin;
    } catch {
      /* ignore */
    }
  }
  return "https://openpaypro.space";
}

export function serializeCharge(charge: ProCharge, origin: string) {
  return {
    id: charge.id,
    amount: Number(charge.amount),
    currency: charge.currency,
    description: charge.description,
    reference: charge.reference,
    status: expandStatus(charge),
    checkout_url: checkoutUrl(origin, charge.id),
    success_url: charge.success_url,
    cancel_url: charge.cancel_url,
    paid_at: charge.paid_at,
    expires_at: charge.expires_at,
    created_at: charge.created_at,
  };
}

export function expandStatus(charge: Pick<ProCharge, "status" | "expires_at">) {
  if (charge.status === "created" && new Date(charge.expires_at).getTime() < Date.now()) {
    return "expired";
  }
  return charge.status;
}

export async function getCharge(id: string): Promise<ProCharge | null> {
  const db = await admin();
  const { data } = await db.from("pro_charges").select("*").eq("id", id).maybeSingle();
  return (data as ProCharge | null) ?? null;
}

const CHARGE_TTL_DEFAULT_SEC = 30 * 60; // 30 minutes (matches DB default)
const CHARGE_TTL_MAX_SEC = 2 * 60 * 60; // 2 hours

export async function createCharge(opts: {
  app: ProApp;
  amount: number;
  description?: string | null;
  reference?: string | null;
  success_url?: string | null;
  cancel_url?: string | null;
  expires_in?: number;
}): Promise<ProCharge> {
  const amount = Math.round(Number(opts.amount) * 1e8) / 1e8;
  if (!(amount > 0) || !Number.isFinite(amount)) throw new Error("invalid_amount");

  const ttl = Math.min(
    Math.max(Math.floor(opts.expires_in ?? CHARGE_TTL_DEFAULT_SEC), 60),
    CHARGE_TTL_MAX_SEC,
  );
  const db = await admin();
  const { data, error } = await db
    .from("pro_charges")
    .insert({
      app_id: opts.app.id,
      amount,
      currency: "OUSD",
      description: opts.description?.trim() || null,
      reference: opts.reference?.trim() || null,
      success_url: opts.success_url?.trim() || null,
      cancel_url: opts.cancel_url?.trim() || null,
      expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ProCharge;
}

export async function listCharges(
  app: ProApp,
  opts?: { status?: string; limit?: number },
): Promise<ProCharge[]> {
  const db = await admin();
  let q = db
    .from("pro_charges")
    .select("*")
    .eq("app_id", app.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(opts?.limit ?? 25, 1), 100));
  if (opts?.status && opts.status !== "expired") {
    q = q.eq("status", opts.status);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as ProCharge[];
  if (opts?.status === "expired") {
    rows = rows.filter((c) => expandStatus(c) === "expired");
  } else if (opts?.status === "created") {
    rows = rows.filter((c) => expandStatus(c) === "created");
  }
  return rows;
}

export async function cancelCharge(app: ProApp, chargeId: string): Promise<ProCharge> {
  const charge = await getCharge(chargeId);
  if (!charge || charge.app_id !== app.id) throw new Error("not_found");
  const status = expandStatus(charge);
  if (status === "paid") throw new Error("already_paid");
  if (status === "canceled") return charge;
  if (status === "expired") throw new Error("expired");

  const db = await admin();
  const { data, error } = await db
    .from("pro_charges")
    .update({ status: "canceled" })
    .eq("id", charge.id)
    .eq("app_id", app.id)
    .eq("status", "created")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("already_paid");
  return data as ProCharge;
}

/** Pay a charge from the signed-in user's OUSD balance → app owner's wallet. */
export async function payCharge(
  chargeId: string,
  payerUserId: string,
): Promise<{ ok: true; charge: ProCharge; amount: number }> {
  const db = await admin();
  const charge = await getCharge(chargeId);
  if (!charge) throw new Error("Charge not found");
  if (charge.status === "paid") throw new Error("This charge was already paid");
  if (charge.status !== "created") throw new Error(`Charge is ${charge.status}`);
  if (new Date(charge.expires_at).getTime() < Date.now()) throw new Error("Charge expired");

  const { data: app } = await db
    .from("pro_oauth_apps")
    .select("id, name, owner_user_id, active")
    .eq("id", charge.app_id)
    .maybeSingle();
  if (!app || !app.active) throw new Error("App is not active");
  if (app.owner_user_id === payerUserId) throw new Error("You cannot pay your own app");

  const amount = Math.round(Number(charge.amount) * 1e8) / 1e8;
  const payer = await getActiveWallet(payerUserId);
  if (!payer) throw new Error("Active wallet not found");
  if (payer.ousd_balance < amount) throw new Error("Insufficient OUSD balance");

  const merchant = await getActiveWallet(app.owner_user_id);
  if (!merchant) throw new Error("Merchant wallet unavailable");

  // Claim the charge first so a double click can never pay twice.
  const { data: claimed } = await db
    .from("pro_charges")
    .update({
      status: "paid",
      payer_user_id: payerUserId,
      paid_at: new Date().toISOString(),
    })
    .eq("id", charge.id)
    .eq("status", "created")
    .select("*")
    .maybeSingle();
  if (!claimed) throw new Error("This charge was already paid");

  try {
    await db
      .from("wallets")
      .update({ ousd_balance: Math.round((payer.ousd_balance - amount) * 1e8) / 1e8 })
      .eq("id", payer.id);
    await db
      .from("wallets")
      .update({ ousd_balance: Math.round((merchant.ousd_balance + amount) * 1e8) / 1e8 })
      .eq("id", merchant.id);

    const memo = `Pro Pay · ${app.name}${charge.reference ? ` · ${charge.reference}` : ""}`;
    await db.from("transactions").insert([
      {
        wallet_id: payer.id,
        type: "send",
        status: "confirmed",
        amount,
        usd_value: amount,
        token_symbol: "OUSD",
        counterparty: app.name,
        memo,
      },
      {
        wallet_id: merchant.id,
        type: "receive",
        status: "confirmed",
        amount,
        usd_value: amount,
        token_symbol: "OUSD",
        counterparty: "OpenPay Pro Connect",
        memo,
      },
    ]);
  } catch (e) {
    await db.from("pro_charges").update({ status: "created", paid_at: null }).eq("id", charge.id);
    throw e;
  }

  return { ok: true, charge: claimed as ProCharge, amount };
}
