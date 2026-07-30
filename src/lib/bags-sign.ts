/**
 * Client-side Bags tx signing via Phantom (extension) or Wallet Standard.
 * Dynamically loads @solana/web3.js only after Buffer is polyfilled —
 * static imports crash with: Cannot read properties of undefined (reading 'from').
 */
import type { Wallet, WalletAccount } from "@wallet-standard/base";

import { ensureBuffer } from "@/lib/buffer-polyfill";

export type BagsTxKind = "versioned" | "legacy";

export type BagsEncodedTx = {
  txBase64: string;
  kind: BagsTxKind;
};

export {
  bagsTokenUrl,
  getStoredBagsAgentKey,
  LAMPORTS_PER_SOL,
  solscanTxUrl,
  storeBagsAgentKey,
} from "@/lib/bags-client";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toBase58(): string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey: { toBase58(): string };
  }>;
  signAndSendTransaction?: (
    transaction: unknown,
    opts?: { skipPreflight?: boolean },
  ) => Promise<{ signature: string } | string>;
  signTransaction?: (transaction: unknown) => Promise<unknown>;
  signMessage?: (
    message: Uint8Array,
    display?: "utf8" | "hex",
  ) => Promise<{ signature: Uint8Array } | Uint8Array>;
};

type Bs58 = { encode: (b: Uint8Array) => string; decode: (s: string) => Uint8Array };

async function loadSolana() {
  await ensureBuffer();
  const Buf = (globalThis as { Buffer?: { from?: unknown } }).Buffer;
  if (typeof Buf?.from !== "function") {
    throw new Error("Buffer polyfill failed — retry or refresh the page");
  }
  const [{ Transaction, VersionedTransaction }, bs58] = await Promise.all([
    import("@solana/web3.js"),
    import("bs58"),
  ]);
  return {
    Transaction,
    VersionedTransaction,
    bs58: ((bs58 as unknown as { default?: Bs58 }).default ?? (bs58 as unknown as Bs58)),
  };
}

function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  };
  return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null) ?? null;
}

async function listSignWallets(): Promise<Wallet[]> {
  try {
    const { getWallets } = await import("@wallet-standard/app");
    const { SolanaSignAndSendTransaction, SolanaSignTransaction } = await import(
      "@solana/wallet-standard-features"
    );
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

  for (const wallet of await listSignWallets()) {
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

  const wallets = await listSignWallets();
  if (!wallets.length) {
    throw new Error("Install Phantom (or another Solana wallet) to use Bags");
  }
  const wallet = wallets[0]!;
  const { StandardConnect } = await import("@wallet-standard/features");
  if (StandardConnect in wallet.features) {
    await (wallet.features[StandardConnect] as { connect: () => Promise<unknown> }).connect();
  }
  const account = pickSolanaAccount(wallet);
  if (!account?.address) throw new Error("Wallet connected but returned no Solana address");
  return account.address;
}

async function decodeTx(encoded: BagsEncodedTx) {
  const { Transaction, VersionedTransaction } = await loadSolana();
  const raw = Buffer.from(encoded.txBase64, "base64");
  if (encoded.kind === "legacy") {
    return { tx: Transaction.from(raw), VersionedTransaction, Transaction };
  }
  return {
    tx: VersionedTransaction.deserialize(raw),
    VersionedTransaction,
    Transaction,
  };
}

async function signViaWalletStandard(
  encoded: BagsEncodedTx,
): Promise<{ signature?: string; signedTxBase64?: string }> {
  const { bs58 } = await loadSolana();
  const { SolanaSignAndSendTransaction, SolanaSignTransaction } = await import(
    "@solana/wallet-standard-features"
  );
  const { StandardConnect } = await import("@wallet-standard/features");

  const wallets = await listSignWallets();
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
    return { signature: bs58.encode(signature) };
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
 */
export async function signAndSendBagsTransaction(
  encoded: BagsEncodedTx,
): Promise<{ signature: string } | { signedTxBase64: string }> {
  const { VersionedTransaction } = await loadSolana();
  const { tx } = await decodeTx(encoded);

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
        : (signed as { serialize: () => Uint8Array }).serialize();
    return { signedTxBase64: Buffer.from(raw).toString("base64") };
  }

  const result = await signViaWalletStandard(encoded);
  if (result.signature) return { signature: result.signature };
  if (result.signedTxBase64) return { signedTxBase64: result.signedTxBase64 };
  throw new Error("Wallet returned neither signature nor signed transaction");
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

/**
 * Sign Bags Agent V2 auth challenge (base58-encoded message bytes).
 * Docs: https://docs.bags.fm/how-to-guides/agent-authentication
 */
export async function signBagsAuthChallenge(messageBase58: string): Promise<{
  address: string;
  signatureBase58: string;
}> {
  const { bs58 } = await loadSolana();
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
