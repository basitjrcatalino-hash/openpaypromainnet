/** OpenToken bonding curve — constant-product virtual reserves (original). */

export const DEFAULT_VIRTUAL_PI = 30;
export const DEFAULT_VIRTUAL_TOKENS = 1_073_000_191;
/** OUSD bonded on the curve required before OpenDEX graduation. */
export const DEFAULT_GRADUATION_TARGET_PI = 100_000;
export const DEFAULT_TOTAL_SUPPLY = 1_000_000_000;
/** Launch fee charged in OUSD to mint a new coin. */
export const DEFAULT_LAUNCH_FEE_OUSD = 100;
/** @deprecated Use DEFAULT_LAUNCH_FEE_OUSD */
export const DEFAULT_LAUNCH_FEE_PI = DEFAULT_LAUNCH_FEE_OUSD;
/** OpenToken buy/sell platform fee in basis points (30 = 0.30%). */
export const OPENTOKEN_TRADE_FEE_BPS = 30;

export type CurveState = {
  virtualPi: number;
  virtualTokens: number;
  reservePi: number;
  supplySold: number;
  totalSupply: number;
  graduationTargetPi: number;
};

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

export function resolveGraduationTarget(raw?: number | null): number {
  const n = Number(raw ?? DEFAULT_GRADUATION_TARGET_PI);
  // Legacy launches used 400 OUSD — treat as the new 100k target.
  if (!Number.isFinite(n) || n <= 0 || n === 400) return DEFAULT_GRADUATION_TARGET_PI;
  return n;
}

/** True only when status is graduated AND reserve has reached the 100k OUSD target. */
export function isOpenTokenGraduated(token: {
  status?: string | null;
  curve_reserve_pi?: number | null;
  graduation_target_pi?: number | null;
}): boolean {
  if (token.status !== "graduated") return false;
  const reserve = Number(token.curve_reserve_pi ?? 0);
  return reserve >= resolveGraduationTarget(token.graduation_target_pi);
}

export function applyOpenTokenTradeFee(
  amount: number,
  feeBps = OPENTOKEN_TRADE_FEE_BPS,
): { fee: number; net: number; feeBps: number; feePct: number } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { fee: 0, net: 0, feeBps, feePct: feeBps / 100 };
  }
  const fee = round8((amount * feeBps) / 10_000);
  const net = round8(Math.max(0, amount - fee));
  return { fee, net, feeBps, feePct: feeBps / 100 };
}

export function spotPrice(s: CurveState): number {
  const vPi = s.virtualPi + s.reservePi;
  const vTok = s.virtualTokens - s.supplySold;
  if (vTok <= 0 || vPi <= 0) return 0;
  return vPi / vTok;
}

export function marketCap(s: CurveState): number {
  return spotPrice(s) * s.totalSupply;
}

export function curveProgress(s: CurveState): number {
  if (s.graduationTargetPi <= 0) return 0;
  return Math.min(1, Math.max(0, s.reservePi / s.graduationTargetPi));
}

export function remainingTokens(s: CurveState): number {
  return Math.max(0, s.virtualTokens - s.supplySold);
}

/** Tokens received for spending `piIn` OUSD on the curve (after 0.30% fee). */
export function quoteBuy(
  s: CurveState,
  piIn: number,
): {
  tokenOut: number;
  avgPrice: number;
  nextPrice: number;
  fee: number;
  netIn: number;
  feeBps: number;
} {
  if (piIn <= 0) {
    return {
      tokenOut: 0,
      avgPrice: 0,
      nextPrice: spotPrice(s),
      fee: 0,
      netIn: 0,
      feeBps: OPENTOKEN_TRADE_FEE_BPS,
    };
  }
  const { fee, net: netIn, feeBps } = applyOpenTokenTradeFee(piIn);
  if (netIn <= 0) {
    return { tokenOut: 0, avgPrice: 0, nextPrice: spotPrice(s), fee, netIn: 0, feeBps };
  }
  const vPi = s.virtualPi + s.reservePi;
  const vTok = s.virtualTokens - s.supplySold;
  const k = vPi * vTok;
  const newVPi = vPi + netIn;
  const newVTok = k / newVPi;
  const tokenOut = vTok - newVTok;
  const avgPrice = tokenOut > 0 ? netIn / tokenOut : 0;
  const nextPrice = newVTok > 0 ? newVPi / newVTok : 0;
  return { tokenOut, avgPrice, nextPrice, fee, netIn, feeBps };
}

/** OUSD received for selling `tokenIn` tokens back to the curve (after 0.30% fee). */
export function quoteSell(
  s: CurveState,
  tokenIn: number,
): {
  piOut: number;
  avgPrice: number;
  nextPrice: number;
  fee: number;
  grossOut: number;
  feeBps: number;
} {
  if (tokenIn <= 0) {
    return {
      piOut: 0,
      avgPrice: 0,
      nextPrice: spotPrice(s),
      fee: 0,
      grossOut: 0,
      feeBps: OPENTOKEN_TRADE_FEE_BPS,
    };
  }
  const vPi = s.virtualPi + s.reservePi;
  const vTok = s.virtualTokens - s.supplySold;
  const k = vPi * vTok;
  const newVTok = vTok + tokenIn;
  const newVPi = k / newVTok;
  const grossOut = Math.min(vPi - newVPi, s.reservePi);
  const { fee, net: piOut, feeBps } = applyOpenTokenTradeFee(grossOut);
  const avgPrice = tokenIn > 0 ? piOut / tokenIn : 0;
  const nextPrice = newVTok > 0 ? newVPi / newVTok : 0;
  return { piOut, avgPrice, nextPrice, fee, grossOut, feeBps };
}

export function curveFromTokenRow(t: {
  curve_virtual_pi?: number | null;
  curve_virtual_tokens?: number | null;
  curve_reserve_pi?: number | null;
  curve_supply_sold?: number | null;
  total_supply?: number | null;
  graduation_target_pi?: number | null;
}): CurveState {
  return {
    virtualPi: Number(t.curve_virtual_pi ?? DEFAULT_VIRTUAL_PI),
    virtualTokens: Number(t.curve_virtual_tokens ?? DEFAULT_VIRTUAL_TOKENS),
    reservePi: Number(t.curve_reserve_pi ?? 0),
    supplySold: Number(t.curve_supply_sold ?? 0),
    totalSupply: Number(t.total_supply ?? DEFAULT_TOTAL_SUPPLY),
    graduationTargetPi: resolveGraduationTarget(t.graduation_target_pi),
  };
}

export const OT_CATEGORIES = [
  "meme",
  "ai",
  "gaming",
  "utility",
  "defi",
  "nft",
  "community",
] as const;

export type OtCategory = (typeof OT_CATEGORIES)[number];

export const OT_CATEGORY_LABELS: Record<OtCategory, string> = {
  meme: "Meme",
  ai: "AI",
  gaming: "Gaming",
  utility: "Utility",
  defi: "DeFi",
  nft: "NFT",
  community: "Community",
};
