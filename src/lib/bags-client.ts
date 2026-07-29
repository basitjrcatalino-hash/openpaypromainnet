/**
 * Client-safe Bags helpers (no Solana / Buffer dependency).
 * Safe to import from route modules and SSR.
 */

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

export function bagsTokenUrl(mint: string): string {
  return `https://bags.fm/${mint}`;
}

const AGENT_KEY_STORAGE = "bags_agent_api_key";

export function getStoredBagsAgentKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(AGENT_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function storeBagsAgentKey(apiKey: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!apiKey) sessionStorage.removeItem(AGENT_KEY_STORAGE);
    else sessionStorage.setItem(AGENT_KEY_STORAGE, apiKey);
  } catch {
    /* ignore */
  }
}

/** 1 SOL in lamports — avoid importing @solana/web3.js just for this. */
export const LAMPORTS_PER_SOL = 1_000_000_000;
