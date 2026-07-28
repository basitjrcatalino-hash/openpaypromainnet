/** Networks available in OpenDEX token pickers. Only OpenPay is live today. */
export type SwapNetworkId = "openpay" | "solana" | "ethereum" | "bitcoin" | "pi";

export type SwapNetwork = {
  id: SwapNetworkId;
  label: string;
  short: string;
  /** Live = tokens selectable; soon = UI only until chain rails ship. */
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
    status: "soon",
    accent: "#9945FF",
  },
  {
    id: "ethereum",
    label: "Ethereum",
    short: "ETH",
    status: "soon",
    accent: "#627EEA",
  },
  {
    id: "bitcoin",
    label: "Bitcoin",
    short: "BTC",
    status: "soon",
    accent: "#F7931A",
  },
  {
    id: "pi",
    label: "Pi Network",
    short: "PI",
    status: "soon",
    accent: "#6B4EFF",
  },
];

export const DEFAULT_SWAP_NETWORK: SwapNetworkId = "openpay";
