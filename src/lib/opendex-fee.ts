/** OpenDEX platform swap fee in basis points (30 = 0.30%). */
export const OPENDEX_SWAP_FEE_BPS = 30;

export function opendexFeePct(feeBps = OPENDEX_SWAP_FEE_BPS) {
  return feeBps / 100;
}

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

/** Deduct platform fee from raw swap output. */
export function applyOpenDexFee(rawOut: number, feeBps = OPENDEX_SWAP_FEE_BPS) {
  if (!Number.isFinite(rawOut) || rawOut <= 0) {
    return { fee: 0, net: 0, feeBps };
  }
  const fee = round8((rawOut * feeBps) / 10_000);
  const net = round8(Math.max(0, rawOut - fee));
  return { fee, net, feeBps };
}
