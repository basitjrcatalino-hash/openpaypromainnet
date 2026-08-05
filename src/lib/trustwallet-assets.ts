/**
 * Map OpenPay Pro majors → Trust Wallet asset IDs (c{coinId} / c{coinId}_t{addr}).
 * No secrets — safe for shared imports. Used by price enrichment + API proxies.
 *
 * Asset ID format: https://github.com/trustwallet/tw-agent-skills (setup)
 */

import type { MajorTokenId } from "@/lib/major-tokens";
import { MAJOR_TOKENS } from "@/lib/major-tokens";

/** SLIP-44 / Trust Wallet coin IDs for native majors. */
export const TW_NATIVE_COIN_ID: Partial<Record<MajorTokenId, number>> = {
  btc: 0,
  ltc: 2,
  doge: 3,
  dash: 5,
  zec: 133,
  bch: 145,
  xrp: 144,
  xlm: 148,
  eth: 60,
  etc: 61,
  trx: 195,
  sol: 501,
  atom: 118,
  near: 397,
  fil: 461,
  icp: 223,
  vet: 818,
  theta: 500,
  algo: 283,
  ada: 1815,
  dot: 354,
  bnb: 714,
  avax: 10009000,
  sui: 784,
  apt: 637,
  gram: 607, // TON / OpenPay GRAM
  pol: 966, // Polygon (legacy MATIC coin id)
  arb: 10042221,
  op: 10000070,
  egld: 508,
  rune: 931,
  kava: 459,
};

/** Prefer Ethereum (60) when major has an ERC-20 contract. */
function tokenAssetId(coinId: number, address: string): string {
  return `c${coinId}_t${address}`;
}

/**
 * Resolve Trust Wallet asset ID for a catalog major, when known.
 * Returns null for assets TW cannot price (e.g. PI, custom ledger-only).
 */
export function trustWalletAssetIdForMajor(id: MajorTokenId): string | null {
  const def = MAJOR_TOKENS[id];
  if (!def) return null;

  // Solana SPL
  if (def.mintAddress) {
    return tokenAssetId(501, def.mintAddress);
  }

  // EVM contract — assume Ethereum unless network says otherwise
  if (def.contractAddress) {
    const net = (def.network || "").toLowerCase();
    let coin = 60;
    if (net.includes("bnb") || net.includes("bsc")) coin = 714;
    else if (net.includes("polygon") || net.includes("matic")) coin = 966;
    else if (net.includes("arbitrum")) coin = 10042221;
    else if (net.includes("optimism")) coin = 10000070;
    else if (net.includes("avalanche") || net.includes("avax")) coin = 10009000;
    else if (net.includes("base")) coin = 10008453;
    return tokenAssetId(coin, def.contractAddress);
  }

  const native = TW_NATIVE_COIN_ID[id];
  if (typeof native === "number") return `c${native}`;

  // Native flag with known coin
  if (def.native) {
    const n = TW_NATIVE_COIN_ID[id];
    if (typeof n === "number") return `c${n}`;
  }

  return null;
}

/** Batch map majors → TW asset IDs (skips unknowns). */
export function trustWalletAssetIdsForMajors(
  ids: MajorTokenId[],
): { assetId: string; majorId: MajorTokenId }[] {
  const out: { assetId: string; majorId: MajorTokenId }[] = [];
  for (const id of ids) {
    const assetId = trustWalletAssetIdForMajor(id);
    if (assetId) out.push({ assetId, majorId: id });
  }
  return out;
}
