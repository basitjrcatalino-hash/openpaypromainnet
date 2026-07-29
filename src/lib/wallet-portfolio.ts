import type { SupabaseClient } from "@supabase/supabase-js";

export type WalletBalanceSource = {
  id: string;
  ousd_balance?: number | null;
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

export function walletGradient(address: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  }
  return WALLET_GRADIENTS[hash % WALLET_GRADIENTS.length];
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
  for (const wallet of wallets) {
    totals[wallet.id] =
      (holdingsByWallet[wallet.id] ?? 0) + Number(wallet.ousd_balance ?? 0);
  }
  return totals;
}
