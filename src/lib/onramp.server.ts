/**
 * Onramp.money — server-only config, widget URL building and order lookup.
 * Docs: https://docs.onramp.money/onramp/onramp-widget-integration/quick-start
 *
 * Env:
 *  ONRAMP_APP_ID              — appId from the Onramp merchant dashboard (required)
 *  ONRAMP_API_KEY             — API key (optional, for order status lookups)
 *  ONRAMP_API_SECRET          — API secret (optional, signing + status lookups)
 *  ONRAMP_SETTLEMENT_WALLET   — company address that receives the crypto
 *  ONRAMP_COIN_CODE           — default coin (usdt)
 *  ONRAMP_NETWORK             — default network id (0 = auto / dashboard default)
 *  ONRAMP_FIAT_TYPE           — default fiat type (see ONRAMP_FIAT_TYPES)
 *  ONRAMP_WEBHOOK_SECRET      — optional HMAC secret for webhook verification
 */
import { createHmac } from "crypto";

import { ONRAMP_WIDGET_BASE, type OnrampFlow } from "@/lib/onramp";

const API_BASE =
  process.env.ONRAMP_API_BASE?.trim() || "https://api.onramp.money/onramp/api/v2";

export type OnrampConfig = {
  appId: string;
  apiKey: string;
  apiSecret: string;
  settlementWallet: string;
  coinCode: string;
  network: string;
  fiatType: number;
  env: "production" | "sandbox";
};

export function getOnrampConfig(): OnrampConfig {
  return {
    appId: process.env.ONRAMP_APP_ID?.trim() || "",
    apiKey: process.env.ONRAMP_API_KEY?.trim() || "",
    apiSecret: process.env.ONRAMP_API_SECRET?.trim() || "",
    settlementWallet:
      process.env.ONRAMP_SETTLEMENT_WALLET?.trim() ||
      process.env.HELIO_RECIPIENT_WALLET?.trim() ||
      "",
    coinCode: (process.env.ONRAMP_COIN_CODE?.trim() || "usdt").toLowerCase(),
    network: process.env.ONRAMP_NETWORK?.trim() || "0",
    fiatType: Number(process.env.ONRAMP_FIAT_TYPE?.trim() || 1) || 1,
    env:
      process.env.ONRAMP_ENV?.trim() === "sandbox" ? "sandbox" : "production",
  };
}

export function onrampConfigured(): boolean {
  const c = getOnrampConfig();
  return Boolean(c.appId && c.settlementWallet);
}

export type BuildWidgetOptions = {
  flow: OnrampFlow;
  /** USD amount the user typed (used as coinAmount for USD-pegged coins). */
  amountUsd: number;
  merchantRecognitionId: string;
  /** Where Onramp returns the user after the flow. */
  redirectUrl?: string;
  /** Destination address override (offramp uses the user's own payout flow). */
  walletAddress?: string;
  coinCode?: string;
  network?: string;
  fiatType?: number;
};

/**
 * Builds the hosted Onramp / Offramp widget URL.
 * Onramp: user pays fiat, crypto settles to our settlement wallet → OUSD credit.
 * Offramp: user sells crypto for fiat payout.
 */
