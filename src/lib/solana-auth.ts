/**
 * Client helpers for Sign In With Solana (Phantom SIWS).
 * Spec: https://github.com/phantom/sign-in-with-solana
 * Desktop: Phantom browser extension via Wallet Standard / window.phantom.solana
 */
import {
  SolanaSignIn,
  SolanaSignMessage,
  type SolanaSignInInput,
  type SolanaSignInOutput,
} from "@solana/wallet-standard-features";
import { createSignInMessage } from "@solana/wallet-standard-util";
import { getWallets } from "@wallet-standard/app";
import { StandardConnect } from "@wallet-standard/features";
import type { Wallet, WalletAccount } from "@wallet-standard/base";

import { ensureBuffer } from "@/lib/buffer-polyfill";
import { supabase } from "@/integrations/supabase/client";

export const SOLANA_BRAND_PURPLE = "#9945FF";

export const PHANTOM_INSTALL_URL = "https://phantom.app/download";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toBase58(): string; toBytes(): Uint8Array };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey: { toBase58(): string; toBytes(): Uint8Array };
  }>;
  signIn?: (input?: SolanaSignInInput) => Promise<{
    address?: string;
    publicKey?: Uint8Array | { toBytes?: () => Uint8Array };
    signedMessage?: Uint8Array;
    signature?: Uint8Array;
    account?: WalletAccount;
  }>;
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
  const provider = w.phantom?.solana ?? w.solana ?? null;
  if (!provider) return null;
  return provider;
}

function listSiwsWallets(): Wallet[] {
  try {
    const { get } = getWallets();
    return get().filter(
      (w) => SolanaSignIn in w.features || SolanaSignMessage in w.features,
    );
  } catch {
    return [];
  }
}

/** Phantom (and other extensions) inject after page load — wait briefly on desktop. */
async function waitForDesktopWallet(timeoutMs = 2500): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (getPhantomProvider() || listSiwsWallets().length > 0) return true;

  // Kick Wallet Standard discovery
  try {
    getWallets();
  } catch {
    /* ignore */
  }

  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timer);
      try {
        unsub?.();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };

    let unsub: (() => void) | undefined;
    try {
      const api = getWallets();
      unsub = api.on("register", () => {
        if (getPhantomProvider() || listSiwsWallets().length > 0) finish(true);
      });
    } catch {
      /* ignore */
    }

    const poll = window.setInterval(() => {
      if (getPhantomProvider() || listSiwsWallets().length > 0) finish(true);
    }, 120);

    const timer = window.setTimeout(() => finish(false), timeoutMs);
  });
}

function desktopWalletMissingError(): Error {
  return new Error(
    "No Solana wallet found. Install the Phantom browser extension for desktop, then refresh this page.",
  );
}

function toByteArray(value: Uint8Array | ArrayLike<number>): number[] {
  return Array.from(value);
}

function serializeSignInOutput(output: SolanaSignInOutput) {
  return {
    account: {
      address: output.account.address,
      publicKey: toByteArray(output.account.publicKey),
      chains: output.account.chains,
      features: output.account.features,
      label: output.account.label,
      icon: output.account.icon,
    },
    signedMessage: toByteArray(output.signedMessage),
    signature: toByteArray(output.signature),
    signatureType: output.signatureType ?? "ed25519",
  };
}

function normalizePhantomSignIn(
  raw: NonNullable<Awaited<ReturnType<NonNullable<PhantomProvider["signIn"]>>>>,
): SolanaSignInOutput {
  if (raw.account?.address && raw.signedMessage && raw.signature) {
    return {
      account: raw.account,
      signedMessage: raw.signedMessage,
      signature: raw.signature,
      signatureType: "ed25519",
    };
  }

  const provider = getPhantomProvider();
  const address = raw.address || provider?.publicKey?.toBase58();
  const publicKeyBytes =
    raw.publicKey instanceof Uint8Array
      ? raw.publicKey
      : typeof (raw.publicKey as { toBytes?: () => Uint8Array } | undefined)?.toBytes ===
          "function"
        ? (raw.publicKey as { toBytes: () => Uint8Array }).toBytes()
        : provider?.publicKey?.toBytes();

  if (!address || !publicKeyBytes || !raw.signedMessage || !raw.signature) {
    throw new Error("Wallet returned an incomplete Sign In With Solana response");
  }

  return {
    account: {
      address,
      publicKey: publicKeyBytes,
      chains: ["solana:mainnet"],
      features: [],
    },
    signedMessage: raw.signedMessage,
    signature: raw.signature,
    signatureType: "ed25519",
  };
}

