/** PayPal top-up constants (client-safe). 1 OUSD = 1 USD. */
export const PAYPAL_MIN_USD = 1;
export const PAYPAL_MAX_USD = 10_000;

export type PaypalFundingMethod = "paypal" | "card";

export const PAYPAL_FUNDING: readonly {
  id: PaypalFundingMethod;
  label: string;
  source: string;
  hint: string;
}[] = [
  { id: "paypal", label: "PayPal", source: "paypal", hint: "Pay with your PayPal balance, bank or card" },
  { id: "card", label: "Debit / credit card", source: "card", hint: "Guest checkout with a card" },
] as const;
