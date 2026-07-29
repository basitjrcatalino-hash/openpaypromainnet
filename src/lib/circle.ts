/**
 * Circle Programmable Wallets — server-only client & helpers.
 *
 * Flow (developer-controlled):
 * 1. Register entity secret once in Circle Console → CIRCLE_ENTITY_SECRET
 * 2. Create a wallet set → CIRCLE_WALLET_SET_ID (or auto-create)
 * 3. createWallets({ walletSetId, blockchains, count: 1 }) per user
 * 4. Persist provider wallet id + address in crypto_wallets
 * 5. Listen to webhooks for deposits / tx completion
 *
 * Docs: https://developers.circle.com/wallets/dev-controlled
 * Keys: https://developers.circle.com/api-reference/keys
 *
 * NEVER import this module from client components.
 */

import { createHash, createPublicKey, createVerify, randomUUID } from "crypto";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import type {
  BlockchainId,
  CreateWalletInput,
  SendTransactionInput,
  TokenBalance,
  WalletProvider,
} from "@/lib/wallet-providers/types";

/** Default testnet chain when CIRCLE_BLOCKCHAIN is unset and API key is TEST. */
const DEFAULT_TESTNET_CHAIN: BlockchainId = "ETH-SEPOLIA";
const DEFAULT_MAINNET_CHAIN: BlockchainId = "ETH";

export function getCircleApiKey(): string {
  return (process.env.CIRCLE_API_KEY || "").trim();
}

export function getCircleEntitySecret(): string {
  return (
    process.env.CIRCLE_ENTITY_SECRET ||
    process.env.ENTITY_SECRET ||
    ""
  ).trim();
}

export function getCircleWalletSetId(): string {
  return (process.env.CIRCLE_WALLET_SET_ID || "").trim();
}

export function getCircleBaseUrl(): string {
  return (
    process.env.CIRCLE_BASE_URL ||
    "https://api.circle.com"
  ).trim().replace(/\/$/, "");
}

export function isCircleConfigured(): boolean {
  return Boolean(getCircleApiKey() && getCircleEntitySecret());
}

export function isCircleTestnet(): boolean {
  const key = getCircleApiKey();
  return key.startsWith("TEST_API_KEY:") || key.includes("TEST_API_KEY");
}

export function resolveCircleBlockchain(override?: BlockchainId): BlockchainId {
  if (override) return override;
  const fromEnv = (process.env.CIRCLE_BLOCKCHAIN || "").trim();
  if (fromEnv) return fromEnv;
  return isCircleTestnet() ? DEFAULT_TESTNET_CHAIN : DEFAULT_MAINNET_CHAIN;
}

/**
 * Lazily init Circle developer-controlled wallets SDK.
 * Throws if API key / entity secret missing.
 */
export function getCircleClient() {
  const apiKey = getCircleApiKey();
  const entitySecret = getCircleEntitySecret();
  if (!apiKey) throw new Error("CIRCLE_API_KEY is not configured");
  if (!entitySecret) {
    throw new Error(
      "CIRCLE_ENTITY_SECRET is not configured. Generate & register an entity secret in Circle Console.",
    );
  }
  const baseUrl = process.env.CIRCLE_BASE_URL?.trim();
  return initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
    ...(baseUrl ? { baseUrl } : {}),
  });
}

/**
 * Ensure a wallet set exists. Prefers CIRCLE_WALLET_SET_ID; otherwise creates one.
 * Callers should persist the returned id into env for production.
 */
export async function ensureWalletSetId(name = "OpenPay Pro"): Promise<string> {
  const existing = getCircleWalletSetId();
  if (existing) return existing;

  const client = getCircleClient();
  const res = await client.createWalletSet({
    name,
    idempotencyKey: randomUUID(),
  });
  const id = res.data?.walletSet?.id;
  if (!id) throw new Error("Circle createWalletSet returned no id");
  console.warn(
    `[circle] Created wallet set ${id} — set CIRCLE_WALLET_SET_ID in env for stability`,
  );
  return id;
}

/** Create one Circle wallet for a user (idempotent via idempotencyKey). */
export async function createWallet(input: CreateWalletInput): Promise<{
  providerWalletId: string;
  walletSetId: string;
  address: string;
  blockchain: BlockchainId;
}> {
  const client = getCircleClient();
  const walletSetId = await ensureWalletSetId();
  const blockchain = resolveCircleBlockchain(input.blockchain);

  const res = await client.createWallets({
    accountType: "EOA",
    blockchains: [blockchain as "ETH-SEPOLIA"],
    count: 1,
    walletSetId,
    idempotencyKey: input.idempotencyKey,
    metadata: [{ name: `openpay-${input.userId.slice(0, 8)}`, refId: input.userId }],
  });

  const wallet = res.data?.wallets?.[0];
  if (!wallet?.id || !wallet.address) {
    throw new Error("Circle createWallets returned empty wallet");
  }

  return {
    providerWalletId: wallet.id,
    walletSetId,
    address: wallet.address,
    blockchain: (wallet.blockchain as BlockchainId) || blockchain,
  };
}

