// OpenPay account-connect protocol (server-only).
// OpenPay Pro starts a connect; user confirms on OpenPay; callback returns a signed code.

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

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

export function createConnectState(userId: string, ttlSec = 600): string {
  const payload: ConnectStatePayload = {
    uid: userId,
    n: randomBytes(12).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmacHex(body)}`;
}

export function verifyConnectState(state: string): ConnectStatePayload {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Invalid connect state");
  if (!safeEq(sig, hmacHex(body))) throw new Error("Invalid connect state signature");
  const payload = JSON.parse(fromB64url(body)) as ConnectStatePayload;
  if (!payload?.uid || !payload.exp) throw new Error("Invalid connect state payload");
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Connect session expired — try again");
  return payload;
}

/** Mint a connect code (OpenPay authorize server should call this logic after user consent). */
export function createConnectCode(account: {
  account_number?: string;
  username?: string;
  name?: string;
  email?: string;
  user_id?: string;
}, ttlSec = 300): string {
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

export function buildOpenPayAuthorizeUrl(opts: {
  origin: string;
  state: string;
  clientId?: string;
}): string {
  const base =
    process.env.OPENPAY_OAUTH_AUTHORIZE_URL ||
    process.env.OPENPAY_CONNECT_AUTHORIZE_URL ||
    "https://openpy.space/oauth/authorize";
  const clientId =
    opts.clientId ||
    process.env.OPENPAY_OAUTH_CLIENT_ID ||
    process.env.OPENPAY_CONNECT_CLIENT_ID ||
    "openpay-pro";
  const redirectUri = `${opts.origin}/openpay/connect/callback`;
  const url = new URL(base);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", opts.state);
  url.searchParams.set("scope", "profile balance");
  url.searchParams.set("app_name", "OpenPay Pro");
  return url.toString();
}
