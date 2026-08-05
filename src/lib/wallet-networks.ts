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
  | "bitcoin-cash"
  | "bnb"
  | "ronin"
  | "xrp"
  | "tron"
  | "dogecoin"
  | "cardano"
  | "stellar"
  | "ton"
  | "avalanche"
  | "base"
  | "polygon"
  | "sui"
  | "near"
  | "polkadot"
  | "litecoin"
  | "hedera"
  | "monero"
  | "aptos"
  | "cosmos"
  | "algorand"
  | "filecoin"
  | "internet-computer"
  | "optimism"
  | "arbitrum"
  | "mantle"
  | "cronos"
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
    id: "bitcoin-cash",
    label: "Bitcoin Cash",
    short: "BCH",
    match: "Bitcoin Cash",
    status: "live",
    logoUrl: "https://coin-images.coingecko.com/coins/images/780/large/bitcoin-cash-circle.png",
    accent: "#0AC18E",
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
    id: "xrp",
    label: "XRP Ledger",
    short: "XRP",
    match: "XRP Ledger",
    status: "live",
    logoUrl: "https://coin-images.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png",
    accent: "#23292F",
  },
  {
    id: "tron",
    label: "TRON",
    short: "TRON",
    match: "TRON",
    status: "live",
    logoUrl: "https://coin-images.coingecko.com/coins/images/1094/large/photo_2026-04-13_09-59-16.png",
    accent: "#FF0013",
  },
  {
    id: "dogecoin",
    label: "Dogecoin",
    short: "DOGE",
    match: "Dogecoin",
    status: "live",
    logoUrl: "https://coin-images.coingecko.com/coins/images/5/large/dogecoin.png",
    accent: "#C2A633",
  },
  {
    id: "cardano",
    label: "Cardano",
    short: "ADA",
    match: "Cardano",
    status: "live",
    logoUrl: "https://coin-images.coingecko.com/coins/images/975/large/cardano.png",
    accent: "#0033AD",
  },
  {
    id: "stellar",
    label: "Stellar",
    short: "XLM",
    match: "Stellar",
    status: "live",
    logoUrl: "https://coin-images.coingecko.com/coins/images/100/large/fmpFRHHQ_400x400.jpg",
    accent: "#7D00FF",
  },
  {
    id: "ton",
    label: "TON",
    short: "TON",
    match: "TON",
    status: "live",
    logoUrl: "https://coin-images.coingecko.com/coins/images/17980/large/Gram_Circular_Badge.png",
    accent: "#0098EA",
  },
  {
    id: "avalanche",
    label: "Avalanche",
    short: "AVAX",
    match: "Avalanche",
    status: "live",
    logoUrl:
      "https://coin-images.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
    accent: "#E84142",
  },
  {
    id: "base",
    label: "Base",
    short: "Base",
    match: "Base",
    status: "live",
    logoUrl: "https://assets.coingecko.com/asset_platforms/images/131/small/base.jpeg",
    accent: "#0052FF",
  },
  {
    id: "polygon",
    label: "Polygon",
    short: "Polygon",
    match: "Polygon",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/4713/large/polygon.png",
    accent: "#8247E5",
  },
  {
    id: "sui",
    label: "Sui",
    short: "Sui",
    match: "Sui",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/26375/large/sui-ocean-square.png",
    accent: "#4DA2FF",
  },
  {
    id: "near",
    label: "NEAR",
    short: "NEAR",
    match: "NEAR",
    status: "live",
    logoUrl: "https://coin-images.coingecko.com/coins/images/10365/large/near.jpg",
    accent: "#000000",
  },
  {
    id: "polkadot",
    label: "Polkadot",
    short: "DOT",
    match: "Polkadot",
    status: "live",
    logoUrl: "https://coin-images.coingecko.com/coins/images/12171/large/polkadot.jpg",
    accent: "#E6007A",
  },
  {
    id: "litecoin",
    label: "Litecoin",
    short: "LTC",
    match: "Litecoin",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/2/large/litecoin.png",
    accent: "#345D9D",
  },
  {
    id: "hedera",
    label: "Hedera",
    short: "HBAR",
    match: "Hedera",
    status: "live",
    logoUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/4642.png",
    accent: "#000000",
  },
  {
    id: "monero",
    label: "Monero",
    short: "XMR",
    match: "Monero",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/69/large/monero_logo.png",
    accent: "#FF6600",
  },
  {
    id: "aptos",
    label: "Aptos",
    short: "APT",
    match: "Aptos",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/26455/large/aptos_round.png",
    accent: "#000000",
  },
  {
    id: "cosmos",
    label: "Cosmos",
    short: "ATOM",
    match: "Cosmos",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/1481/large/cosmos_hub.png",
    accent: "#2E3148",
  },
  {
    id: "algorand",
    label: "Algorand",
    short: "ALGO",
    match: "Algorand",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/4380/large/download.png",
    accent: "#000000",
  },
  {
    id: "filecoin",
    label: "Filecoin",
    short: "FIL",
    match: "Filecoin",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/12817/large/filecoin.png",
    accent: "#0090FF",
  },
  {
    id: "internet-computer",
    label: "Internet Computer",
    short: "ICP",
    match: "Internet Computer",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/14495/large/Internet_Computer_logo.png",
    accent: "#29ABE2",
  },
  {
    id: "optimism",
    label: "Optimism",
    short: "OP",
    match: "Optimism",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/25244/large/Optimism.png",
    accent: "#FF0420",
  },
  {
    id: "arbitrum",
    label: "Arbitrum",
    short: "ARB",
    match: "Arbitrum",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg",
    accent: "#28A0F0",
  },
  {
    id: "mantle",
    label: "Mantle",
    short: "MNT",
    match: "Mantle",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/30980/large/token-logo.png",
    accent: "#000000",
  },
  {
    id: "cronos",
    label: "Cronos",
    short: "CRO",
    match: "Cronos",
    status: "live",
    logoUrl: "https://assets.coingecko.com/coins/images/7310/large/cro_token_logo.png",
    accent: "#002D74",
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
