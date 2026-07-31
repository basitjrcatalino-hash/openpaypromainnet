/**
 * Canonical Top Up payment methods.
 * Admin toggles visibility via `topup_methods.enabled` (hide during maintenance).
 */
export type TopupMethodKey =
  | "openpay_balance"
  | "moonpay"
  | "pi"
  | "usdc"
  | "helio"
  | "solana_pay"
  | "circle_mint"
  | "cash_pay"
  | "banxa_apple_pay"
  | "banxa_google_pay"
  | "banxa_card"
  | "banxa_bank"
  | "scan_pay";

export type TopupMethodSeed = {
  method_key: TopupMethodKey;
  label: string;
  description: string;
  sort_order: number;
  /** Default visibility when first inserted */
  enabled: boolean;
};

export const TOPUP_METHOD_CATALOG: readonly TopupMethodSeed[] = [
  {
    method_key: "openpay_balance",
    label: "OpenPay Balance",
    description: "Pay from your connected OpenPay account · real debit",
    sort_order: 1,
    enabled: true,
  },
  {
    method_key: "moonpay",
    label: "MoonPay",
    description: "Card / Apple Pay / Google Pay · MoonPay → OUSD",
    sort_order: 2,
    enabled: true,
  },
  {
    method_key: "pi",
    label: "Pi Network (π)",
    description: "Pay with Pi · live π price → OUSD ($1) credited instantly",
    sort_order: 3,
    enabled: true,
  },
  {
    method_key: "usdc",
    label: "USDC Pay",
    description: "Pay with USDC · MoonPay Commerce → OUSD",
    sort_order: 4,
    enabled: true,
  },
  {
    method_key: "helio",
    label: "Crypto Deposit",
    description: "SOL / crypto · MoonPay Commerce → OUSD",
    sort_order: 5,
    enabled: true,
  },
  {
    method_key: "solana_pay",
    label: "Solana Pay",
    description: "Commerce Kit · wallet connect, PaymentButton, Solana Pay QR → OUSD",
    sort_order: 6,
    enabled: true,
  },
  {
    method_key: "circle_mint",
    label: "Circle Deposit",
    description: "Circle Mint · USDC payin (payment intent + list payments) → OUSD",
    sort_order: 7,
    enabled: true,
  },
  {
    method_key: "cash_pay",
    label: "Pay with CASH",
    description:
      "Phantom CASH (Solana SPL) · ledger balance or Solana Pay QR → OUSD 1:1",
    sort_order: 8,
    enabled: true,
  },
  {
    method_key: "banxa_apple_pay",
    label: "Apple Pay",
    description:
      "Banxa · Apple Pay (Face ID / Touch ID) → crypto settle → OUSD",
    sort_order: 9,
    enabled: true,
  },
  {
    method_key: "banxa_google_pay",
    label: "Google Pay",
    description: "Banxa · Google Pay → crypto settle → OUSD",
    sort_order: 10,
    enabled: true,
  },
  {
    method_key: "banxa_card",
    label: "Card",
    description: "Banxa · debit / credit card → crypto settle → OUSD",
    sort_order: 11,
    enabled: true,
  },
  {
    method_key: "banxa_bank",
    label: "Bank Transfer",
    description:
      "Banxa · bank transfer (ACH / SEPA / Faster Payments / PayID) → OUSD",
    sort_order: 12,
    enabled: true,
  },
  {
    method_key: "scan_pay",
    label: "Scan to pay",
    description:
      "Multi-chain QR · SOL / USDC / USDT / CASH stables → verify TX → OUSD on OpenLedger",
    sort_order: 13,
    enabled: true,
  },
] as const;

export const TOPUP_METHOD_KEYS = TOPUP_METHOD_CATALOG.map((m) => m.method_key);

/** Banxa Hosted Checkout paymentMethodId values. */
export const BANXA_PAYMENT_METHOD_IDS = {
  banxa_apple_pay: "apple-pay",
  banxa_google_pay: "google-pay",
  banxa_card: "debit-credit-card",
  banxa_bank: "ach-bank-transfer",
} as const;

export type BanxaTopupMethodKey = keyof typeof BANXA_PAYMENT_METHOD_IDS;

export function isBanxaTopupMethod(id: string): id is BanxaTopupMethodKey {
  return id in BANXA_PAYMENT_METHOD_IDS;
}
