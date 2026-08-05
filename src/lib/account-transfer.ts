/** Funding / Spot / Futures / P2P internal account transfer helpers. */

import {
  LEDGER_BALANCE_COLUMN,
  LEDGER_MAJOR_ASSET_CODES,
  majorIdFromAssetCode,
} from "@/lib/ledger-majors";

export const ACCOUNT_IDS = ["funding", "spot", "trading", "p2p"] as const;
export type AccountId = (typeof ACCOUNT_IDS)[number];

export const ACCOUNT_LABELS: Record<AccountId, string> = {
  funding: "Funding",
  spot: "Spot",
  trading: "Futures",
  p2p: "P2P",
};

export const TRANSFER_ASSETS = [
  "OUSD",
  ...LEDGER_MAJOR_ASSET_CODES,
] as const;
export type TransferAsset = (typeof TRANSFER_ASSETS)[number];

export function isAccountId(v: string): v is AccountId {
  return (ACCOUNT_IDS as readonly string[]).includes(v);
}

export function isTransferAsset(v: string): v is TransferAsset {
  return (TRANSFER_ASSETS as readonly string[]).includes(v.toUpperCase());
}

export function fundingBalanceColumn(asset: string): string | null {
  if (asset.toUpperCase() === "OUSD") return "ousd_balance";
  const id = majorIdFromAssetCode(asset);
  return id ? LEDGER_BALANCE_COLUMN[id] : null;
}

export function readFundingBalance(
  wallet: Record<string, unknown> | null | undefined,
  asset: string,
): number {
  const col = fundingBalanceColumn(asset);
  if (!col || !wallet) return 0;
  return Number(wallet[col] ?? 0) || 0;
}
