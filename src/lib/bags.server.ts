import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  type Commitment,
} from "@solana/web3.js";
import { BagsSDK, serializeVersionedTransaction } from "@bagsfm/bags-sdk";

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
const COMMITMENT: Commitment = "processed";
const BAGS_API_BASE = "https://public-api-v2.bags.fm/api/v1";

export const BAGS_WSOL_MINT = "So11111111111111111111111111111111111111112";
export const BAGS_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type BagsEncodedTx = {
  txBase64: string;
  kind: "versioned" | "legacy";
};

function requireBagsApiKey(): string {
  const key = String(process.env.BAGS_API_KEY ?? "").trim();
  if (!key) throw new Error("BAGS_API_KEY is not configured on the server");
  return key;
}

export function getBagsUserUuid(): string | null {
  const id = String(process.env.BAGS_USER_UUID ?? "").trim();
  return id || null;
}

/** Partner config PDA (the “Partner Key” from Bags dashboard). */
export function getBagsPartnerConfig(): string | null {
  const v = String(process.env.BAGS_PARTNER_CONFIG ?? "").trim();
  return v || null;
}

/** Partner fee wallet (owner of the partner key). */
export function getBagsPartnerWallet(): string | null {
  const v = String(process.env.BAGS_PARTNER_WALLET ?? "").trim();
  return v || null;
}

export function getBagsPartnerRef(): string {
  return String(process.env.BAGS_PARTNER_REF ?? "mrwain").trim() || "mrwain";
}

export function getBagsPartnerRefUrl(): string {
  const ref = getBagsPartnerRef();
  return (
    String(process.env.BAGS_PARTNER_REF_URL ?? "").trim() ||
    `https://bags.fm/?ref=${encodeURIComponent(ref)}`
  );
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

export function getBagsRpcUrl(): string {
  return (
    String(process.env.SOLANA_RPC_URL ?? "").trim() ||
    String(process.env.VITE_SOLANA_RPC_URL ?? "").trim() ||
    DEFAULT_RPC
  );
}

let cached: { sdk: BagsSDK; rpc: string; key: string } | null = null;

export function getBagsSdk(): BagsSDK {
  const key = requireBagsApiKey();
  const rpc = getBagsRpcUrl();
  if (cached && cached.key === key && cached.rpc === rpc) return cached.sdk;
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

export function encodeVersionedTx(tx: VersionedTransaction): BagsEncodedTx {
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

export function encodeAnyTx(tx: VersionedTransaction | Transaction): BagsEncodedTx {
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

  const sdk = getBagsSdk();
  const connection = sdk.state.getConnection();
  const raw = Buffer.from(signedTxBase64, "base64");
  const signature = await connection.sendRawTransaction(raw, {
    skipPreflight: false,
    preflightCommitment: COMMITMENT,
  });
  await connection.confirmTransaction(signature, COMMITMENT);
  return signature;
}
