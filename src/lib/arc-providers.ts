// Injected EVM wallet discovery for the Arc Connect Wallet dialog.
// Browser-only: call these functions from event handlers / effects, never at module scope.
import type { EIP1193Provider } from "viem";

export type ArcWalletOption = {
  id: "browser" | "coinbase" | "other";
  name: string;
  provider: EIP1193Provider;
};

type EthereumWindow = {
  ethereum?: EIP1193Provider & {
    isCoinbaseWallet?: boolean;
    isMetaMask?: boolean;
    providers?: EIP1193Provider[];
  };
  coinbaseWalletExtension?: EIP1193Provider;
};

function win(): EthereumWindow {
  if (typeof window === "undefined") return {};
  return window as unknown as EthereumWindow;
}

function providerName(p: EIP1193Provider & Record<string, unknown>): string {
  if (p.isCoinbaseWallet) return "Coinbase Wallet";
  if (p.isMetaMask) return "MetaMask";
  if (p.isRabby) return "Rabby";
  if (p.isBraveWallet) return "Brave Wallet";
  if (p.isTrust || p.isTrustWallet) return "Trust Wallet";
  if (p.isOkxWallet || p.isOKExWallet) return "OKX Wallet";
  return "Browser Wallet";
}

/** All detected injected EVM providers, de-duplicated. */
export function detectArcWallets(): { name: string; provider: EIP1193Provider }[] {
  const w = win();
  const found: { name: string; provider: EIP1193Provider }[] = [];
  const seen = new Set<EIP1193Provider>();
  const push = (p?: EIP1193Provider) => {
    if (!p || seen.has(p)) return;
    seen.add(p);
    found.push({ name: providerName(p as EIP1193Provider & Record<string, unknown>), provider: p });
  };
  for (const p of w.ethereum?.providers ?? []) push(p);
  push(w.ethereum);
  push(w.coinbaseWalletExtension);
  return found;
}

/** The default browser (injected) wallet, excluding Coinbase's dedicated extension. */
export function browserWalletProvider(): EIP1193Provider | null {
  const w = win();
  const all = detectArcWallets().filter(x => x.name !== "Coinbase Wallet");
  if (all.length > 0) return all[0].provider;
  return w.ethereum ?? null;
}

export function coinbaseWalletProvider(): EIP1193Provider | null {
  const w = win();
  if (w.coinbaseWalletExtension) return w.coinbaseWalletExtension;
  const match = detectArcWallets().find(x => x.name === "Coinbase Wallet");
  return match?.provider ?? null;
}

/** Wallets shown under "Other Wallets" (everything except the default browser wallet entry). */
export function otherWalletProviders(): { name: string; provider: EIP1193Provider }[] {
  const browser = browserWalletProvider();
  return detectArcWallets().filter(x => x.provider !== browser);
}
