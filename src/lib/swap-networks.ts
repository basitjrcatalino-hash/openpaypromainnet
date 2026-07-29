/** Networks available in OpenDEX token pickers. */
export type SwapNetworkId = "openpay" | "solana" | "ethereum" | "bitcoin" | "pi";

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
    id: "pi",
    label: "Pi Network",
    short: "PI",
    status: "live",
    accent: "#6B4EFF",
  },
];

export const DEFAULT_SWAP_NETWORK: SwapNetworkId = "openpay";
