/**
 * Regenerate ledger-majors.ts so EVERY MajorTokenId is ledger-backed
 * (buy / hold / spot settlement / transfers).
 */
import fs from "fs";

const majorSrc = fs.readFileSync("src/lib/major-tokens.ts", "utf8");
const typeStart = majorSrc.indexOf("export type MajorTokenId");
const typeEnd = majorSrc.indexOf("export type MajorTokenDef");
const allIds = [...majorSrc.slice(typeStart, typeEnd).matchAll(/\| "([a-z0-9]+)"/g)].map(
  (m) => m[1],
);

/** Preserve known fallback USD prices for original ledger majors. */
const KNOWN_FALLBACK = {
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
  hype: 55,
  zec: 450,
  tslax: 308,
  nflxx: 70,
  googlx: 200,
  bnb: 584,
  uni: 4.21,
  okb: 87.36,
  gt: 6.46,
  bgb: 1.63,
  cake: 1.42,
  jup: 0.197,
  ron: 0.0487,
  xrp: 1.083,
  trx: 0.328,
  doge: 0.0703,
  ada: 0.187,
  link: 8.38,
  xlm: 0.177,
  bch: 212.24,
  gram: 1.4,
  avax: 6.62,
  sui: 0.691,
  xaut: 4045,
  ondo: 0.393,
  near: 1.72,
  usdy: 1.14,
  paxg: 4056,
  wlfi: 0.0554,
  aster: 0.604,
  rlusd: 1,
  aave: 92.46,
  dot: 0.792,
  pump: 0.002184,
};

const NETWORK_LABEL_TO_SWAP = {
  Bitcoin: "bitcoin",
  "Bitcoin Cash": "bitcoin-cash",
  Ethereum: "ethereum",
  Solana: "solana",
  "BNB Smart Chain": "bnb",
  BNB: "bnb",
  Ronin: "ronin",
  "XRP Ledger": "xrp",
  XRP: "xrp",
  TRON: "tron",
  Tron: "tron",
  Dogecoin: "dogecoin",
  Cardano: "cardano",
  Stellar: "stellar",
  TON: "ton",
  Avalanche: "avalanche",
  Sui: "sui",
  NEAR: "near",
  Polkadot: "polkadot",
  "Pi Network": "pi",
  Pi: "pi",
  Monero: "ethereum", // no monero swap net — book under eth display
  Litecoin: "bitcoin",
  Hedera: "ethereum",
  Aptos: "ethereum",
  Cosmos: "ethereum",
  Arbitrum: "ethereum",
  Optimism: "ethereum",
  Polygon: "ethereum",
  Base: "ethereum",
  Cronos: "ethereum",
  Mantle: "ethereum",
  Filecoin: "ethereum",
  Algorand: "ethereum",
  VeChain: "ethereum",
  Internet: "ethereum",
  "Internet Computer": "ethereum",
  Kaspa: "ethereum",
  MultiversX: "ethereum",
  Stacks: "ethereum",
  Flare: "ethereum",
  Celo: "ethereum",
  Immutable: "ethereum",
  Thorchain: "ethereum",
  "KuCoin Token": "ethereum",
  Other: "ethereum",
};

function networkLabelForId(id) {
  const re = new RegExp(
    `${id}:\\s*\\{[\\s\\S]*?network:\\s*"([^"]+)"`,
  );
  const m = majorSrc.match(re);
  return m ? m[1] : "Ethereum";
}

const constDecls = allIds
  .map((id) => `export const ${id.toUpperCase()}_SWAP_ID = "__${id}__";`)
  .join("\n");

const swapEntries = allIds
  .map((id) => `  ${id}: ${id.toUpperCase()}_SWAP_ID,`)
  .join("\n");

const assetCodes = allIds.map((id) => `  | "${id.toUpperCase()}"`).join("\n");

const assetCodeList = allIds.map((id) => `  "${id.toUpperCase()}",`).join("\n");

const balanceEntries = allIds
  .map((id) => `  ${id}: "${id}_balance",`)
  .join("\n");

const swapIdMapEntries = allIds
  .map((id) => `  [${id.toUpperCase()}_SWAP_ID]: "${id}",\n  ${id}: "${id}",`)
  .join("\n");

const fallbackEntries = allIds
  .map((id) => `  ${id}: ${KNOWN_FALLBACK[id] ?? 0},`)
  .join("\n");

