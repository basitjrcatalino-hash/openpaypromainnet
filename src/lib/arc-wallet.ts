/**
 * Arc network wallet connection: injected wallets (EIP-6963) + WalletConnect QR.
 * Docs: https://docs.arc.io
 */
export type Eip1193 = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (ev: string, cb: (...a: unknown[]) => void) => void;
  disconnect?: () => Promise<void>;
};

export type ArcNetworkId = "testnet" | "mainnet";

export type ArcChain = {
  id: ArcNetworkId;
  chainId: number;
  name: string;
  rpcUrl: string;
  explorer: string;
  available: boolean;
};

const mainnetChainId = Number(import.meta.env.VITE_ARC_MAINNET_CHAIN_ID || 0);

export const ARC_CHAINS: Record<ArcNetworkId, ArcChain> = {
  testnet: {
    id: "testnet",
    chainId: 5042002,
    name: "Arc Testnet",
    rpcUrl: "https://rpc.testnet.arc.network",
    explorer: "https://testnet.arcscan.app",
    available: true,
  },
  mainnet: {
    id: "mainnet",
    chainId: mainnetChainId,
    name: "Arc Mainnet",
    rpcUrl: (import.meta.env.VITE_ARC_MAINNET_RPC_URL as string) || "",
    explorer: (import.meta.env.VITE_ARC_MAINNET_EXPLORER as string) || "",
    available: mainnetChainId > 0,
  },
};

export type WalletOption = {
  id: string;
  name: string;
  icon: string;
  kind: "injected" | "walletconnect";
  provider?: Eip1193;
  installed: boolean;
};

const WC_ICON = "https://avatars.githubusercontent.com/u/37784886?s=200&v=4";

/** Popular wallets shown in "All wallets" (connect through WalletConnect when not installed). */
export const POPULAR_WALLETS: { name: string; icon: string }[] = [
  { name: "MetaMask", icon: "https://avatars.githubusercontent.com/u/11744586?s=200&v=4" },
  { name: "Trust Wallet", icon: "https://avatars.githubusercontent.com/u/32179889?s=200&v=4" },
  { name: "Phantom", icon: "https://avatars.githubusercontent.com/u/78782331?s=200&v=4" },
  { name: "OKX Wallet", icon: "https://avatars.githubusercontent.com/u/4314179?s=200&v=4" },
  { name: "Coinbase Wallet", icon: "https://avatars.githubusercontent.com/u/18060234?s=200&v=4" },
  { name: "Rainbow", icon: "https://avatars.githubusercontent.com/u/48327834?s=200&v=4" },
  { name: "Binance Wallet", icon: "https://avatars.githubusercontent.com/u/40864412?s=200&v=4" },
  { name: "SafePal", icon: "https://avatars.githubusercontent.com/u/45422998?s=200&v=4" },
  { name: "TokenPocket", icon: "https://avatars.githubusercontent.com/u/40217883?s=200&v=4" },
  { name: "Bitget Wallet", icon: "https://avatars.githubusercontent.com/u/108383993?s=200&v=4" },
  { name: "Rabby", icon: "https://avatars.githubusercontent.com/u/93998131?s=200&v=4" },
  { name: "Zerion", icon: "https://avatars.githubusercontent.com/u/37151895?s=200&v=4" },
];

/** Discover injected wallets via EIP-6963. */
export function discoverInjectedWallets(timeoutMs = 400): Promise<WalletOption[]> {
  if (typeof window === "undefined") return Promise.resolve([]);
  return new Promise((resolve) => {
    const found = new Map<string, WalletOption>();
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent).detail as {
        info: { uuid: string; name: string; icon: string; rdns: string };
        provider: Eip1193;
      };
      if (!d?.info) return;
      found.set(d.info.rdns || d.info.uuid, {
        id: d.info.rdns || d.info.uuid,
        name: d.info.name,
        icon: d.info.icon,
        kind: "injected",
        provider: d.provider,
        installed: true,
      });
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
      if (found.size === 0 && eth) {
        found.set("browser", {
          id: "browser",
          name: "Browser Wallet",
          icon: "",
          kind: "injected",
          provider: eth,
          installed: true,
        });
      }
      resolve([...found.values()]);
    }, timeoutMs);
  });
}

