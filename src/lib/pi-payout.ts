/** Shared constants for OUSD payouts to a Pi Network wallet (client-safe). */

export const PI_WALLET_RE = /^G[A-Z2-7]{55}$/;

export const PI_PAYOUT_MIN_OUSD = 10;
export const PI_PAYOUT_MAX_OUSD = 1_000_000;

export const PI_TRUSTLINE_MSG =
  "Add OpenUSD (OUSD) in Pi Wallet first: Tokens → enable OUSD issued by OpenPay, then try again.";

export function isValidPiWalletAddress(raw: string): boolean {
  return PI_WALLET_RE.test(String(raw || "").trim().toUpperCase().replace(/\s+/g, ""));
}

export function normalizePiWalletAddress(raw: string): string {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
}
