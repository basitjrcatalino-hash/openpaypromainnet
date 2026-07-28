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
 * Theme for Commerce Kit.
 * Prefer a light panel so QR / amounts stay readable on mobile (dark overlay was blank).
 */
export const SOLANA_PAYMENT_THEME = {
  primaryColor: "#7C3AED",
  secondaryColor: "#14F195",
  backgroundColor: "#ffffff",
  textColor: "#0f172a",
  borderRadius: "xl" as const,
  buttonShadow: "md" as const,
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