async function signInViaWalletStandard(input: SolanaSignInInput): Promise<SolanaSignInOutput | null> {
  const wallets = listSiwsWallets().filter((w) => SolanaSignIn in w.features);

  // Prefer Phantom when multiple wallets are present (desktop extension)
  const wallet =
    wallets.find((w) => /phantom/i.test(w.name)) ||
    wallets.find((w) => w.accounts.length > 0) ||
    wallets[0];

  if (!wallet) return null;

  if (StandardConnect in wallet.features && wallet.accounts.length === 0) {
    await (
      wallet.features as {
        [StandardConnect]: { connect: () => Promise<{ accounts: readonly WalletAccount[] }> };
      }
    )[StandardConnect].connect();
  }

  const feature = (
    wallet.features as {
      [SolanaSignIn]: { signIn: (...inputs: SolanaSignInInput[]) => Promise<readonly SolanaSignInOutput[]> };
    }
  )[SolanaSignIn];

  const [output] = await feature.signIn(input);
  if (!output) throw new Error("Wallet did not return a sign-in result");
  return output;
}

async function signInViaPhantomProvider(input: SolanaSignInInput): Promise<SolanaSignInOutput> {
  const provider = getPhantomProvider();
  if (!provider) {
    throw desktopWalletMissingError();
  }

  if (typeof provider.signIn === "function") {
    const raw = await provider.signIn(input);
    return normalizePhantomSignIn(raw);
  }

  // Legacy fallback: connect + signMessage with SIWS message bytes
  const connected = await provider.connect();
  const address = connected.publicKey.toBase58();
  const publicKey = connected.publicKey.toBytes();
  const message = createSignInMessage({
    ...input,
    domain: input.domain || window.location.host,
    address,
  });

  if (typeof provider.signMessage !== "function") {
    throw new Error("This wallet does not support Sign In With Solana or signMessage.");
  }

  const signed = await provider.signMessage(message, "utf8");
  const signature = signed instanceof Uint8Array ? signed : signed.signature;

  return {
    account: {
      address,
      publicKey,
      chains: ["solana:mainnet"],
      features: [],
    },
    signedMessage: message,
    signature,
    signatureType: "ed25519",
  };
}

async function signInViaSignMessageStandard(input: SolanaSignInInput): Promise<SolanaSignInOutput | null> {
  const wallets = listSiwsWallets().filter((w) => SolanaSignMessage in w.features);
  const wallet =
    wallets.find((w) => /phantom/i.test(w.name)) ||
    wallets.find((w) => w.accounts.length > 0) ||
    wallets[0];
  if (!wallet) return null;

  if (StandardConnect in wallet.features && wallet.accounts.length === 0) {
    await (
      wallet.features as {
        [StandardConnect]: { connect: () => Promise<{ accounts: readonly WalletAccount[] }> };
      }
    )[StandardConnect].connect();
  }

  const account = wallet.accounts[0];
  if (!account) throw new Error("Connect your Solana wallet to continue.");

  const message = createSignInMessage({
    ...input,
    domain: input.domain || window.location.host,
    address: account.address,
  });

  const feature = (
    wallet.features as {
      [SolanaSignMessage]: {
        signMessage: (args: {
          account: WalletAccount;
          message: Uint8Array;
        }) => Promise<readonly { signedMessage: Uint8Array; signature: Uint8Array }[]>;
      };
    }
  )[SolanaSignMessage];

  const [result] = await feature.signMessage({ account, message });
  if (!result) throw new Error("Wallet did not return a signature");

  return {
    account,
    signedMessage: result.signedMessage,
    signature: result.signature,
    signatureType: "ed25519",
  };
}

