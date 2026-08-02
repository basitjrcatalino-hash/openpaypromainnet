/**
 * Phantom-style network catalog for wallet browse filters.
 * Live = assets exist in OpenPay Pro today.
 * Soon = listed for familiarity; filter shows empty until catalog grows.
 */
export type WalletNetworkId =
  | "all"
  | "openpay"
  | "solana"
  | "ethereum"
  | "bitcoin"
  | "bnb"
  | "ronin"
  | "base"
  | "polygon"
  | "sui"
  | "monad"
  | "hyperevm"
  | "pi";

export type WalletNetwork = {
  id: WalletNetworkId;
  label: string;
  short: string;
  /** Matches MajorTokenDef.network / OpenToken chain label */
  match: string | null;
  status: "live" | "soon";
  logoUrl: string | null;
  accent: string;
};

export const WALLET_NETWORKS: WalletNetwork[] = [
  {
    id: "all",
    label: "All networks",
    short: "All",
    match: null,
    status: "live",
    logoUrl: null,
    accent: "#111111",
  },
  {
    id: "openpay",
    label: "OpenPay",
    short: "OpenPay",
    match: "OpenPay",
    status: "live",
    logoUrl: null,
    accent: "#8B5CF6",
  },
  {
    id: "solana",
    label: "Solana",
    short: "Solana",
    match: "Solana",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    accent: "#9945FF",
  },
  {
    id: "ethereum",
    label: "Ethereum",
    short: "Ethereum",
    match: "Ethereum",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    accent: "#627EEA",
  },
  {
    id: "bitcoin",
    label: "Bitcoin",
    short: "Bitcoin",
    match: "Bitcoin",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    accent: "#F7931A",
  },
  {
    id: "bnb",
    label: "BNB Smart Chain",
    short: "BNB",
    match: "BNB Smart Chain",
    status: "live",
    logoUrl: "https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
    accent: "#F0B90B",
  },
  {
    id: "ronin",
    label: "Ronin",
    short: "Ronin",
    match: "Ronin",
    status: "live",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/20009/large/photo_2024-04-06_22-52-24.jpg",
    accent: "#1273EA",
  },
  {
    id: "base",
    label: "Base",
    short: "Base",
    match: "Base",
    status: "soon",
    logoUrl: "https://assets.coingecko.com/asset_platforms/images/131/small/base.jpeg",
    accent: "#0052FF",
  },
  {
    id: "polygon",
    label: "Polygon",
    short: "Polygon",
    match: "Polygon",
    status: "soon",
    logoUrl: "https://assets.coingecko.com/coins/images/4713/large/polygon.png",
    accent: "#8247E5",
  },
  {
    id: "sui",
    label: "Sui",
    short: "Sui",
    match: "Sui",
    status: "soon",
    logoUrl: "https://assets.coingecko.com/coins/images/26375/large/sui-ocean-square.png",
    accent: "#4DA2FF",
  },
  {
    id: "monad",
    label: "Monad",
    short: "Monad",
    match: "Monad",
    status: "soon",
    logoUrl: "https://assets.coingecko.com/coins/images/38927/large/monad.png",
    accent: "#836EF9",
  },
  {
    id: "hyperevm",
    label: "HyperEVM",
    short: "HyperEVM",
    match: "HyperEVM",
    status: "soon",
    logoUrl: "https://assets.coingecko.com/coins/images/50882/large/hyperliquid.jpg",
    accent: "#97FCE4",
  },
  {
    id: "pi",
    label: "Pi Network",
    short: "Pi",
    match: "Pi Network",
    status: "live",
    logoUrl: "https://coin-images.coingecko.com/coins/images/54342/large/pi_network.jpg?1739347576",
    accent: "#6B4EFF",
  },
];

export function walletNetworkById(id: WalletNetworkId): WalletNetwork {
  return WALLET_NETWORKS.find((n) => n.id === id) ?? WALLET_NETWORKS[0]!;
}
