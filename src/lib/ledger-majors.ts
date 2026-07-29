/**
 * OpenPay Pro ledger majors — BTC / ETH / SOL / PI balances on wallets.
 * Swap / buy / send / receive use CoinGecko USD prices (custodial ledger, not on-chain).
 */
import type { MajorTokenId } from "@/lib/major-tokens";
import { MAJOR_TOKENS } from "@/lib/major-tokens";
import type { SwapNetworkId } from "@/lib/swap-networks";

export const OUSD_SWAP_ID = "__ousd__";
export const BTC_SWAP_ID = "__btc__";
export const ETH_SWAP_ID = "__eth__";
export const SOL_SWAP_ID = "__sol__";
export const PI_SWAP_ID = "__pi__";

export type LedgerMajorId = MajorTokenId; // btc | eth | sol | pi

export type LedgerAssetCode = "OUSD" | "BTC" | "ETH" | "SOL" | "PI";

export const LEDGER_MAJOR_SWAP_IDS: Record<LedgerMajorId, string> = {
  btc: BTC_SWAP_ID,
  eth: ETH_SWAP_ID,
  sol: SOL_SWAP_ID,
  pi: PI_SWAP_ID,
};

export const LEDGER_BALANCE_COLUMN: Record<LedgerMajorId, string> = {
  btc: "btc_balance",
  eth: "eth_balance",
  sol: "sol_balance",
  pi: "pi_balance",
};

const SWAP_ID_TO_MAJOR: Record<string, LedgerMajorId> = {
  [BTC_SWAP_ID]: "btc",
  [ETH_SWAP_ID]: "eth",
  [SOL_SWAP_ID]: "sol",
  [PI_SWAP_ID]: "pi",
  btc: "btc",
  eth: "eth",
  sol: "sol",
  pi: "pi",
};

export function isLedgerMajorSwapId(id: string): boolean {
  return id in SWAP_ID_TO_MAJOR || Object.values(LEDGER_MAJOR_SWAP_IDS).includes(id);
}

export function majorIdFromSwapId(id: string): LedgerMajorId | null {
  return SWAP_ID_TO_MAJOR[id] ?? null;
}

export function isLedgerSwapId(id: string): boolean {
  return id === OUSD_SWAP_ID || isLedgerMajorSwapId(id);
}

export function ledgerAssetFromMajor(id: LedgerMajorId): Exclude<LedgerAssetCode, "OUSD"> {
  return MAJOR_TOKENS[id].symbol as Exclude<LedgerAssetCode, "OUSD">;
}

export function majorIdFromAssetCode(code: string): LedgerMajorId | null {
  const c = code.toUpperCase();
  if (c === "BTC") return "btc";
  if (c === "ETH") return "eth";
  if (c === "SOL") return "sol";
  if (c === "PI") return "pi";
  return null;
}

export function networkForMajor(id: LedgerMajorId): SwapNetworkId {
  if (id === "btc") return "bitcoin";
  if (id === "eth") return "ethereum";
  if (id === "sol") return "solana";
  return "pi";
}

export function majorForNetwork(network: SwapNetworkId): LedgerMajorId | null {
  if (network === "bitcoin") return "btc";
  if (network === "ethereum") return "eth";
  if (network === "solana") return "sol";
  if (network === "pi") return "pi";
  return null;
}

const FALLBACK_USD: Record<LedgerMajorId, number> = {
  btc: 65000,
  eth: 1920,
  sol: 74,
  pi: 0.079,
};

const CG_IDS = MAJOR_TOKENS.btc.coingeckoId; // unused placeholder

export async function fetchMajorUsdPrices(
  ids: LedgerMajorId[] = ["btc", "eth", "sol", "pi"],
): Promise<Record<LedgerMajorId, number>> {
  const out = { ...FALLBACK_USD } as Record<LedgerMajorId, number>;
  try {
    const cg = ids.map((id) => MAJOR_TOKENS[id].coingeckoId).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cg}&vs_currencies=usd`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return out;
    const j = (await res.json()) as Record<string, { usd?: number }>;
    for (const id of ids) {
      const p = Number(j[MAJOR_TOKENS[id].coingeckoId]?.usd);
      if (p > 0) out[id] = p;
    }
  } catch {
    /* keep fallbacks */
  }
  return out;
}

export function walletMajorSelect(): string {
  return "id, user_id, address, ousd_balance, pi_balance, btc_balance, eth_balance, sol_balance";
}

export function readMajorBalance(
  wallet: Record<string, unknown> | null | undefined,
  major: LedgerMajorId,
): number {
  if (!wallet) return 0;
  const col = LEDGER_BALANCE_COLUMN[major];
  return Number(wallet[col] ?? 0);
}

void CG_IDS;
