/**
 * OpenPay Pro ledger majors — BTC / ETH / SOL / PI + stables + Phantom Solana listings.
 * Swap / buy / send / receive use CoinGecko USD prices (custodial ledger, not on-chain).
 */
import type { MajorTokenId } from "@/lib/major-tokens";
import { MAJOR_TOKENS, isMajorTokenId } from "@/lib/major-tokens";
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
export const HYPE_SWAP_ID = "__hype__";
export const ZEC_SWAP_ID = "__zec__";
export const TSLAX_SWAP_ID = "__tslax__";
export const NFLXX_SWAP_ID = "__nflxx__";
export const GOOGLX_SWAP_ID = "__googlx__";
export const BNB_SWAP_ID = "__bnb__";
export const UNI_SWAP_ID = "__uni__";
export const OKB_SWAP_ID = "__okb__";
export const GT_SWAP_ID = "__gt__";
export const BGB_SWAP_ID = "__bgb__";
export const CAKE_SWAP_ID = "__cake__";
export const JUP_SWAP_ID = "__jup__";
export const RON_SWAP_ID = "__ron__";
export const XRP_SWAP_ID = "__xrp__";
export const TRX_SWAP_ID = "__trx__";
export const DOGE_SWAP_ID = "__doge__";
export const ADA_SWAP_ID = "__ada__";
export const LINK_SWAP_ID = "__link__";
export const XLM_SWAP_ID = "__xlm__";
export const BCH_SWAP_ID = "__bch__";
export const GRAM_SWAP_ID = "__gram__";
export const AVAX_SWAP_ID = "__avax__";
export const SUI_SWAP_ID = "__sui__";
export const XAUT_SWAP_ID = "__xaut__";
export const ONDO_SWAP_ID = "__ondo__";
export const NEAR_SWAP_ID = "__near__";
export const USDY_SWAP_ID = "__usdy__";
export const PAXG_SWAP_ID = "__paxg__";
export const WLFI_SWAP_ID = "__wlfi__";
export const ASTER_SWAP_ID = "__aster__";
export const RLUSD_SWAP_ID = "__rlusd__";
export const AAVE_SWAP_ID = "__aave__";
export const DOT_SWAP_ID = "__dot__";
export const PUMP_SWAP_ID = "__pump__";

/** Ledger-backed majors only (wallet balance columns / swap). Display catalog may be wider. */
export const LEDGER_MAJOR_SWAP_IDS = {
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
  hype: HYPE_SWAP_ID,
  zec: ZEC_SWAP_ID,
  tslax: TSLAX_SWAP_ID,
  nflxx: NFLXX_SWAP_ID,
  googlx: GOOGLX_SWAP_ID,
  bnb: BNB_SWAP_ID,
  uni: UNI_SWAP_ID,
  okb: OKB_SWAP_ID,
  gt: GT_SWAP_ID,
  bgb: BGB_SWAP_ID,
  cake: CAKE_SWAP_ID,
  jup: JUP_SWAP_ID,
  ron: RON_SWAP_ID,
  xrp: XRP_SWAP_ID,
  trx: TRX_SWAP_ID,
  doge: DOGE_SWAP_ID,
  ada: ADA_SWAP_ID,
  link: LINK_SWAP_ID,
  xlm: XLM_SWAP_ID,
  bch: BCH_SWAP_ID,
  gram: GRAM_SWAP_ID,
  avax: AVAX_SWAP_ID,
  sui: SUI_SWAP_ID,
  xaut: XAUT_SWAP_ID,
  ondo: ONDO_SWAP_ID,
  near: NEAR_SWAP_ID,
  usdy: USDY_SWAP_ID,
  paxg: PAXG_SWAP_ID,
  wlfi: WLFI_SWAP_ID,
  aster: ASTER_SWAP_ID,
  rlusd: RLUSD_SWAP_ID,
  aave: AAVE_SWAP_ID,
  dot: DOT_SWAP_ID,
  pump: PUMP_SWAP_ID,
} as const;

export type LedgerMajorId = keyof typeof LEDGER_MAJOR_SWAP_IDS;