/** Fetch a single Circle wallet by id. */
export async function getWallet(providerWalletId: string) {
  const client = getCircleClient();
  const res = await client.getWallet({ id: providerWalletId });
  return res.data?.wallet ?? null;
}

/** List token balances for a Circle wallet. */
export async function getBalance(providerWalletId: string): Promise<TokenBalance[]> {
  const client = getCircleClient();
  const res = await client.getWalletTokenBalance({ id: providerWalletId });
  const rows = res.data?.tokenBalances ?? [];
  return rows.map((b) => ({
    token: b.token?.name || b.token?.symbol || "TOKEN",
    symbol: b.token?.symbol || "?",
    amount: b.amount || "0",
    decimals: b.token?.decimals,
    tokenAddress: b.token?.tokenAddress ?? null,
    tokenId: b.token?.id ?? null,
  }));
}

/** List recent transactions for a Circle wallet. */
export async function listTransactions(providerWalletId: string) {
  const client = getCircleClient();
  const res = await client.listTransactions({
    walletIds: [providerWalletId],
    pageSize: 50,
  });
  const txs = res.data?.transactions ?? [];
  return txs.map((t) => {
    const inbound = String(t.transactionType || "").toUpperCase().includes("INBOUND")
      || String(t.operation || "").toUpperCase() === "RECEIVE";
    return {
      id: t.id || randomUUID(),
      txHash: t.txHash ?? null,
      amount: t.amounts?.[0] || "0",
      token: t.tokenId || "TOKEN",
      status: t.state || "UNKNOWN",
      direction: (inbound ? "deposit" : "withdraw") as "deposit" | "withdraw",
      createdAt: t.createDate || new Date().toISOString(),
      network: t.blockchain || "",
    };
  });
}

/** Submit an outbound transfer via Circle. */
export async function sendTransaction(input: SendTransactionInput): Promise<{ providerTxId: string }> {
  const client = getCircleClient();
  const res = await client.createTransaction({
    walletId: input.providerWalletId,
    tokenAddress: input.tokenAddress,
    destinationAddress: input.destinationAddress,
    amount: [input.amount],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    idempotencyKey: randomUUID(),
  });
  const id = res.data?.id;
  if (!id) throw new Error("Circle createTransaction returned no id");
  return { providerTxId: id };
}

/**
 * Verify Circle webhook signature (X-Circle-Signature + X-Circle-Key-Id).
 * Uses CIRCLE_WEBHOOK_PUBLIC_KEY (PEM) when set; otherwise accepts in test mode only.
 *
 * Docs: https://developers.circle.com/wallets/webhook-notifications
 */
export function verifyWebhook(
  rawBody: string,
  signatureHeader: string | null,
  keyIdHeader: string | null,
): boolean {
  const pem = (process.env.CIRCLE_WEBHOOK_PUBLIC_KEY || "").trim();
  if (!pem) {
    // Allow unsigned in local/dev when explicitly opted in
    if (process.env.CIRCLE_WEBHOOK_SKIP_VERIFY === "1") {
      console.warn("[circle-webhook] SKIP VERIFY enabled — do not use in production");
      return true;
    }
    console.error("[circle-webhook] CIRCLE_WEBHOOK_PUBLIC_KEY missing");
    return false;
  }
  if (!signatureHeader) return false;

  try {
    const key = createPublicKey(pem);
    const verifier = createVerify("SHA256");
    verifier.update(rawBody);
    verifier.end();
    const sig = Buffer.from(signatureHeader, "base64");
    const ok = verifier.verify(key, sig);
    if (keyIdHeader) {
      // Optional: pin expected key id
      const expected = (process.env.CIRCLE_WEBHOOK_KEY_ID || "").trim();
      if (expected && expected !== keyIdHeader) return false;
    }
    return ok;
  } catch (err) {
    console.error("[circle-webhook] verify failed", err);
    return false;
  }
}

/** Stable idempotency key for a user's Circle wallet creation. */
export function circleWalletIdempotencyKey(userId: string, blockchain: string): string {
  // UUID v4-shaped deterministic key from user+chain (Circle requires UUID format)
  const hex = createHash("sha256").update(`circle:${userId}:${blockchain}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Circle WalletProvider implementation. */
export const circleWalletProvider: WalletProvider = {
  id: "circle",
  createWallet,
  async getAddress(providerWalletId) {
    const w = await getWallet(providerWalletId);
    if (!w?.address) throw new Error("Circle wallet not found");
    return w.address;
  },
  getBalance,
  getTransactions: listTransactions,
  sendTransaction,
};

export {
  createWallet as createCircleWallet,
  getWallet as getCircleWallet,
  getBalance as getCircleBalance,
  listTransactions as listCircleTransactions,
  sendTransaction as sendCircleTransaction,
  verifyWebhook as verifyCircleWebhook,
};
