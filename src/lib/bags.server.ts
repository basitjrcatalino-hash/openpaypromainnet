import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  type Commitment,
} from "@solana/web3.js";
import type { BagsSDK } from "@bagsfm/bags-sdk";

import {
  BAGS_API_BASE,
  getBagsPartnerConfig,
  getBagsPartnerWallet,
  getBagsRpcUrl,
  requireBagsApiKey,
} from "./bags-config.server";

export {
  getBagsPartnerConfig,
  getBagsPartnerRef,
  getBagsPartnerRefUrl,
  getBagsPartnerWallet,
  getBagsRpcUrl,
  getBagsUserUuid,
  requireBagsApiKey,
  bagsApiFetch,
  BAGS_API_BASE,
} from "./bags-config.server";

const COMMITMENT: Commitment = "processed";

export const BAGS_WSOL_MINT = "So11111111111111111111111111111111111111112";
export const BAGS_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type BagsEncodedTx = {
  txBase64: string;
  kind: "versioned" | "legacy";
};

let cached: { sdk: BagsSDK; rpc: string; key: string } | null = null;

function isConstructable(c: unknown): c is new (
  apiKey: string,
  connection: Connection,
  commitment?: Commitment,
) => BagsSDK {
  return typeof c === "function" && !!c.prototype;
}

/** Nitro/Vite CJS interop sometimes nests BagsSDK oddly — walk common shapes. */
function resolveBagsSdkClass(mod: Record<string, unknown>): new (
  apiKey: string,
  connection: Connection,
  commitment?: Commitment,
) => BagsSDK {
  const candidates: unknown[] = [
    mod.BagsSDK,
    (mod.default as { BagsSDK?: unknown } | undefined)?.BagsSDK,
    (mod["module.exports"] as { BagsSDK?: unknown } | undefined)?.BagsSDK,
    mod.default,
    (mod.default as { default?: unknown } | undefined)?.default,
    ((mod.default as { default?: { BagsSDK?: unknown } } | undefined)?.default as
      | { BagsSDK?: unknown }
      | undefined)?.BagsSDK,
  ];
  for (const c of candidates) {
    if (isConstructable(c)) return c;
  }
  throw new Error("BagsSDK is not a constructor (SDK module interop failed)");
}

/** Prefer createRequire (stable CJS) when ESM dynamic import fails on Lovable/Nitro. */
async function loadBagsSdkViaRequire(): Promise<
  new (apiKey: string, connection: Connection, commitment?: Commitment) => BagsSDK
> {
  const { createRequire } = await import("node:module");
  const { join } = await import("node:path");
  const req = createRequire(join(process.cwd(), "package.json"));
  const mod = req("@bagsfm/bags-sdk") as Record<string, unknown>;
  return resolveBagsSdkClass(mod);
}

export async function getBagsSdk(): Promise<BagsSDK> {
  const key = requireBagsApiKey();
  const rpc = getBagsRpcUrl();
  if (cached && cached.key === key && cached.rpc === rpc) return cached.sdk;

  let BagsSDKCtor: new (
    apiKey: string,
    connection: Connection,
    commitment?: Commitment,
  ) => BagsSDK;
  // CJS require is reliable; ESM interop on Nitro often yields a non-constructor.
  try {
    BagsSDKCtor = await loadBagsSdkViaRequire();
  } catch (requireErr) {
    console.warn("[bags] createRequire BagsSDK failed, trying ESM import", requireErr);
    const mod = (await import("@bagsfm/bags-sdk")) as Record<string, unknown>;
    BagsSDKCtor = resolveBagsSdkClass(mod);
  }

  const connection = new Connection(rpc, COMMITMENT);
  const sdk = new BagsSDKCtor(key, connection, COMMITMENT);
  cached = { sdk, rpc, key };
  return sdk;
}

type Bs58Mod = {
  decode: (s: string) => Uint8Array;
  decodeUnsafe?: (s: string) => Uint8Array | undefined;
  default?: { decode: (s: string) => Uint8Array; decodeUnsafe?: (s: string) => Uint8Array | undefined };
};

function loadBs58(): { decode: (s: string) => Uint8Array; decodeUnsafe?: (s: string) => Uint8Array | undefined } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("bs58") as Bs58Mod;
  return mod.default ?? mod;
}