export const LEDGER_MAJOR_IDS = Object.keys(LEDGER_MAJOR_SWAP_IDS) as LedgerMajorId[];

export function isLedgerMajorId(id: string): id is LedgerMajorId {
  return Object.prototype.hasOwnProperty.call(LEDGER_MAJOR_SWAP_IDS, id);
}

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
  | "EURC"
  | "HYPE"
  | "ZEC"
  | "TSLAX"
  | "NFLXX"
  | "GOOGLX"
  | "BNB"
  | "UNI"
  | "OKB"
  | "GT"
  | "BGB"
  | "CAKE"
  | "JUP"
  | "RON"
  | "XRP"
  | "TRX"
  | "DOGE"
  | "ADA"
  | "LINK"
  | "XLM"
  | "BCH"
  | "GRAM"
  | "AVAX"
  | "SUI"
  | "XAUT"
  | "ONDO"
  | "NEAR"
  | "USDY"
  | "PAXG"
  | "WLFI"
  | "ASTER"
  | "RLUSD"
  | "AAVE"
  | "DOT"
  | "PUMP";

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
  "XRP",
  "TRX",
  "DOGE",
  "ADA",
  "LINK",
  "XLM",
  "BCH",
  "GRAM",
  "AVAX",
  "SUI",
  "XAUT",
  "ONDO",
  "NEAR",
  "USDY",
  "PAXG",
  "WLFI",
  "ASTER",
  "RLUSD",
  "AAVE",
  "DOT",
  "PUMP",
] as const satisfies ReadonlyArray<Exclude<LedgerAssetCode, "OUSD">>;

export const LEDGER_ASSET_CODES = [
  "OUSD",
  ...LEDGER_MAJOR_ASSET_CODES,
] as const satisfies ReadonlyArray<LedgerAssetCode>;

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
  hype: "hype_balance",
  zec: "zec_balance",
  tslax: "tslax_balance",
  nflxx: "nflxx_balance",
  googlx: "googlx_balance",
  bnb: "bnb_balance",
  uni: "uni_balance",
  okb: "okb_balance",
  gt: "gt_balance",
  bgb: "bgb_balance",
  cake: "cake_balance",
  jup: "jup_balance",
  ron: "ron_balance",
  xrp: "xrp_balance",
  trx: "trx_balance",
  doge: "doge_balance",
  ada: "ada_balance",
  link: "link_balance",
  xlm: "xlm_balance",
  bch: "bch_balance",
  gram: "gram_balance",
  avax: "avax_balance",
  sui: "sui_balance",
  xaut: "xaut_balance",
  ondo: "ondo_balance",
  near: "near_balance",
  usdy: "usdy_balance",
  paxg: "paxg_balance",
  wlfi: "wlfi_balance",
  aster: "aster_balance",
  rlusd: "rlusd_balance",
  aave: "aave_balance",
  dot: "dot_balance",
  pump: "pump_balance",
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
  [HYPE_SWAP_ID]: "hype",
  [ZEC_SWAP_ID]: "zec",
  [TSLAX_SWAP_ID]: "tslax",
  [NFLXX_SWAP_ID]: "nflxx",
  [GOOGLX_SWAP_ID]: "googlx",
  [BNB_SWAP_ID]: "bnb",
  [UNI_SWAP_ID]: "uni",
  [OKB_SWAP_ID]: "okb",
  [GT_SWAP_ID]: "gt",
  [BGB_SWAP_ID]: "bgb",
  [CAKE_SWAP_ID]: "cake",
  [JUP_SWAP_ID]: "jup",
  [RON_SWAP_ID]: "ron",
  [XRP_SWAP_ID]: "xrp",
  [TRX_SWAP_ID]: "trx",
  [DOGE_SWAP_ID]: "doge",
  [ADA_SWAP_ID]: "ada",
  [LINK_SWAP_ID]: "link",
  [XLM_SWAP_ID]: "xlm",
  [BCH_SWAP_ID]: "bch",
  [GRAM_SWAP_ID]: "gram",
  [AVAX_SWAP_ID]: "avax",
  [SUI_SWAP_ID]: "sui",
  [XAUT_SWAP_ID]: "xaut",
  [ONDO_SWAP_ID]: "ondo",
  [NEAR_SWAP_ID]: "near",
  [USDY_SWAP_ID]: "usdy",
  [PAXG_SWAP_ID]: "paxg",
  [WLFI_SWAP_ID]: "wlfi",
  [ASTER_SWAP_ID]: "aster",
  [RLUSD_SWAP_ID]: "rlusd",
  [AAVE_SWAP_ID]: "aave",
  [DOT_SWAP_ID]: "dot",
  [PUMP_SWAP_ID]: "pump",
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
  hype: "hype",
  zec: "zec",
  tslax: "tslax",
  nflxx: "nflxx",
  googlx: "googlx",
  bnb: "bnb",
  uni: "uni",
  okb: "okb",
  gt: "gt",
  bgb: "bgb",
  cake: "cake",
  jup: "jup",
  ron: "ron",
  xrp: "xrp",
  trx: "trx",
  doge: "doge",
  ada: "ada",
  link: "link",
  xlm: "xlm",
  bch: "bch",
  gram: "gram",
  avax: "avax",
  sui: "sui",
  xaut: "xaut",
  ondo: "ondo",
  near: "near",
  usdy: "usdy",
  paxg: "paxg",
  wlfi: "wlfi",
  aster: "aster",
  rlusd: "rlusd",
  aave: "aave",
  dot: "dot",
  pump: "pump",
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

