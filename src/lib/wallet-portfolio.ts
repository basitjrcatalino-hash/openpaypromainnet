import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMajorUsdPrices } from "@/lib/ledger-majors";

export type WalletBalanceSource = {
  id: string;
  ousd_balance?: number | null;
  pi_balance?: number | null;
  btc_balance?: number | null;
  eth_balance?: number | null;
  sol_balance?: number | null;
  usdc_balance?: number | null;
  usdt_balance?: number | null;
};

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
    const usd =
      Number(row.balance ?? 0) * Number(tokens?.price_usd ?? 0);
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
    const majorsUsd =
      Number(wallet.ousd_balance ?? 0) +
      Number(wallet.pi_balance ?? 0) * (prices?.pi ?? 0.079) +
      Number(wallet.btc_balance ?? 0) * (prices?.btc ?? 65000) +
      Number(wallet.eth_balance ?? 0) * (prices?.eth ?? 1920) +
      Number(wallet.sol_balance ?? 0) * (prices?.sol ?? 74) +
      Number(wallet.usdc_balance ?? 0) * (prices?.usdc ?? 1) +
      Number(wallet.usdt_balance ?? 0) * (prices?.usdt ?? 1);
    totals[wallet.id] = (holdingsByWallet[wallet.id] ?? 0) + majorsUsd;
  }
  return totals;
}
