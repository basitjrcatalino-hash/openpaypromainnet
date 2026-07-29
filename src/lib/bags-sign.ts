/**
 * Client-side Bags tx signing via Phantom (extension) or Wallet Standard.
 * Never holds private keys — user approves each transaction in their wallet.
 */
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  SolanaSignAndSendTransaction,
  SolanaSignTransaction,
} from "@solana/wallet-standard-features";
import { getWallets } from "@wallet-standard/app";
import { StandardConnect } from "@wallet-standard/features";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import bs58 from "bs58";

import { ensureBuffer } from "@/lib/buffer-polyfill";

export type BagsTxKind = "versioned" | "legacy";

export type BagsEncodedTx = {
  txBase64: string;
  kind: BagsTxKind;
};

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toBase58(): string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey: { toBase58(): string };
  }>;
  signAndSendTransaction?: (
    transaction: Transaction | VersionedTransaction,
    opts?: { skipPreflight?: boolean },
  ) => Promise<{ signature: string } | string>;
  signTransaction?: (
    transaction: Transaction | VersionedTransaction,
  ) => Promise<Transaction | VersionedTransaction>;
  signMessage?: (
    message: Uint8Array,
    display?: "utf8" | "hex",
  ) => Promise<{ signature: Uint8Array } | Uint8Array>;
};

function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  };
  return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null) ?? null;
}

function listSignWallets(): Wallet[] {
  try {
    const { get } = getWallets();
    return get().filter(
      (wallet) =>
        SolanaSignAndSendTransaction in wallet.features ||
        SolanaSignTransaction in wallet.features,
    );
  } catch {
    return [];
  }
}

function pickSolanaAccount(wallet: Wallet): WalletAccount | null {
  return (
    wallet.accounts.find((a) => a.chains.some((c) => c.startsWith("solana:"))) ??
    wallet.accounts[0] ??
    null
  );
}

export async function getBagsWalletAddress(): Promise<string | null> {
  await ensureBuffer();
  const phantom = getPhantomProvider();
  if (phantom?.publicKey) return phantom.publicKey.toBase58();

  for (const wallet of listSignWallets()) {
    const account = pickSolanaAccount(wallet);
    if (account?.address) return account.address;
  }
  return null;
}

export async function connectBagsWallet(): Promise<string> {
  await ensureBuffer();
  const phantom = getPhantomProvider();
  if (phantom) {
    const res = await phantom.connect();
    const address = res.publicKey?.toBase58();
    if (!address) throw new Error("Phantom connected but returned no address");
    return address;
  }

  const wallets = listSignWallets();
  if (!wallets.length) {
    throw new Error("Install Phantom (or another Solana wallet) to use Bags");
  }
  const wallet = wallets[0]!;
  if (StandardConnect in wallet.features) {
    await (wallet.features[StandardConnect] as { connect: () => Promise<unknown> }).connect();
  }
  const account = pickSolanaAccount(wallet);
  if (!account?.address) throw new Error("Wallet connected but returned no Solana address");
  return account.address;
}

function decodeTx(encoded: BagsEncodedTx): Transaction | VersionedTransaction {
  const raw = Buffer.from(encoded.txBase64, "base64");
  if (encoded.kind === "legacy") {
    return Transaction.from(raw);
  }
  return VersionedTransaction.deserialize(raw);
}

function signatureFromBytes(bytes: Uint8Array): string {
  return bs58.encode(bytes);
}

