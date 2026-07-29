/**
 * Wallet provider registry — swap active provider via WALLET_PROVIDER env.
 * Default: circle
 */

import type { WalletProvider, WalletProviderId } from "@/lib/wallet-providers/types";
import { circleWalletProvider } from "@/lib/circle";

const providers: Partial<Record<WalletProviderId, WalletProvider>> = {
  circle: circleWalletProvider,
  // dynamic: dynamicWalletProvider,
  // privy: privyWalletProvider,
  // turnkey: turnkeyWalletProvider,
  // fireblocks: fireblocksWalletProvider,
  // bitgo: bitgoWalletProvider,
  // coinbase: coinbaseWalletProvider,
};

export function getActiveWalletProviderId(): WalletProviderId {
  const raw = (process.env.WALLET_PROVIDER || "circle").trim().toLowerCase();
  if (raw in providers) return raw as WalletProviderId;
  return "circle";
}

export function getWalletProvider(id?: WalletProviderId): WalletProvider {
  const key = id || getActiveWalletProviderId();
  const provider = providers[key];
  if (!provider) {
    throw new Error(`Wallet provider "${key}" is not registered`);
  }
  return provider;
}
