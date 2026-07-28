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
  externalCustomerId?: string;
  externalTransactionId?: string;
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
  if (opts.externalCustomerId) {
    url.searchParams.set("externalCustomerId", opts.externalCustomerId);
  }
  if (opts.externalTransactionId) {
    url.searchParams.set("externalTransactionId", opts.externalTransactionId);
  }
  if (opts.signature) {
    url.searchParams.set("signature", opts.signature);
  }
  return url.toString();
}

/**
 * Request HMAC signature for a MoonPay widget URL (server uses MOONPAY_SECRET_KEY).
 * Returns undefined when signing is not configured — omit signature entirely (never "").
 */
export async function requestMoonPayUrlSignature(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `/api/public/moonpay-sign?url=${encodeURIComponent(url)}`,
    );
    if (!res.ok) return undefined;
    const body = (await res.json()) as { signature?: string | null; configured?: boolean };
    const sig = body.signature?.trim();
    return sig || undefined;
  } catch {
    return undefined;
  }
}
