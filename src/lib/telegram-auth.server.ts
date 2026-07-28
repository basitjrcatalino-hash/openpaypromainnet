/**
 * Telegram Login (OIDC) — server helpers.
 * Docs: https://core.telegram.org/bots/telegram-login
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import * as jose from "jose";

export const TELEGRAM_AUTH_URL = "https://oauth.telegram.org/auth";
export const TELEGRAM_TOKEN_URL = "https://oauth.telegram.org/token";
export const TELEGRAM_JWKS_URL = "https://oauth.telegram.org/.well-known/jwks.json";
export const TELEGRAM_ISSUER = "https://oauth.telegram.org";

export const TELEGRAM_BRAND_BLUE = "#229ED9";

type TelegramStatePayload = {
  n: string;
  exp: number;
  redirect_uri: string;
  code_verifier: string;
  return_to?: string;
};

function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}

function stateSecret(): string {
  return (
    process.env.TELEGRAM_AUTH_PASSWORD_SECRET ||
    process.env.OPENPAY_AUTH_PASSWORD_SECRET ||
    process.env.TELEGRAM_CLIENT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "openpay-telegram-dev"
  );
}

function hmacHex(body: string): string {
  return createHmac("sha256", stateSecret()).update(body).digest("hex");
}

function safeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function getTelegramClientId(): string {
  return (
    process.env.TELEGRAM_CLIENT_ID?.trim() ||
    process.env.VITE_TELEGRAM_CLIENT_ID?.trim() ||
    ""
  );
}

export function getTelegramClientSecret(): string {
  return process.env.TELEGRAM_CLIENT_SECRET?.trim() || "";
}

/** PKCE S256 challenge from verifier. */
export function pkceChallenge(verifier: string): string {
  const hash = createHash("sha256").update(verifier).digest();
  return b64url(hash);
}

export function createPkceVerifier(): string {
  return b64url(randomBytes(32));
}

export function createTelegramAuthState(opts: {
  redirectUri: string;
  codeVerifier: string;
  returnTo?: string;
  ttlSec?: number;
}): string {
  const payload: TelegramStatePayload = {
    n: randomBytes(12).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + (opts.ttlSec ?? 600),
    redirect_uri: opts.redirectUri,
    code_verifier: opts.codeVerifier,
    return_to: opts.returnTo,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmacHex(body)}`;
}

export function verifyTelegramAuthState(state: string): TelegramStatePayload {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Invalid Telegram auth state");
  if (!safeEq(sig, hmacHex(body))) throw new Error("Invalid Telegram auth state signature");
  const payload = JSON.parse(fromB64url(body)) as TelegramStatePayload;
  if (!payload?.redirect_uri || !payload.code_verifier || !payload.exp) {
    throw new Error("Invalid Telegram auth state payload");
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Telegram sign-in expired — try again");
  }
  return payload;
}

export function resolveTelegramRedirectUri(originHint?: string): string {
  const explicit = (process.env.TELEGRAM_REDIRECT_URI || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");

  // Prefer the browser origin so local/preview hosts get matching BotFather allowlists.
  let origin = "";
  if (originHint) {
    try {
      origin = new URL(originHint).origin;
    } catch {
      origin = "";
    }
  }
  if (!origin) {
    origin = (process.env.OPENPAY_OAUTH_PUBLIC_ORIGIN || "").trim().replace(/\/$/, "");
  }
  if (!origin) origin = "http://localhost:8080";
  return `${origin}/auth/telegram/callback`;
}

export function buildTelegramAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope?: string;
}): string {
  const u = new URL(TELEGRAM_AUTH_URL);
  u.searchParams.set("client_id", opts.clientId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", opts.scope || "openid profile");
  u.searchParams.set("state", opts.state);
  u.searchParams.set("code_challenge", opts.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export type TelegramIdTokenClaims = {
  sub?: string;
  id?: number | string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  picture?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
};

export async function exchangeTelegramCode(opts: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ access_token?: string; id_token: string; expires_in?: number }> {
  const clientId = getTelegramClientId();
  const clientSecret = getTelegramClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("TELEGRAM_CLIENT_ID / TELEGRAM_CLIENT_SECRET are not configured");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: clientId,
    code_verifier: opts.codeVerifier,
  });

  const res = await fetch(TELEGRAM_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${basic}`,
    },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    id_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.id_token) {
    throw new Error(
      json.error_description || json.error || `Telegram token exchange failed (${res.status})`,
    );
  }
  return {
    access_token: json.access_token,
    id_token: json.id_token,
    expires_in: json.expires_in,
  };
}

export async function verifyTelegramIdToken(idToken: string): Promise<TelegramIdTokenClaims> {
  const clientId = getTelegramClientId();
  if (!clientId) throw new Error("TELEGRAM_CLIENT_ID is not configured");

  const jwks = jose.createRemoteJWKSet(new URL(TELEGRAM_JWKS_URL));
  const { payload } = await jose.jwtVerify(idToken, jwks, {
    issuer: TELEGRAM_ISSUER,
    audience: clientId,
  });
  return payload as TelegramIdTokenClaims;
}

export function telegramSubject(claims: TelegramIdTokenClaims): string {
  if (claims.sub) return String(claims.sub);
  if (claims.id != null) return String(claims.id);
  return "";
}

export function telegramCredentials(
  secret: string,
  subject: string,
): { email: string; password: string } {
  const id = createHash("sha256").update(`telegram:${subject}`).digest("hex").slice(0, 32);
  const email = `tg-${id}@telegram.openpay.local`;
  const password = createHash("sha256")
    .update(`${secret}:telegram:${subject}`)
    .digest("hex");
  return { email, password };
}