export async function requestSolanaSignIn(
  input: SolanaSignInInput,
): Promise<SolanaSignInOutput> {
  await ensureBuffer();
  await waitForDesktopWallet();

  const viaStandard = await signInViaWalletStandard(input);
  if (viaStandard) return viaStandard;

  try {
    return await signInViaPhantomProvider(input);
  } catch (err) {
    const viaMessage = await signInViaSignMessageStandard(input);
    if (viaMessage) return viaMessage;
    if (!getPhantomProvider() && listSiwsWallets().length === 0) {
      throw desktopWalletMissingError();
    }
    throw err;
  }
}

export async function startSolanaSignIn(opts?: { redirectTo?: string }): Promise<void> {
  if (typeof window === "undefined") return;

  await ensureBuffer();
  const ready = await waitForDesktopWallet();
  if (!ready && !getPhantomProvider() && listSiwsWallets().length === 0) {
    throw desktopWalletMissingError();
  }

  const origin = encodeURIComponent(window.location.origin);
  const createRes = await fetch(`/api/public/solana-auth?origin=${origin}`);
  const input = (await createRes.json().catch(() => ({}))) as SolanaSignInInput & {
    error?: string;
  };
  if (!createRes.ok || !input.nonce) {
    throw new Error(input.error || `Could not start Solana sign-in (${createRes.status})`);
  }

  const output = await requestSolanaSignIn(input);

  await finishSolanaSession(input, output, opts?.redirectTo);
}

/**
 * Phantom Connect path — sign SIWS with `@phantom/react-sdk` useSolana().signMessage
 * when the browser extension is not available (Google / Apple embedded).
 * Docs: https://docs.phantom.com/sdks/react-sdk/sign-messages
 */
export async function startPhantomConnectSignIn(opts: {
  address: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  publicKeyBytes?: Uint8Array;
  redirectTo?: string;
}): Promise<void> {
  if (typeof window === "undefined") return;
  await ensureBuffer();

  const address = opts.address.trim();
  if (!address) throw new Error("Phantom Connect returned no Solana address");

  const origin = encodeURIComponent(window.location.origin);
  const createRes = await fetch(`/api/public/solana-auth?origin=${origin}`);
  const input = (await createRes.json().catch(() => ({}))) as SolanaSignInInput & {
    error?: string;
  };
  if (!createRes.ok || !input.nonce) {
    throw new Error(input.error || `Could not start Solana sign-in (${createRes.status})`);
  }

  const message = createSignInMessage({
    ...input,
    domain: input.domain || window.location.host,
    address,
  });

  const signature = await opts.signMessage(message);
  let publicKey = opts.publicKeyBytes;
  if (!publicKey || publicKey.length === 0) {
    const bs58 = await import("bs58");
    const decode = bs58.default?.decode ?? (bs58 as { decode?: (s: string) => Uint8Array }).decode;
    if (typeof decode !== "function") {
      throw new Error("Could not decode Phantom Solana address");
    }
    publicKey = decode(address);
  }

  const output: SolanaSignInOutput = {
    account: {
      address,
      publicKey,
      chains: ["solana:mainnet"],
      features: [],
    },
    signedMessage: message,
    signature,
    signatureType: "ed25519",
  };

  await finishSolanaSession(input, output, opts.redirectTo);
}

async function finishSolanaSession(
  input: SolanaSignInInput,
  output: SolanaSignInOutput,
  redirectTo?: string,
): Promise<void> {
  const verifyRes = await fetch("/api/public/solana-auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input,
      output: serializeSignInOutput(output),
    }),
  });
  const body = (await verifyRes.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    address?: string;
    error?: string;
  };
  if (!verifyRes.ok || !body.email || !body.password) {
    throw new Error(body.error || `Solana sign-in failed (${verifyRes.status})`);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });
  if (error) throw error;

  if (body.address) {
    try {
      sessionStorage.setItem("solana_signed_in_address", body.address);
    } catch {
      /* ignore */
    }
  }

  window.location.replace(redirectTo || "/dashboard");
}

/** Detect whether a SIWS-capable wallet appears available (best-effort). */
export function hasSolanaWallet(): boolean {
  if (typeof window === "undefined") return false;
  if (getPhantomProvider()) return true;
  return listSiwsWallets().length > 0;
}
