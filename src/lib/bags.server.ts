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

export async function getBagsSdk(): Promise<BagsSDK> {
  const key = requireBagsApiKey();
  const rpc = getBagsRpcUrl();
  if (cached && cached.key === key && cached.rpc === rpc) return cached.sdk;
  // Dynamic import keeps CJS BagsSDK off the critical path for /auth/me etc.
  const { BagsSDK } = await import("@bagsfm/bags-sdk");
  const connection = new Connection(rpc, COMMITMENT);
  const sdk = new BagsSDK(key, connection, COMMITMENT);
  cached = { sdk, rpc, key };
  return sdk;
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
  const { serializeVersionedTransaction } = await import("@bagsfm/bags-sdk");
  return {
    txBase64: serializeVersionedTransaction(tx),
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
