/**
 * Client: WalletConnect / EVM wallet sign-in (MetaMask, WalletConnect injectors, etc.).
 */
import { supabase } from "@/integrations/supabase/client";

export const WALLETCONNECT_BRAND_BLUE = "#3396FF";

async function checksumAddress(address: string): Promise<string> {
  const { getAddress } = await import("viem");
  return getAddress(address);
}

export type WcSignInChallenge = {
  domain: string;
  address?: string;
  statement: string;
  uri: string;
  version: "1";
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  requestId: string;
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
};

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  return eth ?? null;
}

export function hasEvmWallet(): boolean {
  return Boolean(getEthereum());
}

async function connectEvmAddress(): Promise<string> {
  const eth = getEthereum();
  if (!eth) {
    throw new Error(
      "No EVM wallet found. Install MetaMask or open this page in a WalletConnect-compatible browser.",
    );
  }
  const accounts = (await eth.request({
    method: "eth_requestAccounts",
  })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("No account returned from wallet");
  return checksumAddress(address);
}

async function personalSign(address: string, message: string): Promise<string> {
  const eth = getEthereum();
  if (!eth) throw new Error("No EVM wallet available");
  const sig = (await eth.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;
  if (!sig) throw new Error("Wallet did not return a signature");
  return sig;
}

/** Mirror of server SIWE builder (keep in sync with walletconnect-auth.server). */
async function buildSiweMessage(challenge: WcSignInChallenge, address: string): Promise<string> {
  const checksum = await checksumAddress(address);
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

export async function startWalletConnectSignIn(opts?: { redirectTo?: string }): Promise<void> {
  if (typeof window === "undefined") return;

  const origin = encodeURIComponent(window.location.origin);
  const createRes = await fetch(`/api/public/walletconnect-auth?origin=${origin}`);
  const challenge = (await createRes.json().catch(() => ({}))) as WcSignInChallenge & {
    error?: string;
  };
  if (!createRes.ok || !challenge.nonce) {
    throw new Error(challenge.error || `Could not start WalletConnect sign-in (${createRes.status})`);
  }

  const address = await connectEvmAddress();
  const message = await buildSiweMessage(challenge, address);
  const signature = await personalSign(address, message);

  const verifyRes = await fetch("/api/public/walletconnect-auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challenge, address, signature }),
  });
  const body = (await verifyRes.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    address?: string;
    error?: string;
  };
  if (!verifyRes.ok || !body.email || !body.password) {
    throw new Error(body.error || `WalletConnect sign-in failed (${verifyRes.status})`);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });
  if (error) throw error;

  if (body.address) {
    try {
      sessionStorage.setItem("wc_signed_in_address", body.address);
    } catch {
      /* ignore */
    }
  }

  window.location.replace(opts?.redirectTo || "/dashboard");
}
