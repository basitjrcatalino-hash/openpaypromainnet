/** PayPal top-up constants (client-safe). 1 OUSD = 1 USD. */
export const PAYPAL_MIN_USD = 1;
export const PAYPAL_MAX_USD = 10_000;

export type PaypalFundingMethod = "paypal" | "paylater" | "venmo" | "card";

export const PAYPAL_FUNDING: readonly {
  id: PaypalFundingMethod;
  label: string;
  source: string;
  hint: string;
}[] = [
  { id: "paypal", label: "PayPal", source: "paypal", hint: "Pay with your PayPal balance, bank or card" },
  { id: "paylater", label: "Pay Later", source: "paylater", hint: "Split into instalments where eligible" },
  { id: "venmo", label: "Venmo", source: "venmo", hint: "US buyers on mobile" },
  { id: "card", label: "Debit / credit card", source: "card", hint: "Guest checkout with a card" },
] as const;