/** Bags REST/SDK txs are often base58; launch docs also use base64. Normalize to base64. */
function bagsTxStringToBase64(encoded: string): string {
  const trimmed = encoded.trim();
  if (!trimmed) throw new Error("Empty Bags transaction");

  // Explicit base64 markers
  if (/[+/=]/.test(trimmed)) {
    const asB64 = Buffer.from(trimmed, "base64");
    if (asB64.length > 32) return trimmed;
  }

  const bs58 = loadBs58();
  const from58 = bs58.decodeUnsafe?.(trimmed);
  if (from58 && from58.length > 32) {
    return Buffer.from(from58).toString("base64");
  }

  try {
    const asB64 = Buffer.from(trimmed, "base64");
    if (asB64.length > 32) return trimmed;
  } catch {
    /* fall through */
  }

  try {
    return Buffer.from(bs58.decode(trimmed)).toString("base64");
  } catch {
    throw new Error("Bags transaction is neither valid base64 nor base58");
  }
}

/** Normalize Bags REST tx payloads into our client signing shape (base64). */
export function normalizeBagsEncodedTx(raw: unknown): BagsEncodedTx {
  if (typeof raw === "string" && raw.length > 20) {
    return { txBase64: bagsTxStringToBase64(raw), kind: "versioned" };
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const encoded =
      (typeof o.txBase64 === "string" && o.txBase64) ||
      (typeof o.transaction === "string" && o.transaction) ||
      (typeof o.tx === "string" && o.tx) ||
      null;
    if (encoded) {
      const kind = o.kind === "legacy" ? "legacy" : "versioned";
      return { txBase64: bagsTxStringToBase64(encoded), kind };
    }
  }
  throw new Error("Bags API returned an unrecognized transaction payload");
}

export function pubkey(value: string, label = "public key"): PublicKey {
  try {
    return new PublicKey(value.trim());
  } catch {
    throw new Error(`Invalid ${label}`);
  }
}

export function getBagsPartnerLaunchArgs(): {
  partner?: PublicKey;
  partnerConfig?: PublicKey;
} {
  const config = getBagsPartnerConfig();
  const wallet = getBagsPartnerWallet();
  if (!config || !wallet) return {};
  return {
    partner: pubkey(wallet, "Bags partner wallet"),
    partnerConfig: pubkey(config, "Bags partner config"),
  };
}

export async function encodeVersionedTx(tx: VersionedTransaction): Promise<BagsEncodedTx> {
  // Prefer raw bytes → base64 (avoids Bags SDK ESM interop + base58 mismatch).
  return {
    txBase64: Buffer.from(tx.serialize()).toString("base64"),
    kind: "versioned",
  };
}

export function encodeLegacyTx(tx: Transaction): BagsEncodedTx {
  const serialized = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  return {
    txBase64: Buffer.from(serialized).toString("base64"),
    kind: "legacy",
  };
}

export async function encodeAnyTx(
  tx: VersionedTransaction | Transaction,
): Promise<BagsEncodedTx> {
  if (tx instanceof VersionedTransaction) return encodeVersionedTx(tx);
  return encodeLegacyTx(tx);
}

export async function bagsPingRemote(): Promise<{ ok: true; message: string }> {
  const res = await fetch("https://public-api-v2.bags.fm/ping");
  if (!res.ok) throw new Error(`Bags ping failed (${res.status})`);
  const data = (await res.json()) as { message?: string };
  return { ok: true, message: data.message || "pong" };
}

export async function bagsSendSignedTransaction(signedTxBase64: string): Promise<string> {
  const apiKey = requireBagsApiKey();
  try {
    const sendRes = await fetch(`${BAGS_API_BASE}/solana/send-transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ transaction: signedTxBase64 }),
    });
    const json = (await sendRes.json()) as {
      success?: boolean;
      response?: { signature?: string } | string;
      error?: string;
    };
    if (sendRes.ok && json.success !== false) {
      const sig =
        typeof json.response === "string"
          ? json.response
          : json.response && typeof json.response === "object"
            ? json.response.signature
            : undefined;
      if (sig) return sig;
    }
    if (json.error) console.warn("[bags] send-transaction:", json.error);
  } catch (err) {
    console.warn("[bags] send-transaction fallback to RPC", err);
  }

  const sdk = await getBagsSdk();
  const connection = sdk.state.getConnection();
  const raw = Buffer.from(signedTxBase64, "base64");
  const signature = await connection.sendRawTransaction(raw, {
    skipPreflight: false,
    preflightCommitment: COMMITMENT,
  });
  await connection.confirmTransaction(signature, COMMITMENT);
  return signature;
}
