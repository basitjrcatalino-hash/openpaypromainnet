/**
 * MetaMask Connect Solana (Wallet Standard).
 * Docs: https://docs.metamask.io/metamask-connect/solana/
 */
import { createSolanaClient, getInfuraRpcUrls } from "@metamask/connect-solana";

export type MetamaskSolanaClient = Awaited<ReturnType<typeof createSolanaClient>>;

let clientPromise: Promise<MetamaskSolanaClient> | null = null;

function supportedNetworks() {
  const key = (import.meta.env.VITE_INFURA_API_KEY as string | undefined)?.trim();
  if (key) {
    return getInfuraRpcUrls({
      infuraApiKey: key,
      networks: ["mainnet", "devnet"],
    });
  }
  return {
    mainnet: "https://api.mainnet-beta.solana.com",
    devnet: "https://api.devnet.solana.com",
  };
}

/** Singleton MetaMask Solana client (browser only). Auto-registers Wallet Standard. */
export function getMetamaskSolanaClient(): Promise<MetamaskSolanaClient> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MetaMask Connect Solana requires a browser"));
  }
  if (!clientPromise) {
    clientPromise = createSolanaClient({
      dapp: {
        name: "OpenPay Pro",
        url: window.location.href,
        iconUrl: `${window.location.origin}/favicon.ico`,
      },
      api: {
        supportedNetworks: supportedNetworks(),
      },
    });
  }
  return clientPromise;
}

export function shortSolAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
