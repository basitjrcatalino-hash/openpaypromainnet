// OpenPay OAuth 2.0 connect helpers (server-only).
// Docs: GET https://openpy.space/connect → POST /oauth/token → GET /user/me

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/** Legacy Pro-minted connect codes (confirm API). Official flow uses opc_… from OpenPay. */
const AUD = "openpay-pro-connect";

function partnerKey(): string {
  const key =
    process.env.OPENPAY_PARTNER_API_KEY ||
    process.env.OPENPAY_API_KEY ||
    process.env.OPENPAY_TRANSFER_API_KEY ||
    "";
  if (!key) throw new Error("OPENPAY_PARTNER_API_KEY not configured");
  return key;
}

function partnerBase(): string {
  return (
    process.env.OPENPAY_PARTNER_API_BASE ||
    process.env.OPENPAY_API_BASE ||
    "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api"
  );
}

function b64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}

function hmacHex(payload: string, key = partnerKey()) {
  return createHmac("sha256", key).update(payload).digest("hex");
}

function safeEq(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export type ConnectStatePayload = {
  uid: string;
  n: string;
  exp: number;
  redirect_uri: string;
};

export type ConnectAccountPayload = {
  account_number?: string;
  username?: string;
  name?: string;
  email?: string;
  user_id?: string;
  iat: number;
  exp: number;
  aud: string;
};

export type OAuthTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  user_id?: string;
};

export type OAuthUserProfile = {
  user_id?: string;
  account_number?: string;
  full_name?: string;
  username?: string;
  avatar_url?: string;
  balance?: number;
  currency?: string;
  scope?: string;
  email?: string;
};

export function createConnectState(
  userId: string,
  redirectUri: string,
  ttlSec = 600,
): string {
  const payload: ConnectStatePayload = {
    uid: userId,
    n: randomBytes(12).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + ttlSec,
    redirect_uri: redirectUri,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmacHex(body)}`;
}

export function verifyConnectState(state: string): ConnectStatePayload {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Invalid connect state");
  if (!safeEq(sig, hmacHex(body))) throw new Error("Invalid connect state signature");
  const payload = JSON.parse(fromB64url(body)) as ConnectStatePayload;
  if (!payload?.uid || !payload.exp || !payload.redirect_uri) {
    throw new Error("Invalid connect state payload");
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Connect session expired — try again");
  }
  return payload;
}

/** Legacy: mint a signed account code (used by POST /api/public/openpay/connect/confirm). */
export function createConnectCode(
  account: {
    account_number?: string;
    username?: string;
    name?: string;
    email?: string;
    user_id?: string;
  },
  ttlSec = 300,
): string {
  if (!account.account_number && !account.username && !account.email && !account.user_id) {
    throw new Error("Account identity required");
  }
  const payload: ConnectAccountPayload = {
    ...account,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSec,
    aud: AUD,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmacHex(body)}`;
}

export function verifyConnectCode(code: string): ConnectAccountPayload {
  const [body, sig] = code.split(".");
  if (!body || !sig) throw new Error("Invalid connect code");
  if (!safeEq(sig, hmacHex(body))) throw new Error("Invalid connect code signature");
  const payload = JSON.parse(fromB64url(body)) as ConnectAccountPayload;
  if (payload.aud !== AUD) throw new Error("Invalid connect audience");
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Connect code expired — try again");
  }
  return payload;
}

const DEFAULT_CLIENT_ID = "e9248f5d-3971-4cbc-9032-9b678c9b71ae";
/** Partner app redirect URIs are registered for production only — never send localhost. */
const PRODUCTION_ORIGIN = "https://openpaypromainnet.lovable.app";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim(),
  );
}

/** Partner app UUID only — ignore legacy slugs like "openpay-pro". */
function resolveClientId(explicit?: string): string {
  const candidates = [
    explicit,
    process.env.OPENPAY_OAUTH_CLIENT_ID,
    process.env.OPENPAY_CONNECT_CLIENT_ID,
  ];
  for (const c of candidates) {
    const v = (c || "").trim();
    if (v && isUuid(v)) return v;
  }
  return DEFAULT_CLIENT_ID;
}

/**
 * Origin used in partner redirect_uri / success_url.
 * Localhost is never sent — OpenPay only accepts registered production URIs.
 */
export function resolvePartnerRedirectOrigin(requested?: string): string {
  const configured = (
    process.env.OPENPAY_OAUTH_PUBLIC_ORIGIN ||
    process.env.OPENPAY_PRO_PUBLIC_ORIGIN ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (configured) return configured;

  const req = (requested || "").trim().replace(/\/$/, "");
  if (!req || /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(req)) {
    return PRODUCTION_ORIGIN;
  }
  // Lovable preview hosts also need exact URI registration — prefer production
  if (/lovable\.app$/i.test(new URL(req).hostname) && !req.includes("openpaypromainnet")) {
    return PRODUCTION_ORIGIN;
  }
  return req;
}

export function buildOpenPayAuthorizeUrl(opts: {
  origin: string;
  state: string;
  clientId?: string;
}): { authorize_url: string; redirect_uri: string } {
  const base =
    process.env.OPENPAY_OAUTH_AUTHORIZE_URL ||
    process.env.OPENPAY_CONNECT_AUTHORIZE_URL ||
    "https://openpy.space/connect";
  const clientId = resolveClientId(opts.clientId);
  const redirect_uri = `${resolvePartnerRedirectOrigin(opts.origin)}/openpay/connect/callback`;
  const url = new URL(base);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirect_uri);
  url.searchParams.set("scope", "profile balance");
  url.searchParams.set("state", opts.state);
  return { authorize_url: url.toString(), redirect_uri };
}

/** Exchange opc_… authorization code for opa_live_… access token. */
export async function exchangeOAuthCode(opts: {
  code: string;
  redirect_uri: string;
  clientId?: string;
}): Promise<OAuthTokenResponse> {
  const clientId = resolveClientId(opts.clientId);
  const res = await fetch(`${partnerBase()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirect_uri,
      client_id: clientId,
      client_secret: partnerKey(),
    }),
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(body?.error || body?.message || `OAuth token exchange failed (${res.status})`);
  }
  if (!body?.access_token) throw new Error("OAuth token response missing access_token");
  return body as OAuthTokenResponse;
}

/** Call /user/me with user access token (opa_live_…). */
export async function fetchOAuthUserMe(accessToken: string): Promise<OAuthUserProfile> {
  const res = await fetch(`${partnerBase()}/user/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(body?.error || body?.message || `OpenPay /user/me failed (${res.status})`);
  }
  return {
    user_id: body.user_id,
    account_number: body.account_number,
    full_name: body.full_name ?? body.name,
    username: body.username,
    avatar_url: body.avatar_url,
    balance: typeof body.balance === "number" ? body.balance : undefined,
    currency: body.currency,
    scope: body.scope,
    email: body.email,
  };
}

export async function fetchOAuthUserBalance(
  accessToken: string,
): Promise<{ balance: number; currency?: string }> {
  const res = await fetch(`${partnerBase()}/user/balance`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(body?.error || body?.message || `OpenPay /user/balance failed (${res.status})`);
  }
  return {
    balance: Number(body.balance ?? 0),
    currency: body.currency,
  };
}
