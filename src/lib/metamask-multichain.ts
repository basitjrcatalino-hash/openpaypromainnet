/**
 * MetaMask Connect Multichain (web).
 * Docs: https://docs.metamask.io/metamask-connect/multichain/
 */
import {
  createMultichainClient,
  getInfuraRpcUrls,
  type SessionData,
} from "@metamask/connect-multichain";

export const MM_ETH_MAINNET = "eip155:1" as const;
export const MM_POLYGON = "eip155:137" as const;
export const MM_SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" as const;

export const MM_DEFAULT_SCOPES = [MM_ETH_MAINNET, MM_POLYGON, MM_SOLANA_MAINNET] as const;

export type MetamaskMultichainClient = Awaited<ReturnType<typeof createMultichainClient>>;

let clientPromise: Promise<MetamaskMultichainClient> | null = null;

function supportedNetworks() {
  const key = (import.meta.env.VITE_INFURA_API_KEY as string | undefined)?.trim();
  if (key) {
    return getInfuraRpcUrls({ infuraApiKey: key });
  }
  return {
    [MM_ETH_MAINNET]: "https://ethereum.publicnode.com",
    [MM_POLYGON]: "https://polygon-bor.publicnode.com",
    [MM_SOLANA_MAINNET]: "https://api.mainnet-beta.solana.com",
  };
}

/** Singleton MetaMask multichain client (browser only). */
export function getMetamaskMultichainClient(): Promise<MetamaskMultichainClient> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MetaMask Connect requires a browser"));
  }
  if (!clientPromise) {
    clientPromise = createMultichainClient({
      dapp: {
        name: "OpenPay Pro",
        url: window.location.origin,
        iconUrl: `${window.location.origin}/favicon.ico`,
      },
      api: {
        supportedNetworks: supportedNetworks(),
      },
    });
  }
  return clientPromise;
}

export function sessionScopeKeys(session: SessionData | null | undefined): string[] {
  return Object.keys(session?.sessionScopes ?? {});
}

export function shortCaipAccount(caip10: string): string {
  const parts = caip10.split(":");
  const address = parts[parts.length - 1] ?? caip10;
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function accountsInScope(
  session: SessionData | null | undefined,
  scope: string,
): string[] {
  const entry = session?.sessionScopes?.[scope as keyof NonNullable<SessionData["sessionScopes"]>];
  const accounts = (entry as { accounts?: string[] } | undefined)?.accounts ?? [];
  return accounts.map(String);
}

export type { SessionData };
