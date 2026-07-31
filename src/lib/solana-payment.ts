/**
 * Solana Commerce Kit / Payment Button config.
 * Docs: https://solana.com/docs/payments/accept-payments/payment-button
 */

export type SolanaPaymentNetwork = "mainnet" | "devnet" | "testnet";

export const SOLANA_MERCHANT_NAME =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_SOLANA_MERCHANT_NAME ?? "").trim()) ||
  "OpenPay Pro";

/** Platform / default recipient when a per-user Solana address is not provided. */
export const SOLANA_MERCHANT_WALLET =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_SOLANA_MERCHANT_WALLET ?? "").trim()) ||
  "";

export const SOLANA_PAYMENT_NETWORK: SolanaPaymentNetwork = (() => {
  const raw =
    (typeof import.meta !== "undefined" &&
      String(import.meta.env?.VITE_SOLANA_NETWORK ?? "").trim().toLowerCase()) ||
    "mainnet";
  if (raw === "devnet" || raw === "testnet") return raw;
  return "mainnet";
})();

export const SOLANA_RPC_URL =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_SOLANA_RPC_URL ?? "").trim()) ||
  undefined;

/**
 * Theme for Commerce Kit — Solana purple / mint (not a blank white panel).
 * Docs default primary is #9945FF; keep that brand language visible in light & dark app chrome.
 */
export const SOLANA_PAYMENT_THEME = {
  primaryColor: "#9945FF",
  secondaryColor: "#14F195",
  backgroundColor: "#F4F0FF",
  textColor: "#1A1430",
  borderRadius: "xl" as const,
  buttonShadow: "lg" as const,
  buttonBorder: "none" as const,
  fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
};

export function resolveSolanaMerchantWallet(wallet?: string | null): string {
  const trimmed = wallet?.trim();
  if (trimmed) return trimmed;
  return SOLANA_MERCHANT_WALLET;
}

export function isSolanaMerchantConfigured(wallet?: string | null): boolean {
  return resolveSolanaMerchantWallet(wallet).length > 0;
}

/** Mark body so CSS can raise commerce overlays above the mobile tabbar. */
export function setSolanaPayOpen(open: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("solana-pay-open", open);
}