export function buildOnrampWidgetUrl(opts: BuildWidgetOptions): string {
  const cfg = getOnrampConfig();
  if (!cfg.appId) {
    throw new Error(
      "Onramp.money is not configured. Set ONRAMP_APP_ID (merchant dashboard → App ID).",
    );
  }
  const coinCode = (opts.coinCode || cfg.coinCode).toLowerCase();
  const address = opts.walletAddress || cfg.settlementWallet;
  if (opts.flow === "onramp" && !address) {
    throw new Error(
      "Onramp.money settlement wallet missing. Set ONRAMP_SETTLEMENT_WALLET.",
    );
  }

  const url = new URL(
    `${ONRAMP_WIDGET_BASE}/${opts.flow === "offramp" ? "sell" : "buy"}/`,
  );
  url.searchParams.set("appId", cfg.appId);
  if (address) url.searchParams.set("walletAddress", address);
  url.searchParams.set("coinCode", coinCode);
  const network = opts.network || cfg.network;
  if (network && network !== "0") url.searchParams.set("network", network);
  url.searchParams.set("fiatType", String(opts.fiatType || cfg.fiatType));
  url.searchParams.set("merchantRecognitionId", opts.merchantRecognitionId);
  // USD-pegged coin → request the exact coin amount so the user receives the
  // OUSD value they typed, regardless of local fiat currency.
  if (opts.amountUsd > 0 && /^(usdt|usdc|dai|fdusd|tusd)$/.test(coinCode)) {
    url.searchParams.set("coinAmount", String(opts.amountUsd));
  } else if (opts.amountUsd > 0) {
    url.searchParams.set("fiatAmount", String(opts.amountUsd));
  }
  if (opts.redirectUrl) url.searchParams.set("redirectUrl", opts.redirectUrl);
  return url.toString();
}

/** Onramp API auth: base64 payload + HMAC-SHA512 signature. */
function onrampAuthHeaders(body: Record<string, unknown>) {
  const cfg = getOnrampConfig();
  if (!cfg.apiKey || !cfg.apiSecret) {
    throw new Error(
      "Onramp API keys missing. Set ONRAMP_API_KEY and ONRAMP_API_SECRET.",
    );
  }
  const payload = Buffer.from(
    JSON.stringify({ timestamp: Date.now(), body }),
  ).toString("base64");
  const signature = createHmac("sha512", cfg.apiSecret)
    .update(payload)
    .digest("hex");
  return {
    "Content-Type": "application/json",
    apiKey: cfg.apiKey,
    payload,
    signature,
  } as Record<string, string>;
}

export function onrampApiConfigured(): boolean {
  const c = getOnrampConfig();
  return Boolean(c.apiKey && c.apiSecret);
}

export type OnrampOrderInfo = {
  orderId?: string | number;
  status?: string | number;
  merchantRecognitionId?: string;
  fiatAmount?: number;
  coinAmount?: number;
  coinCode?: string;
  raw?: unknown;
};

/** Look up a transaction by merchantRecognitionId (needs API keys). */
export async function fetchOnrampOrder(
  merchantRecognitionId: string,
): Promise<OnrampOrderInfo | null> {
  const body = { merchantRecognitionId };
  const res = await fetch(`${API_BASE}/whiteLabel/onramp/orderStatus`, {
    method: "POST",
    headers: onrampAuthHeaders(body),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) return null;
  const data =
    (parsed as { data?: Record<string, unknown> } | null)?.data ??
    (parsed as Record<string, unknown> | null) ??
    null;
  if (!data) return null;
  return {
    orderId: data["orderId"] as string | number | undefined,
    status: data["status"] as string | number | undefined,
    merchantRecognitionId,
    fiatAmount: Number(data["fiatAmount"] ?? 0) || undefined,
    coinAmount: Number(data["actualQuantity"] ?? data["coinAmount"] ?? 0) || undefined,
    coinCode: (data["coinCode"] as string | undefined) ?? undefined,
    raw: parsed,
  };
}

/** Onramp completed states: numeric 12/`COMPLETED` depending on payload. */
export function isOnrampOrderComplete(status: unknown): boolean {
  if (status == null) return false;
  const s = String(status).toLowerCase();
  return (
    s === "12" ||
    s === "completed" ||
    s === "complete" ||
    s === "success" ||
    s === "successful" ||
    s === "settled"
  );
}

/** Optional webhook HMAC verification (sha512 hex, falls back to sha256). */
export function verifyOnrampWebhook(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.ONRAMP_WEBHOOK_SECRET?.trim() || "";
  if (!secret) return true;
  if (!signature) return false;
  const given = signature.replace(/^sha(256|512)=/i, "").trim().toLowerCase();
  for (const algo of ["sha512", "sha256"] as const) {
    const expected = createHmac(algo, secret).update(rawBody).digest("hex");
    if (expected === given) return true;
  }
  return false;
}