export const WALLETCONNECT_OPTION: WalletOption = {
  id: "walletconnect",
  name: "WalletConnect",
  icon: WC_ICON,
  kind: "walletconnect",
  installed: false,
};

export function hasWalletConnectProjectId(): boolean {
  return Boolean(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID);
}

/** Create a WalletConnect provider; calls onUri with the pairing link for our own QR. */
export async function createWalletConnectProvider(
  network: ArcNetworkId,
  onUri: (uri: string) => void,
): Promise<Eip1193> {
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
  if (!projectId) throw new Error("WalletConnect is not configured.");
  const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
  const chain = ARC_CHAINS[network];
  const optionalChains = [ARC_CHAINS.testnet.chainId, 1] as number[];
  if (ARC_CHAINS.mainnet.available) optionalChains.unshift(ARC_CHAINS.mainnet.chainId);
  const rpcMap: Record<number, string> = { [ARC_CHAINS.testnet.chainId]: ARC_CHAINS.testnet.rpcUrl };
  if (ARC_CHAINS.mainnet.available) rpcMap[ARC_CHAINS.mainnet.chainId] = ARC_CHAINS.mainnet.rpcUrl;
  const provider = await EthereumProvider.init({
    projectId,
    showQrModal: false,
    optionalChains: optionalChains as [number, ...number[]],
    rpcMap,
    metadata: {
      name: "OpenPay Pro",
      description: "OpenPay Pro on Arc",
      url: window.location.origin,
      icons: [`${window.location.origin}/favicon.png`],
    },
  });
  provider.on("display_uri", (uri: string) => onUri(uri));
  await provider.connect({ optionalChains: [chain.chainId] } as never);
  return provider as unknown as Eip1193;
}

export async function requestAccount(provider: Eip1193): Promise<string> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const a = accounts?.[0];
  if (!a) throw new Error("No account returned from wallet");
  const { getAddress } = await import("viem");
  return getAddress(a);
}

export async function switchToArc(provider: Eip1193, network: ArcNetworkId): Promise<void> {
  const c = ARC_CHAINS[network];
  if (!c.available) throw new Error(`${c.name} is not live yet.`);
  const hex = `0x${c.chainId.toString(16)}`;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 4902 && code !== -32603) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hex,
          chainName: c.name,
          nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
          rpcUrls: [c.rpcUrl],
          blockExplorerUrls: c.explorer ? [c.explorer] : [],
        },
      ],
    });
  }
}

/** Native USDC balance on Arc (18 decimals for gas token). */
export async function getArcBalance(address: string, network: ArcNetworkId): Promise<string> {
  const c = ARC_CHAINS[network];
  if (!c.available || !c.rpcUrl) return "0";
  const res = await fetch(c.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }),
  });
  const j = (await res.json()) as { result?: string };
  const { formatUnits } = await import("viem");
  return formatUnits(BigInt(j.result || "0x0"), 18);
}

const LINK_KEY = "arc_linked_wallet";
export type LinkedArcWallet = { address: string; wallet: string; network: ArcNetworkId };
export function saveLinkedWallet(w: LinkedArcWallet | null) {
  try {
    if (w) localStorage.setItem(LINK_KEY, JSON.stringify(w));
    else localStorage.removeItem(LINK_KEY);
  } catch {
    /* ignore */
  }
}
export function loadLinkedWallet(): LinkedArcWallet | null {
  try {
    const v = localStorage.getItem(LINK_KEY);
    return v ? (JSON.parse(v) as LinkedArcWallet) : null;
  } catch {
    return null;
  }
}
