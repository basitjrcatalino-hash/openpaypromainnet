import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FALLBACK_MAJOR_USD_PRICES,
  LEDGER_BALANCE_COLUMN,
  fetchMajorUsdPrices,
  type LedgerMajorId,
} from "@/lib/ledger-majors";
import { MAJOR_TOKEN_IDS } from "@/lib/major-tokens";

export type WalletBalanceSource = {
  id: string;
  ousd_balance?: number | null;
  pi_balance?: number | null;
  btc_balance?: number | null;
  eth_balance?: number | null;
  sol_balance?: number | null;
  usdc_balance?: number | null;
  usdt_balance?: number | null;
  pyusd_balance?: number | null;
  usdg_balance?: number | null;
  usd1_balance?: number | null;
  cash_balance?: number | null;
  eurc_balance?: number | null;
  [key: string]: unknown;
};

export type MajorUsdPriceMap = Partial<Record<LedgerMajorId, number>>;

/** Ledger majors (OUSD + all majors) in USD — shared by dashboard & sidebar. */
export function walletLedgerUsd(
  wallet: WalletBalanceSource | null | undefined,
  prices?: MajorUsdPriceMap | null,
): number {
  if (!wallet) return 0;
  let sum = Number(wallet.ousd_balance ?? 0);
  for (const id of MAJOR_TOKEN_IDS) {
    const col = LEDGER_BALANCE_COLUMN[id];
    const bal = Number(wallet[col] ?? 0);
    const px = prices?.[id] ?? FALLBACK_MAJOR_USD_PRICES[id];
    sum += bal * px;
  }
  return sum;
}

/** Deterministic Phantom-style gradient pair from wallet address. */
const WALLET_GRADIENTS: Array<[string, string]> = [
  ["#AB9FF2", "#6C5CE7"],
  ["#FF6B9D", "#C44569"],
  ["#00D2FF", "#3A7BD5"],
  ["#FFD93D", "#F7971E"],
  ["#6BCB77", "#2D6A4F"],
  ["#E056FD", "#686DE0"],
  ["#F093FB", "#F5576C"],
  ["#4FACFE", "#00F2FE"],
];

export function walletGradient(address: string | null | undefined): [string, string] {
  const s = typeof address === "string" ? address : "";
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return WALLET_GRADIENTS[hash % WALLET_GRADIENTS.length] ?? WALLET_GRADIENTS[0];
}

export async function fetchWalletPortfolioTotals(
  supabase: SupabaseClient,
  wallets: WalletBalanceSource[],
): Promise<Record<string, number>> {
  if (wallets.length === 0) return {};

  const walletIds = wallets.map((w) => w.id);
  const { data } = await supabase
    .from("token_holdings")
    .select("wallet_id, balance, tokens:token_id(price_usd)")
    .in("wallet_id", walletIds);

  const holdingsByWallet: Record<string, number> = {};
  for (const row of data ?? []) {
    const walletId = row.wallet_id as string;
    const tokens = row.tokens as { price_usd?: number | null } | null;
    const usd = Number(row.balance ?? 0) * Number(tokens?.price_usd ?? 0);
    holdingsByWallet[walletId] = (holdingsByWallet[walletId] ?? 0) + usd;
  }

  const totals: Record<string, number> = {};
  let prices: Awaited<ReturnType<typeof fetchMajorUsdPrices>> | null = null;
  try {
    prices = await fetchMajorUsdPrices();
  } catch {
    prices = null;
  }

  for (const wallet of wallets) {
    totals[wallet.id] =
      (holdingsByWallet[wallet.id] ?? 0) + walletLedgerUsd(wallet, prices);
  }
  return totals;
}
