/**
 * OpenPay Pro ledger majors — BTC / ETH / SOL / PI + stablecoin balances on wallets.
 * Swap / buy / send / receive use CoinGecko USD prices (custodial ledger, not on-chain).
 */
import type { MajorTokenId } from "@/lib/major-tokens";
import { MAJOR_TOKENS, MAJOR_TOKEN_IDS, isMajorTokenId } from "@/lib/major-tokens";
import type { SwapNetworkId } from "@/lib/swap-networks";

export const OUSD_SWAP_ID = "__ousd__";
export const BTC_SWAP_ID = "__btc__";
export const ETH_SWAP_ID = "__eth__";
export const SOL_SWAP_ID = "__sol__";
export const PI_SWAP_ID = "__pi__";
export const USDC_SWAP_ID = "__usdc__";
export const USDT_SWAP_ID = "__usdt__";
export const PYUSD_SWAP_ID = "__pyusd__";
export const USDG_SWAP_ID = "__usdg__";
export const USD1_SWAP_ID = "__usd1__";
export const CASH_SWAP_ID = "__cash__";
export const EURC_SWAP_ID = "__eurc__";

export type LedgerMajorId = MajorTokenId;

export type LedgerAssetCode =
  | "OUSD"
  | "BTC"
  | "ETH"
  | "SOL"
  | "PI"
  | "USDC"
  | "USDT"
  | "PYUSD"
  | "USDG"
  | "USD1"
  | "CASH"
  | "EURC";

export const LEDGER_MAJOR_ASSET_CODES = [
  "BTC",
  "ETH",
  "SOL",
  "PI",
  "USDC",
  "USDT",
  "PYUSD",
  "USDG",
  "USD1",
  "CASH",
  "EURC",
] as const satisfies ReadonlyArray<Exclude<LedgerAssetCode, "OUSD">>;

export const LEDGER_ASSET_CODES = [
  "OUSD",
  ...LEDGER_MAJOR_ASSET_CODES,
] as const satisfies ReadonlyArray<LedgerAssetCode>;

export const LEDGER_MAJOR_SWAP_IDS: Record<LedgerMajorId, string> = {
  btc: BTC_SWAP_ID,
  eth: ETH_SWAP_ID,
  sol: SOL_SWAP_ID,
  pi: PI_SWAP_ID,
  usdc: USDC_SWAP_ID,
  usdt: USDT_SWAP_ID,
  pyusd: PYUSD_SWAP_ID,
  usdg: USDG_SWAP_ID,
  usd1: USD1_SWAP_ID,
  cash: CASH_SWAP_ID,
  eurc: EURC_SWAP_ID,
};

export const LEDGER_BALANCE_COLUMN: Record<LedgerMajorId, string> = {
  btc: "btc_balance",
  eth: "eth_balance",
  sol: "sol_balance",
  pi: "pi_balance",
  usdc: "usdc_balance",
  usdt: "usdt_balance",
  pyusd: "pyusd_balance",
  usdg: "usdg_balance",
  usd1: "usd1_balance",
  cash: "cash_balance",
  eurc: "eurc_balance",
};

const SWAP_ID_TO_MAJOR: Record<string, LedgerMajorId> = {
  [BTC_SWAP_ID]: "btc",
  [ETH_SWAP_ID]: "eth",
  [SOL_SWAP_ID]: "sol",
  [PI_SWAP_ID]: "pi",
  [USDC_SWAP_ID]: "usdc",
  [USDT_SWAP_ID]: "usdt",
  [PYUSD_SWAP_ID]: "pyusd",
  [USDG_SWAP_ID]: "usdg",
  [USD1_SWAP_ID]: "usd1",
  [CASH_SWAP_ID]: "cash",
  [EURC_SWAP_ID]: "eurc",
  btc: "btc",
  eth: "eth",
  sol: "sol",
  pi: "pi",
  usdc: "usdc",
  usdt: "usdt",
  pyusd: "pyusd",
  usdg: "usdg",
  usd1: "usd1",
  cash: "cash",
  eurc: "eurc",
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
  for (const id of MAJOR_TOKEN_IDS) {
    if (MAJOR_TOKENS[id].symbol === c) return id;
  }
  return null;
}

