/** OpenToken bonding curve — constant-product virtual reserves (original). */

export const DEFAULT_VIRTUAL_PI = 30;
export const DEFAULT_VIRTUAL_TOKENS = 1_073_000_191;
export const DEFAULT_GRADUATION_TARGET_PI = 100_000;
export const DEFAULT_TOTAL_SUPPLY = 1_000_000_000;
/** Launch fee charged in OUSD (1:1 with USD display balance). */
export const DEFAULT_LAUNCH_FEE_OUSD = 0.1;
/** @deprecated Use DEFAULT_LAUNCH_FEE_OUSD */
export const DEFAULT_LAUNCH_FEE_PI = DEFAULT_LAUNCH_FEE_OUSD;

export type CurveState = {
  virtualPi: number;
  virtualTokens: number;
  reservePi: number;
  supplySold: number;
  totalSupply: number;
  graduationTargetPi: number;
};

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

/** Tokens received for spending `piIn` Pi on the curve. */
export function quoteBuy(s: CurveState, piIn: number): { tokenOut: number; avgPrice: number; nextPrice: number } {
  if (piIn <= 0) return { tokenOut: 0, avgPrice: 0, nextPrice: spotPrice(s) };
  const vPi = s.virtualPi + s.reservePi;
  const vTok = s.virtualTokens - s.supplySold;
  const k = vPi * vTok;
  const newVPi = vPi + piIn;
  const newVTok = k / newVPi;
  const tokenOut = vTok - newVTok;
  const avgPrice = tokenOut > 0 ? piIn / tokenOut : 0;
  const nextPrice = newVTok > 0 ? newVPi / newVTok : 0;
  return { tokenOut, avgPrice, nextPrice };
}

/** Pi received for selling `tokenIn` tokens back to the curve. */
export function quoteSell(s: CurveState, tokenIn: number): { piOut: number; avgPrice: number; nextPrice: number } {
  if (tokenIn <= 0) return { piOut: 0, avgPrice: 0, nextPrice: spotPrice(s) };
  const vPi = s.virtualPi + s.reservePi;
  const vTok = s.virtualTokens - s.supplySold;
  const k = vPi * vTok;
  const newVTok = vTok + tokenIn;
  const newVPi = k / newVTok;
  const piOut = Math.min(vPi - newVPi, s.reservePi);
  const avgPrice = tokenIn > 0 ? piOut / tokenIn : 0;
  const nextPrice = newVTok > 0 ? newVPi / newVTok : 0;
  return { piOut, avgPrice, nextPrice };
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
    graduationTargetPi: (() => {
      const raw = Number(t.graduation_target_pi ?? DEFAULT_GRADUATION_TARGET_PI);
      // Legacy launches used 400 OUSD — treat as the new 100k target.
      return raw === 400 || raw <= 0 ? DEFAULT_GRADUATION_TARGET_PI : raw;
    })(),
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