export function networkForMajor(id: LedgerMajorId): SwapNetworkId {
  if (id === "btc") return "bitcoin";
  if (id === "bch") return "bitcoin-cash";
  if (id === "dot") return "polkadot";
  if (
    id === "eth" ||
    id === "eurc" ||
    id === "uni" ||
    id === "okb" ||
    id === "gt" ||
    id === "bgb" ||
    id === "link" ||
    id === "xaut" ||
    id === "ondo" ||
    id === "usdy" ||
    id === "paxg" ||
    id === "wlfi" ||
    id === "aave"
  ) {
    return "ethereum";
  }
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
    id === "pump"
  ) {
    return "solana";
  }
  return "pi";
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
  if (network === "bitcoin") return ["btc"];
  if (network === "bitcoin-cash") return ["bch"];
  if (network === "ethereum") {
    return [
      "eth",
      "eurc",
      "uni",
      "okb",
      "gt",
      "bgb",
      "link",
      "xaut",
      "ondo",
      "usdy",
      "paxg",
      "wlfi",
      "aave",
    ];
  }
  if (network === "bnb") return ["bnb", "cake", "aster"];
  if (network === "ronin") return ["ron"];
  if (network === "xrp") return ["xrp", "rlusd"];
  if (network === "tron") return ["trx"];
  if (network === "dogecoin") return ["doge"];
  if (network === "cardano") return ["ada"];
  if (network === "stellar") return ["xlm"];
  if (network === "ton") return ["gram"];
  if (network === "avalanche") return ["avax"];
  if (network === "sui") return ["sui"];
  if (network === "near") return ["near"];
  if (network === "polkadot") return ["dot"];
  if (network === "solana") {
    return [
      "sol",
      "usdc",
      "usdt",
      "pyusd",
      "usdg",
      "usd1",
      "cash",
      "hype",
      "zec",
      "tslax",
      "nflxx",
      "googlx",
      "jup",
      "pump",
    ];
  }
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

/** Live PI/USD used by display currency (π) — refreshed by fetchMajorUsdPrices. */
let cachedPiUsd = FALLBACK_USD.pi;

export function getCachedPiUsdPrice(): number {
  return cachedPiUsd > 0 ? cachedPiUsd : FALLBACK_USD.pi;
}

export function setCachedPiUsdPrice(price: number): void {
  if (price > 0) cachedPiUsd = price;
}

export async function fetchMajorUsdPrices(
  ids: LedgerMajorId[] = [...LEDGER_MAJOR_IDS],
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
  const cols = LEDGER_MAJOR_IDS.map((id) => LEDGER_BALANCE_COLUMN[id]).join(", ");
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
