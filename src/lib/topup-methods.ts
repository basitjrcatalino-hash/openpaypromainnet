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
  | "circle_mint";

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
] as const;

export const TOPUP_METHOD_KEYS = TOPUP_METHOD_CATALOG.map((m) => m.method_key);