async function signViaWalletStandard(
  encoded: BagsEncodedTx,
): Promise<{ signature?: string; signedTxBase64?: string }> {
  const wallets = listSignWallets();
  if (!wallets.length) throw new Error("No Solana wallet available");
  const wallet = wallets[0]!;
  if (StandardConnect in wallet.features && !wallet.accounts.length) {
    await (wallet.features[StandardConnect] as { connect: () => Promise<unknown> }).connect();
  }
  const account = pickSolanaAccount(wallet);
  if (!account) throw new Error("No Solana account in wallet");

  const bytes = Buffer.from(encoded.txBase64, "base64");

  if (SolanaSignAndSendTransaction in wallet.features) {
    const feature = wallet.features[SolanaSignAndSendTransaction] as {
      signAndSendTransaction: (input: {
        account: WalletAccount;
        transaction: Uint8Array;
        chain?: string;
      }) => Promise<{ signature: Uint8Array }>;
    };
    const { signature } = await feature.signAndSendTransaction({
      account,
      transaction: new Uint8Array(bytes),
      chain: "solana:mainnet",
    });
    return { signature: signatureFromBytes(signature) };
  }

  if (SolanaSignTransaction in wallet.features) {
    const feature = wallet.features[SolanaSignTransaction] as {
      signTransaction: (input: {
        account: WalletAccount;
        transaction: Uint8Array;
        chain?: string;
      }) => Promise<{ signedTransaction: Uint8Array }>;
    };
    const { signedTransaction } = await feature.signTransaction({
      account,
      transaction: new Uint8Array(bytes),
      chain: "solana:mainnet",
    });
    return { signedTxBase64: Buffer.from(signedTransaction).toString("base64") };
  }

  throw new Error("Wallet does not support signing Solana transactions");
}

/**
 * Sign (and preferably send) a Bags-built transaction with the user's wallet.
 * Returns a confirmed signature when the wallet can send; otherwise signed bytes for server broadcast.
 */
export async function signAndSendBagsTransaction(
  encoded: BagsEncodedTx,
): Promise<{ signature: string } | { signedTxBase64: string }> {
  await ensureBuffer();
  const tx = decodeTx(encoded);

  const phantom = getPhantomProvider();
  if (phantom?.signAndSendTransaction) {
    if (!phantom.publicKey) await phantom.connect();
    const result = await phantom.signAndSendTransaction(tx);
    const signature = typeof result === "string" ? result : result.signature;
    if (!signature) throw new Error("Wallet returned no signature");
    return { signature };
  }

  if (phantom?.signTransaction) {
    if (!phantom.publicKey) await phantom.connect();
    const signed = await phantom.signTransaction(tx);
    const raw =
      signed instanceof VersionedTransaction
        ? signed.serialize()
        : signed.serialize();
    return { signedTxBase64: Buffer.from(raw).toString("base64") };
  }

  return await signViaWalletStandard(encoded).then((result) => {
    if (result.signature) return { signature: result.signature };
    if (result.signedTxBase64) return { signedTxBase64: result.signedTxBase64 };
    throw new Error("Wallet returned neither signature nor signed transaction");
  });
}

export async function signAndSendBagsTransactions(
  encodedList: BagsEncodedTx[],
  broadcast?: (signedTxBase64: string) => Promise<string>,
): Promise<string[]> {
  const signatures: string[] = [];
  for (const encoded of encodedList) {
    const result = await signAndSendBagsTransaction(encoded);
    if ("signature" in result) {
      signatures.push(result.signature);
      continue;
    }
    if (!broadcast) {
      throw new Error("Wallet signed but could not broadcast — reconnect Phantom and retry");
    }
    signatures.push(await broadcast(result.signedTxBase64));
  }
  return signatures;
}

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

export function bagsTokenUrl(mint: string): string {
  return `https://bags.fm/${mint}`;
}

const AGENT_KEY_STORAGE = "bags_agent_api_key";

export function getStoredBagsAgentKey(): string | null {
  try {
    return sessionStorage.getItem(AGENT_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function storeBagsAgentKey(apiKey: string | null) {
  try {
    if (!apiKey) sessionStorage.removeItem(AGENT_KEY_STORAGE);
    else sessionStorage.setItem(AGENT_KEY_STORAGE, apiKey);
  } catch {
    /* ignore */
  }
}

/**
 * Sign Bags Agent V2 auth challenge (base58-encoded message bytes).
 * Docs: https://docs.bags.fm/how-to-guides/agent-authentication
 */
export async function signBagsAuthChallenge(messageBase58: string): Promise<{
  address: string;
  signatureBase58: string;
}> {
  await ensureBuffer();
  const address = await connectBagsWallet();
  const messageBytes = bs58.decode(messageBase58);

  const phantom = getPhantomProvider();
  if (phantom?.signMessage) {
    if (!phantom.publicKey) await phantom.connect();
    const signed = await phantom.signMessage(messageBytes, "utf8");
    const sigBytes = signed instanceof Uint8Array ? signed : signed.signature;
    return { address, signatureBase58: bs58.encode(sigBytes) };
  }

  throw new Error("Phantom signMessage is required for Bags wallet auth");
}

