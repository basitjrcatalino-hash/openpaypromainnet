/**
 * Onramp.money shared (client-safe) constants.
 * Docs:
 * - User flow: https://docs.onramp.money/onramp/user-flow
 * - Onramp widget quick start: https://docs.onramp.money/onramp/onramp-widget-integration/quick-start
 * - Offramp widget user flow: https://docs.onramp.money/onramp/offramp-widget-integration/user-flow
 */

export type OnrampFlow = "onramp" | "offramp";

export const ONRAMP_WIDGET_BASE = "https://onramp.money/main";

/** Fiat types supported by the Onramp widget (`fiatType`). */
export const ONRAMP_FIAT_TYPES: Record<number, string> = {
  1: "INR",
  2: "TRY",
  3: "AED",
  4: "MXN",
  5: "VND",
  6: "NGN",
  7: "BRL",
  8: "IDR",
  9: "PHP",
  10: "EUR",
  11: "GBP",
};

export function onrampFiatLabel(fiatType: number): string {
  return ONRAMP_FIAT_TYPES[fiatType] ?? `Fiat #${fiatType}`;
}

/** merchantRecognitionId encodes the wallet so webhooks can credit OUSD. */
export function buildOnrampMerchantId(walletId: string): string {
  return `ousd_${walletId}_${Date.now()}`;
}

export function parseWalletIdFromOnrampMerchantId(
  merchantId: string | null | undefined,
): string | null {
  const m = /^ousd_([0-9a-f-]{36})_/i.exec(String(merchantId ?? ""));
  return m?.[1] ?? null;
}