export function networkForMajor(id: LedgerMajorId): SwapNetworkId {
  if (id === "btc") return "bitcoin";
  if (id === "eth" || id === "eurc") return "ethereum";
  if (
    id === "sol" ||
    id === "usdc" ||
    id === "usdt" ||
    id === "pyusd" ||
    id === "usdg" ||
    id === "usd1" ||
    id === "cash"
  ) {
    return "solana";
  }
  return "pi";
}

/** Primary native asset for a network (one per chain). */
export function majorForNetwork(network: SwapNetworkId): LedgerMajorId | null {
  if (network === "bitcoin") return "btc";
  if (network === "ethereum") return "eth";
  if (network === "solana") return "sol";
  if (network === "pi") return "pi";
  return null;
}

/** All ledger majors that belong on a swap network. */
export function majorsForNetwork(network: SwapNetworkId): LedgerMajorId[] {
  if (network === "bitcoin") return ["btc"];
  if (network === "ethereum") return ["eth", "eurc"];
  if (network === "solana") return ["sol", "usdc", "usdt", "pyusd", "usdg", "usd1", "cash"];
  if (network === "pi") return ["pi"];
  return [];
}

const FALLBACK_USD: Record<LedgerMajorId, number> = {
  btc: 65000,
  eth: 1920,
  sol: 74,
  pi: 0.079,
  usdc: 1,
  usdt: 1,
  pyusd: 1,
  usdg: 1,
  usd1: 1,
  cash: 1,
  eurc: 1.08,
};

/** Live PI/USD used by display currency (π) — refreshed by fetchMajorUsdPrices. */
let cachedPiUsd = FALLBACK_USD.pi;

export function getCachedPiUsdPrice(): number {
  return cachedPiUsd > 0 ? cachedPiUsd : FALLBACK_USD.pi;
}

export function setCachedPiUsdPrice(price: number): void {
  if (price > 0) cachedPiUsd = price;
}

export async function fetchMajorUsdPrices(
  ids: LedgerMajorId[] = [...MAJOR_TOKEN_IDS],
): Promise<Record<LedgerMajorId, number>> {
  const out = { ...FALLBACK_USD } as Record<LedgerMajorId, number>;
  try {
    const cg = ids
      .map((id) => MAJOR_TOKENS[id].coingeckoId)
      .filter((id) => id !== "phantom-cash")
      .join(",");
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
  if (out.pi > 0) cachedPiUsd = out.pi;
  return out;
}

/** PI amount required to cover an OUSD/$ amount (1 OUSD = $1). */
export function piAmountForOusd(ousdAmount: number, piUsdPrice = getCachedPiUsdPrice()): number {
  const price = piUsdPrice > 0 ? piUsdPrice : FALLBACK_USD.pi;
  return Math.round((ousdAmount / price) * 1e6) / 1e6;
}

/** OUSD/$ credited for a paid PI amount at live price. */
export function ousdFromPiAmount(piAmount: number, piUsdPrice = getCachedPiUsdPrice()): number {
  const price = piUsdPrice > 0 ? piUsdPrice : FALLBACK_USD.pi;
  return Math.round(piAmount * price * 1e8) / 1e8;
}

export function walletMajorSelect(extraPrefix = "id, user_id, address, ousd_balance"): string {
  const cols = MAJOR_TOKEN_IDS.map((id) => LEDGER_BALANCE_COLUMN[id]).join(", ");
  return `${extraPrefix}, ${cols}`;
}

export function readMajorBalance(
  wallet: Record<string, unknown> | null | undefined,
  major: LedgerMajorId,
): number {
  if (!wallet) return 0;
  const col = LEDGER_BALANCE_COLUMN[major];
  return Number(wallet[col] ?? 0);
}

export function majorBalancePatch(
  major: LedgerMajorId,
  next: number,
): Record<string, number> {
  return { [LEDGER_BALANCE_COLUMN[major]]: next };
}

export function isLedgerAssetCode(code: string): code is LedgerAssetCode {
  return (LEDGER_ASSET_CODES as readonly string[]).includes(code.toUpperCase());
}

export { isMajorTokenId, FALLBACK_USD as FALLBACK_MAJOR_USD_PRICES };
