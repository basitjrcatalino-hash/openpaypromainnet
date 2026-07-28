import { createHmac, createHash, randomBytes } from "crypto";
import type {
  SolanaSignInInput,
  SolanaSignInOutput,
} from "@solana/wallet-standard-features";
import { verifySignIn } from "@solana/wallet-standard-util";
import type { WalletAccount } from "@wallet-standard/base";

const STATEMENT =
  "Clicking Sign or Approve only means you have proved this wallet is owned by you. This request will not trigger any blockchain transaction or cost any gas fee.";

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

export function createSolanaSignInInput(
  secret: string,
  opts: { domain: string; uri: string },
): SolanaSignInInput {
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
    chainId: "mainnet",
    nonce,
    issuedAt,
    expirationTime,
    requestId,
    resources: ["https://phantom.app/", "https://github.com/phantom/sign-in-with-solana"],
  };
}

export function assertValidSignInInput(
  secret: string,
  input: SolanaSignInInput,
  expectedDomain: string,
): void {
  if (!input.domain || !input.nonce || !input.issuedAt || !input.expirationTime || !input.requestId) {
    throw new Error("Incomplete sign-in input");
  }
  if (input.domain !== expectedDomain) {
    throw new Error("Sign-in domain mismatch");
  }
  const expectedRequestId = signRequestId(secret, {
    domain: input.domain,
    nonce: input.nonce,
    issuedAt: input.issuedAt,
    expirationTime: input.expirationTime,
  });
  if (input.requestId !== expectedRequestId) {
    throw new Error("Invalid sign-in request");
  }
  const exp = Date.parse(input.expirationTime);
  const iat = Date.parse(input.issuedAt);
  const now = Date.now();
  if (!Number.isFinite(exp) || !Number.isFinite(iat)) {
    throw new Error("Invalid sign-in timestamps");
  }
  if (now > exp) throw new Error("Sign-in request expired");
  if (Math.abs(now - iat) > 10 * 60 * 1000) {
    throw new Error("Sign-in issuedAt out of range");
  }
}

function bytesFromJson(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.type === "string" && Array.isArray(obj.data)) {
      return Uint8Array.from(obj.data as number[]);
    }
    const keys = Object.keys(obj)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    if (keys.length) return Uint8Array.from(keys.map((k) => Number(obj[k])));
  }
  if (typeof value === "string") {
    try {
      return Uint8Array.from(Buffer.from(value, "base64"));
    } catch {
      /* fall through */
    }
  }
  throw new Error("Invalid byte payload in sign-in output");
}

export function deserializeSignInOutput(raw: unknown): SolanaSignInOutput {
  const output = raw as {
    account?: {
      address?: string;
      publicKey?: unknown;
      chains?: readonly string[];
      features?: readonly string[];
      label?: string;
      icon?: string;
    };
    signature?: unknown;
    signedMessage?: unknown;
    signatureType?: "ed25519";
  };
  if (!output?.account?.address || output.signature == null || output.signedMessage == null) {
    throw new Error("Malformed sign-in output");
  }
  const publicKey = bytesFromJson(output.account.publicKey);
  return {
    account: {
      address: output.account.address,
      publicKey,
      chains: (output.account.chains ?? ["solana:mainnet"]) as WalletAccount["chains"],
      features: (output.account.features ?? []) as WalletAccount["features"],
      label: output.account.label,
      icon: output.account.icon as WalletAccount["icon"],
    },
    signature: bytesFromJson(output.signature),
    signedMessage: bytesFromJson(output.signedMessage),
    signatureType: output.signatureType,
  };
}

export function verifySolanaSignIn(
  input: SolanaSignInInput,
  output: SolanaSignInOutput,
): boolean {
  return verifySignIn(input, output);
}

export function solanaAuthCredentials(
  secret: string,
  address: string,
): { email: string; password: string } {
  const id = createHash("sha256").update(address).digest("hex").slice(0, 32);
  const email = `solana-${id}@solana.openpay.local`;
  const password = createHash("sha256")
    .update(`${secret}:solana:${address}`)
    .digest("hex");
  return { email, password };
}

export function shortenSolanaAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