const out = `/**
 * OpenPay Pro ledger majors — every Tokens catalog major is ledger-backed
 * (buy / hold / send / receive / Spot settlement). Prices via CoinGecko USD.
 */
import type { MajorTokenId } from "@/lib/major-tokens";
import { MAJOR_TOKENS, isMajorTokenId } from "@/lib/major-tokens";
import type { SwapNetworkId } from "@/lib/swap-networks";

export const OUSD_SWAP_ID = "__ousd__";
${constDecls}

/** Ledger-backed majors — mirrors MAJOR_TOKENS (full catalog). */
export const LEDGER_MAJOR_SWAP_IDS = {
${swapEntries}
} as const;

export type LedgerMajorId = keyof typeof LEDGER_MAJOR_SWAP_IDS;

export const LEDGER_MAJOR_IDS = Object.keys(LEDGER_MAJOR_SWAP_IDS) as LedgerMajorId[];

export function isLedgerMajorId(id: string): id is LedgerMajorId {
  return Object.prototype.hasOwnProperty.call(LEDGER_MAJOR_SWAP_IDS, id);
}

export type LedgerAssetCode =
  | "OUSD"
${assetCodes};

export const LEDGER_MAJOR_ASSET_CODES = [
${assetCodeList}
] as const satisfies ReadonlyArray<Exclude<LedgerAssetCode, "OUSD">>;

export const LEDGER_ASSET_CODES = [
  "OUSD",
  ...LEDGER_MAJOR_ASSET_CODES,
] as const satisfies ReadonlyArray<LedgerAssetCode>;

export const LEDGER_BALANCE_COLUMN: Record<LedgerMajorId, string> = {
${balanceEntries}
};

const SWAP_ID_TO_MAJOR: Record<string, LedgerMajorId> = {
${swapIdMapEntries}
};

export function isLedgerMajorSwapId(id: string): boolean {
  return (
    id in SWAP_ID_TO_MAJOR ||
    (Object.values(LEDGER_MAJOR_SWAP_IDS) as string[]).includes(id)
  );
}

export function majorIdFromSwapId(id: string): LedgerMajorId | null {
  return SWAP_ID_TO_MAJOR[id] ?? null;
}

export function isLedgerSwapId(id: string): boolean {
  return id === OUSD_SWAP_ID || isLedgerMajorSwapId(id);
}

export function ledgerAssetFromMajor(id: LedgerMajorId): Exclude<LedgerAssetCode, "OUSD"> {
  return MAJOR_TOKENS[id].symbol.toUpperCase() as Exclude<LedgerAssetCode, "OUSD">;
}

export function majorIdFromAssetCode(code: string): LedgerMajorId | null {
  const c = code.toUpperCase();
  for (const id of LEDGER_MAJOR_IDS) {
    if (MAJOR_TOKENS[id].symbol.toUpperCase() === c) return id;
  }
  return null;
}

const NETWORK_LABEL_MAP: Record<string, SwapNetworkId> = {
  Bitcoin: "bitcoin",
  "Bitcoin Cash": "bitcoin-cash",
  Ethereum: "ethereum",
  Solana: "solana",
  "BNB Smart Chain": "bnb",
  BNB: "bnb",
  Ronin: "ronin",
  "XRP Ledger": "xrp",
  XRP: "xrp",
  TRON: "tron",
  Tron: "tron",
  Dogecoin: "dogecoin",
  Cardano: "cardano",
  Stellar: "stellar",
  TON: "ton",
  Avalanche: "avalanche",
  Sui: "sui",
  NEAR: "near",
  Polkadot: "polkadot",
  "Pi Network": "pi",
  Pi: "pi",
};

export function networkForMajor(id: LedgerMajorId): SwapNetworkId {
  // Prefer explicit native/chain majors
  if (id === "btc") return "bitcoin";
  if (id === "bch") return "bitcoin-cash";
  if (id === "dot") return "polkadot";
  if (id === "bnb" || id === "cake" || id === "aster") return "bnb";
  if (id === "ron") return "ronin";
  if (id === "xrp" || id === "rlusd") return "xrp";
  if (id === "trx") return "tron";
  if (id === "doge") return "dogecoin";
  if (id === "ada") return "cardano";
  if (id === "xlm") return "stellar";
  if (id === "gram") return "ton";
  if (id === "avax") return "avalanche";
  if (id === "sui") return "sui";
  if (id === "near") return "near";
  if (id === "pi") return "pi";
  if (
    id === "sol" ||
    id === "usdc" ||
    id === "usdt" ||
    id === "pyusd" ||
    id === "usdg" ||
    id === "usd1" ||
    id === "cash" ||
    id === "hype" ||
    id === "zec" ||
    id === "tslax" ||
    id === "nflxx" ||
    id === "googlx" ||
    id === "jup" ||
    id === "pump" ||
    id === "bonk" ||
    id === "wif" ||
    id === "pyth" ||
    id === "pengu" ||
    id === "trump"
  ) {
    return "solana";
  }
  const label = MAJOR_TOKENS[id]?.network;
  if (label && NETWORK_LABEL_MAP[label]) return NETWORK_LABEL_MAP[label];
  // Default ERC-20-style listings to Ethereum swap network
  return "ethereum";
}

/** Primary native asset for a network (one per chain). */
export function majorForNetwork(network: SwapNetworkId): LedgerMajorId | null {
  if (network === "bitcoin") return "btc";
  if (network === "bitcoin-cash") return "bch";
  if (network === "ethereum") return "eth";
  if (network === "solana") return "sol";
  if (network === "bnb") return "bnb";
  if (network === "ronin") return "ron";
  if (network === "xrp") return "xrp";
  if (network === "tron") return "trx";
  if (network === "dogecoin") return "doge";
  if (network === "cardano") return "ada";
  if (network === "stellar") return "xlm";
  if (network === "ton") return "gram";
  if (network === "avalanche") return "avax";
  if (network === "sui") return "sui";
  if (network === "near") return "near";
  if (network === "polkadot") return "dot";
  if (network === "pi") return "pi";
  return null;
}

/** All ledger majors that belong on a swap network. */
export function majorsForNetwork(network: SwapNetworkId): LedgerMajorId[] {
  return LEDGER_MAJOR_IDS.filter((id) => networkForMajor(id) === network);
}

const FALLBACK_USD: Record<LedgerMajorId, number> = {
${fallbackEntries}
};

/** Live PI/USD used by display currency (π) — refreshed by fetchMajorUsdPrices. */
let cachedPiUsd = FALLBACK_USD.pi;

export function getCachedPiUsdPrice(): number {
  return cachedPiUsd > 0 ? cachedPiUsd : FALLBACK_USD.pi;
}

export function setCachedPiUsdPrice(price: number): void {
  if (price > 0) cachedPiUsd = price;
}

const CG_PRICE_CHUNK = 80;

export async function fetchMajorUsdPrices(
  ids: LedgerMajorId[] = [...LEDGER_MAJOR_IDS],
): Promise<Record<LedgerMajorId, number>> {
  const out = { ...FALLBACK_USD } as Record<LedgerMajorId, number>;
  try {
    const cgIds = ids
      .map((id) => MAJOR_TOKENS[id].coingeckoId)
      .filter((id) => id !== "phantom-cash");
    for (let i = 0; i < cgIds.length; i += CG_PRICE_CHUNK) {
      const chunk = cgIds.slice(i, i + CG_PRICE_CHUNK);
      const res = await fetch(
        \`https://api.coingecko.com/api/v3/simple/price?ids=\${chunk.join(",")}&vs_currencies=usd\`,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) continue;
      const j = (await res.json()) as Record<string, { usd?: number }>;
      for (const id of ids) {
        const p = Number(j[MAJOR_TOKENS[id].coingeckoId]?.usd);
        if (p > 0) out[id] = p;
      }
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
  const cols = LEDGER_MAJOR_IDS.map((id) => LEDGER_BALANCE_COLUMN[id]).join(", ");
  return \`\${extraPrefix}, \${cols}\`;
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

/** Compile-time: ledger majors must cover the full Tokens catalog. */
const _assertAllMajorsLedger: Record<MajorTokenId, true> = Object.fromEntries(
  allIdsPlaceholder,
) as Record<MajorTokenId, true>;
void _assertAllMajorsLedger;
`;

// Fix the assert at the end - can't use allIdsPlaceholder in template. Use LEDGER_MAJOR_IDS instead.
const final = out
  .replace(
    `/** Compile-time: ledger majors must cover the full Tokens catalog. */
const _assertAllMajorsLedger: Record<MajorTokenId, true> = Object.fromEntries(
  allIdsPlaceholder,
) as Record<MajorTokenId, true>;
void _assertAllMajorsLedger;
`,
    `/** Runtime check: every MajorTokenId has a ledger column. */
export function assertLedgerCoversCatalog(): void {
  for (const id of Object.keys(MAJOR_TOKENS) as MajorTokenId[]) {
    if (!isLedgerMajorId(id)) {
      throw new Error(\`Missing ledger major: \${id}\`);
    }
  }
}
`,
  );

fs.writeFileSync("src/lib/ledger-majors.ts", final);
console.log("wrote ledger-majors.ts with", allIds.length, "majors");

// Also expand TRANSFER_ASSETS in account-transfer.ts via a helper note
fs.writeFileSync(
  "scripts/_all-major-asset-codes.json",
  JSON.stringify(
    allIds.map((id) => id.toUpperCase()),
    null,
    2,
  ),
);
