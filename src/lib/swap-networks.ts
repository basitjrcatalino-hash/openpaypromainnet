/** Networks available in OpenDEX token pickers. */
export type SwapNetworkId =
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
  | "sui"
  | "near"
  | "polkadot"
  | "pi";

export type SwapNetwork = {
  id: SwapNetworkId;
  label: string;
  short: string;
  /** Live = tokens selectable. */
  status: "live" | "soon";
  accent: string;
};

export const SWAP_NETWORKS: SwapNetwork[] = [
  {
    id: "openpay",
    label: "OpenPay",
    short: "OP",
    status: "live",
    accent: "oklch(0.72 0.12 295)",
  },
  {
    id: "solana",
    label: "Solana",
    short: "SOL",
    status: "live",
    accent: "#9945FF",
  },
  {
    id: "ethereum",
    label: "Ethereum",
    short: "ETH",
    status: "live",
    accent: "#627EEA",
  },
  {
    id: "bitcoin",
    label: "Bitcoin",
    short: "BTC",
    status: "live",
    accent: "#F7931A",
  },
  {
    id: "bitcoin-cash",
    label: "Bitcoin Cash",
    short: "BCH",
    status: "live",
    accent: "#0AC18E",
  },
  {
    id: "bnb",
    label: "BNB Smart Chain",
    short: "BNB",
    status: "live",
    accent: "#F0B90B",
  },
  {
    id: "ronin",
    label: "Ronin",
    short: "RON",
    status: "live",
    accent: "#1273EA",
  },
  {
    id: "xrp",
    label: "XRP Ledger",
    short: "XRP",
    status: "live",
    accent: "#23292F",
  },
  {
    id: "tron",
    label: "TRON",
    short: "TRX",
    status: "live",
    accent: "#FF0013",
  },
  {
    id: "dogecoin",
    label: "Dogecoin",
    short: "DOGE",
    status: "live",
    accent: "#C2A633",
  },
  {
    id: "cardano",
    label: "Cardano",
    short: "ADA",
    status: "live",
    accent: "#0033AD",
  },
  {
    id: "stellar",
    label: "Stellar",
    short: "XLM",
    status: "live",
    accent: "#000000",
  },
  {
    id: "ton",
    label: "TON",
    short: "TON",
    status: "live",
    accent: "#0098EA",
  },
  {
    id: "avalanche",
    label: "Avalanche",
    short: "AVAX",
    status: "live",
    accent: "#E84142",
  },
  {
    id: "sui",
    label: "Sui",
    short: "SUI",
    status: "live",
    accent: "#4DA2FF",
  },
  {
    id: "near",
    label: "NEAR",
    short: "NEAR",
    status: "live",
    accent: "#000000",
  },
  {
    id: "polkadot",
    label: "Polkadot",
    short: "DOT",
    status: "live",
    accent: "#E6007A",
  },
  {
    id: "pi",
    label: "Pi Network",
    short: "PI",
    status: "live",
    accent: "#6B4EFF",
  },
];

export const DEFAULT_SWAP_NETWORK: SwapNetworkId = "openpay";
