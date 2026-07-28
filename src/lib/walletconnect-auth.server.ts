/**
 * WalletConnect / EVM Sign-In (EIP-4361 SIWE) — server helpers.
 */
import { createHmac, createHash, randomBytes } from "crypto";
import { verifyMessage, getAddress, isAddress } from "viem";

import type { WcSignInChallenge } from "@/lib/walletconnect-auth";

export type { WcSignInChallenge };

const STATEMENT =
  "Sign in to OpenPay Pro. This request will not trigger a blockchain transaction or cost gas.";

function signRequestId(
  secret: string,
  parts: {
    domain: string;
    nonce: string;
    issuedAt: string;
    expirationTime: string;
  },
): string {
  const payload = `${parts.domain}|${parts.nonce}|${parts.issuedAt}|${parts.expirationTime}`;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function randomNonce(len = 16): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

export function createWalletConnectSignInChallenge(
  secret: string,
  opts: { domain: string; uri: string; chainId?: number },
): WcSignInChallenge {
  const now = Date.now();
  const issuedAt = new Date(now).toISOString();
  const expirationTime = new Date(now + 10 * 60 * 1000).toISOString();
  const nonce = randomNonce(16);
  const requestId = signRequestId(secret, {
    domain: opts.domain,
    nonce,
    issuedAt,
    expirationTime,
  });

  return {
    domain: opts.domain,
    statement: STATEMENT,
    uri: opts.uri,
    version: "1",
    chainId: opts.chainId ?? 1,
    nonce,
    issuedAt,
    expirationTime,
    requestId,
  };
}

export function assertValidWcChallenge(
  secret: string,
  challenge: WcSignInChallenge,
  expectedDomain: string,
): void {
  if (
    !challenge.domain ||
    !challenge.nonce ||
    !challenge.issuedAt ||
    !challenge.expirationTime ||
    !challenge.requestId
  ) {
    throw new Error("Incomplete sign-in challenge");
  }
  if (challenge.domain !== expectedDomain) {
    throw new Error("Sign-in domain mismatch");
  }
  const expectedRequestId = signRequestId(secret, {
    domain: challenge.domain,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    expirationTime: challenge.expirationTime,
  });
  if (challenge.requestId !== expectedRequestId) {
    throw new Error("Invalid sign-in request");
  }
  const exp = Date.parse(challenge.expirationTime);
  const iat = Date.parse(challenge.issuedAt);
  const now = Date.now();
  if (!Number.isFinite(exp) || !Number.isFinite(iat)) {
    throw new Error("Invalid sign-in timestamps");
  }
  if (now > exp) throw new Error("Sign-in request expired");
  if (Math.abs(now - iat) > 10 * 60 * 1000) {
    throw new Error("Sign-in issuedAt out of range");
  }
}

/** Build EIP-4361 message for personal_sign. */
export function buildSiweMessage(challenge: WcSignInChallenge, address: string): string {
  const checksum = getAddress(address);
  return [
    `${challenge.domain} wants you to sign in with your Ethereum account:`,
    checksum,
    "",
    challenge.statement,
    "",
    `URI: ${challenge.uri}`,
    `Version: ${challenge.version}`,
    `Chain ID: ${challenge.chainId}`,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${challenge.issuedAt}`,
    `Expiration Time: ${challenge.expirationTime}`,
    `Request ID: ${challenge.requestId}`,
  ].join("\n");
}

export async function verifyWalletConnectSignIn(opts: {
  challenge: WcSignInChallenge;
  address: string;
  signature: `0x${string}` | string;
}): Promise<boolean> {
  if (!isAddress(opts.address)) return false;
  const message = buildSiweMessage(opts.challenge, opts.address);
  try {
    return await verifyMessage({
      address: getAddress(opts.address),
      message,
      signature: opts.signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

export function walletConnectAuthCredentials(
  secret: string,
  address: string,
): { email: string; password: string } {
  const normalized = getAddress(address);
  const id = createHash("sha256").update(normalized.toLowerCase()).digest("hex").slice(0, 32);
  const email = `wc-${id}@walletconnect.openpay.local`;
  const password = createHash("sha256")
    .update(`${secret}:walletconnect:${normalized.toLowerCase()}`)
    .digest("hex");
  return { email, password };
}

export function shortenEvmAddress(address: string): string {
  try {
    const a = getAddress(address);
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
  } catch {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
}
