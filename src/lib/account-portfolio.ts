import {
  ACCOUNT_IDS,
  TRANSFER_ASSETS,
  type AccountId,
  type TransferAsset,
} from "@/lib/account-transfer";
import {
  FALLBACK_MAJOR_USD_PRICES,
  type LedgerMajorId,
} from "@/lib/ledger-majors";
import { getCachedPiUsdPrice } from "@/lib/ledger-majors";

export type AssetPriceMap = Partial<Record<string, number>>;

/** USD price for a transfer/portfolio asset. */
export function usdPriceForAsset(asset: string, prices?: AssetPriceMap | null): number {
  const key = asset.toUpperCase();
  if (prices?.[key] != null && Number.isFinite(prices[key]!)) return Number(prices[key]);
  if (key === "OUSD" || key === "USDT" || key === "USDC" || key === "PYUSD" || key === "USDG" || key === "USD1" || key === "CASH" || key === "EURC") {
    return 1;
  }
  if (key === "PI") return getCachedPiUsdPrice() || 0.3;
  const major = key.toLowerCase() as LedgerMajorId;
  return FALLBACK_MAJOR_USD_PRICES[major] ?? 0;
}

export function accountUsdTotal(
  balances: Record<TransferAsset, number> | Record<string, number> | undefined,
  prices?: AssetPriceMap | null,
): number {
  if (!balances) return 0;
  let sum = 0;
  for (const asset of TRANSFER_ASSETS) {
    const bal = Number(balances[asset] ?? 0) || 0;
    if (bal <= 0) continue;
    sum += bal * usdPriceForAsset(asset, prices);
  }
  return sum;
}

export function portfolioUsdTotals(
  balances: Record<AccountId, Record<TransferAsset, number>>,
  prices?: AssetPriceMap | null,
): Record<AccountId, number> & { total: number } {
  const funding = accountUsdTotal(balances.funding, prices);
  const trading = accountUsdTotal(balances.trading, prices);
  const p2p = accountUsdTotal(balances.p2p, prices);
  return { funding, trading, p2p, total: funding + trading + p2p };
}

export type PortfolioAssetRow = {
  asset: TransferAsset;
  balance: number;
  priceUsd: number;
  valueUsd: number;
};

export function accountAssetRows(
  balances: Record<TransferAsset, number> | Record<string, number> | undefined,
  prices?: AssetPriceMap | null,
  opts?: { hideZero?: boolean },
): PortfolioAssetRow[] {
  const hideZero = opts?.hideZero !== false;
  const rows: PortfolioAssetRow[] = [];
  for (const asset of TRANSFER_ASSETS) {
    const balance = Number(balances?.[asset] ?? 0) || 0;
    if (hideZero && balance <= 0) continue;
    const priceUsd = usdPriceForAsset(asset, prices);
    rows.push({
      asset,
      balance,
      priceUsd,
      valueUsd: balance * priceUsd,
    });
  }
  return rows.sort((a, b) => b.valueUsd - a.valueUsd);
}

export const ACCOUNT_ICONS: Record<AccountId, string> = {
  funding: "funding",
  trading: "trading",
  p2p: "p2p",
};

export function isAccountRouteId(v: string): v is AccountId {
  return (ACCOUNT_IDS as readonly string[]).includes(v);
}
