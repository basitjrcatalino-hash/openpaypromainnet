/** MoonPay public publishable key (test key from MoonPay dashboard). */
export const MOONPAY_API_KEY =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_MOONPAY_API_KEY ?? "").trim()) ||
  "pk_test_ptzaaiVrh9XuKiMQPFfmhVzma1oe8e";

export const MOONPAY_DEBUG =
  typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

export function moonPayEnvironment(
  apiKey: string = MOONPAY_API_KEY,
): "sandbox" | "production" {
  return apiKey.startsWith("pk_live") ? "production" : "sandbox";
}

/** Build an unsigned buy URL (no empty `signature=` — that triggers MoonPay's check failure). */
export function buildMoonPayBuyUrl(opts: {
  amount: string | number;
  baseCurrencyCode?: string;
  defaultCurrencyCode?: string;
  signature?: string;
}): string {
  const host =
    moonPayEnvironment() === "production"
      ? "https://buy.moonpay.com"
      : "https://buy-sandbox.moonpay.com";
  const url = new URL(host);
  url.searchParams.set("apiKey", MOONPAY_API_KEY);
  url.searchParams.set("baseCurrencyCode", opts.baseCurrencyCode || "usd");
  url.searchParams.set("baseCurrencyAmount", String(opts.amount));
  url.searchParams.set("defaultCurrencyCode", opts.defaultCurrencyCode || "eth");
  if (opts.signature) {
    url.searchParams.set("signature", opts.signature);
  }
  return url.toString();
}
