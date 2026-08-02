/** Funding / Trading / P2P internal account transfer helpers. */

export const ACCOUNT_IDS = ["funding", "trading", "p2p"] as const;
export type AccountId = (typeof ACCOUNT_IDS)[number];

export const ACCOUNT_LABELS: Record<AccountId, string> = {
  funding: "Funding",
  trading: "Trading",
  p2p: "P2P",
};

export const TRANSFER_ASSETS = [
  "OUSD",
  "USDT",
  "USDC",
  "PYUSD",
  "USDG",
  "USD1",
  "CASH",
  "EURC",
  "ETH",
  "BTC",
  "SOL",
  "PI",
  "HYPE",
  "ZEC",
  "TSLAX",
  "NFLXX",
  "GOOGLX",
  "BNB",
  "UNI",
  "OKB",
  "GT",
  "BGB",
  "CAKE",
  "JUP",
  "RON",
] as const;
export type TransferAsset = (typeof TRANSFER_ASSETS)[number];

export function isAccountId(v: string): v is AccountId {
  return (ACCOUNT_IDS as readonly string[]).includes(v);
}

export function isTransferAsset(v: string): v is TransferAsset {
  return (TRANSFER_ASSETS as readonly string[]).includes(v.toUpperCase());
}

export function fundingBalanceColumn(asset: string): string | null {
  switch (asset.toUpperCase()) {
    case "OUSD":
      return "ousd_balance";
    case "USDT":
      return "usdt_balance";
    case "USDC":
      return "usdc_balance";
    case "PYUSD":
      return "pyusd_balance";
    case "USDG":
      return "usdg_balance";
    case "USD1":
      return "usd1_balance";
    case "CASH":
      return "cash_balance";
    case "EURC":
      return "eurc_balance";
    case "ETH":
      return "eth_balance";
    case "BTC":
      return "btc_balance";
    case "SOL":
      return "sol_balance";
    case "PI":
      return "pi_balance";
    case "HYPE":
      return "hype_balance";
    case "ZEC":
      return "zec_balance";
    case "TSLAX":
      return "tslax_balance";
    case "NFLXX":
      return "nflxx_balance";
    case "GOOGLX":
      return "googlx_balance";
    case "BNB":
      return "bnb_balance";
    case "UNI":
      return "uni_balance";
    case "OKB":
      return "okb_balance";
    case "GT":
      return "gt_balance";
    case "BGB":
      return "bgb_balance";
    case "CAKE":
      return "cake_balance";
    case "JUP":
      return "jup_balance";
    case "RON":
      return "ron_balance";
    default:
      return null;
  }
}

export function readFundingBalance(
  wallet: Record<string, unknown> | null | undefined,
  asset: string,
): number {
  const col = fundingBalanceColumn(asset);
  if (!col || !wallet) return 0;
  return Number(wallet[col] ?? 0) || 0;
}
