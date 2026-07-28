/**
 * Verify MetaMask Embedded Wallets (Web3Auth) identity tokens.
 * JWKS: https://api-auth.web3auth.io/.well-known/jwks.json
 * Docs: https://docs.metamask.io/embedded-wallets/authentication/id-token/
 */
import { createHash } from "crypto";
import * as jose from "jose";

export const WEB3AUTH_JWKS_URL =
  process.env.WEB3AUTH_JWKS_URL?.trim() ||
  "https://api-auth.web3auth.io/.well-known/jwks.json";

const FALLBACK_JWKS_URLS = [
  "https://api-auth.web3auth.io/jwks",
  "https://authjs.web3auth.io/jwks",
  "https://api.web3auth.io/citadel-service/.well-known/jwks.json",
] as const;

export function getWeb3AuthClientId(): string {
  return (
    process.env.WEB3AUTH_CLIENT_ID?.trim() ||
    process.env.VITE_WEB3AUTH_CLIENT_ID?.trim() ||
    ""
  );
}

/** Dashboard client secret — server-only; not required for JWKS verify. */
export function getWeb3AuthClientSecret(): string {
  return process.env.WEB3AUTH_CLIENT_SECRET?.trim() || "";
}

export type Web3AuthIdTokenPayload = {
  email?: string;
  name?: string;
  profileImage?: string;
  userId?: string;
  authConnection?: string;
  groupedAuthConnectionId?: string;
  wallets?: Array<{
    public_key?: string;
    type?: string;
    curve?: string;
    address?: string;
  }>;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
};

async function verifyWithJwks(
  idToken: string,
  jwksUrl: string,
  audience: string,
): Promise<Web3AuthIdTokenPayload> {
  const jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
  const { payload } = await jose.jwtVerify(idToken, jwks, {
    algorithms: ["ES256"],
    audience,
    issuer: [
      "https://api-auth.web3auth.io",
      "https://authjs.web3auth.io",
      "web3auth.io",
    ],
  });
  return payload as Web3AuthIdTokenPayload;
}

export async function verifyWeb3AuthIdToken(
  idToken: string,
): Promise<Web3AuthIdTokenPayload> {
  const audience = getWeb3AuthClientId();
  if (!audience) {
    throw new Error("WEB3AUTH_CLIENT_ID is not configured on the server");
  }
  if (!idToken?.trim()) {
    throw new Error("Missing identity token");
  }

  const urls = [WEB3AUTH_JWKS_URL, ...FALLBACK_JWKS_URLS.filter((u) => u !== WEB3AUTH_JWKS_URL)];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      return await verifyWithJwks(idToken, url, audience);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Identity token verification failed");
}

export function web3AuthCredentials(
  secret: string,
  subject: string,
): { email: string; password: string } {
  const id = createHash("sha256").update(subject.toLowerCase()).digest("hex").slice(0, 32);
  const email = `mm-${id}@metamask.openpay.local`;
  const password = createHash("sha256")
    .update(`${secret}:web3auth:${subject.toLowerCase()}`)
    .digest("hex");
  return { email, password };
}

export function web3AuthSubject(payload: Web3AuthIdTokenPayload): string {
  return (
    payload.userId ||
    payload.email ||
    payload.wallets?.find((w) => w.public_key)?.public_key ||
    ""
  );
}
