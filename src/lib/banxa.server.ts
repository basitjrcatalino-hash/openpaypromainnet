/**
 * Banxa Hosted Checkout — create buy orders for Apple Pay / Google Pay / Cards / Bank.
 * Docs:
 * - https://docs.banxa.com/products/hosted-checkout/docs/api-integration/create-buy-order
 * - https://docs.banxa.com/products/native-api/docs/guides/apple-pay
 * - https://docs.banxa.com/products/native-api/docs/guides/google-pay
 * - https://docs.banxa.com/products/native-api/docs/guides/cards
 * - https://docs.banxa.com/products/native-api/docs/guides/bank-transfer
 */

import {
  BANXA_PAYMENT_METHOD_IDS,
  type BanxaTopupMethodKey,
} from "@/lib/topup-methods";

export type BanxaEnv = "sandbox" | "production";

export function banxaConfigured(): boolean {
  return !!(
    process.env.BANXA_API_KEY?.trim() &&
    process.env.BANXA_PARTNER?.trim() &&
    process.env.BANXA_SETTLEMENT_WALLET?.trim()
  );
}

export function getBanxaConfig() {
  const apiKey = process.env.BANXA_API_KEY?.trim() || "";
  const partner = process.env.BANXA_PARTNER?.trim() || "";
  const settlementWallet = process.env.BANXA_SETTLEMENT_WALLET?.trim() || "";
  const env: BanxaEnv =
    process.env.BANXA_ENV?.trim()?.toLowerCase() === "production"
      ? "production"
      : "sandbox";
  const baseUrl =
    process.env.BANXA_BASE_URL?.trim() ||
    (env === "production"
      ? "https://api.banxa.com"
      : "https://api.banxa-sandbox.com");
  const fiat = (process.env.BANXA_FIAT?.trim() || "USD").toUpperCase();
  const crypto = (process.env.BANXA_CRYPTO?.trim() || "USDC").toUpperCase();
  const blockchain = (process.env.BANXA_BLOCKCHAIN?.trim() || "ETH").toUpperCase();
  const bankMethodId =
    process.env.BANXA_BANK_PAYMENT_METHOD_ID?.trim() ||
    bankMethodForFiat(fiat);

  return {
    apiKey,
    partner,
    settlementWallet,
    env,
    baseUrl,
    fiat,
    crypto,
    blockchain,
    bankMethodId,
  };
}

function bankMethodForFiat(fiat: string): string {
  switch (fiat) {
    case "EUR":
      return "sepa-bank-transfer";
    case "GBP":
      return "gbp-bank-transfer";
    case "AUD":
      return "payid-bank-transfer";
    case "USD":
    default:
      return "ach-bank-transfer";
  }
}

export function banxaPaymentMethodId(methodKey: BanxaTopupMethodKey): string {
  if (methodKey === "banxa_bank") {
    return getBanxaConfig().bankMethodId;
  }
  return BANXA_PAYMENT_METHOD_IDS[methodKey];
}

export type BanxaBuyOrderResponse = {
  checkoutUrl: string;
  id: string;
  externalOrderId?: string | null;
  externalCustomerId?: string | null;
  fiat?: string;
  fiatAmount?: string;
  crypto?: string;
  cryptoAmount?: string;
  blockchain?: string;
};

export async function createBanxaBuyOrder(opts: {
  paymentMethodId: string;
  fiatAmount: number;
  externalCustomerId: string;
  externalOrderId: string;
  redirectUrl: string;
  email?: string | null;
  walletAddress?: string;
}): Promise<BanxaBuyOrderResponse> {
  const cfg = getBanxaConfig();
  if (!cfg.apiKey || !cfg.partner || !cfg.settlementWallet) {
    throw new Error(
      "Banxa is not configured. Set BANXA_API_KEY, BANXA_PARTNER, and BANXA_SETTLEMENT_WALLET.",
    );
  }

  const walletAddress = opts.walletAddress?.trim() || cfg.settlementWallet;
  const body: Record<string, string> = {
    crypto: cfg.crypto,
    blockchain: cfg.blockchain,
    fiat: cfg.fiat,
    fiatAmount: opts.fiatAmount.toFixed(2),
    walletAddress,
    redirectUrl: opts.redirectUrl,
    paymentMethodId: opts.paymentMethodId,
    externalCustomerId: opts.externalCustomerId,
    externalOrderId: opts.externalOrderId,
  };
  if (opts.email) body.email = opts.email;

  const url = `${cfg.baseUrl}/${cfg.partner}/v2/buy`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: BanxaBuyOrderResponse & { message?: string; error?: string };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`Banxa buy failed (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok || !json.checkoutUrl || !json.id) {
    throw new Error(
      json.message ||
        json.error ||
        `Banxa buy failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }

  return json;
}

export async function fetchBanxaOrder(orderId: string): Promise<{
  id: string;
  status?: string;
  externalId?: string | null;
  externalCustomerId?: string | null;
  fiatAmount?: string;
  cryptoAmount?: string;
  fiat?: string;
  paymentMethodId?: string;
}> {
  const cfg = getBanxaConfig();
  if (!cfg.apiKey || !cfg.partner) {
    throw new Error("Banxa is not configured");
  }
  const url = `${cfg.baseUrl}/${cfg.partner}/v2/orders/${encodeURIComponent(orderId)}`;
  const res = await fetch(url, {
    headers: {
      "x-api-key": cfg.apiKey,
      accept: "application/json",
    },
  });
  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Banxa order lookup failed (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(
      String(json.message || json.error || `Banxa order lookup failed (${res.status})`),
    );
  }
  return {
    id: String(json.id ?? orderId),
    status: json.status != null ? String(json.status) : undefined,
    externalId:
      json.externalId != null
        ? String(json.externalId)
        : json.external_id != null
          ? String(json.external_id)
          : null,
    externalCustomerId:
      json.externalCustomerId != null
        ? String(json.externalCustomerId)
        : null,
    fiatAmount:
      json.fiatAmount != null
        ? String(json.fiatAmount)
        : json.fiat_amount != null
          ? String(json.fiat_amount)
          : undefined,
    cryptoAmount:
      json.cryptoAmount != null
        ? String(json.cryptoAmount)
        : json.crypto_amount != null
          ? String(json.crypto_amount)
          : undefined,
    fiat: json.fiat != null ? String(json.fiat) : undefined,
    paymentMethodId:
      json.paymentMethodId != null
        ? String(json.paymentMethodId)
        : json.payment_method != null
          ? String(json.payment_method)
          : undefined,
  };
}

export function isBanxaOrderComplete(status: string | undefined | null): boolean {
  const s = String(status || "").toLowerCase().replace(/[_\s]/g, "");
  return s === "complete" || s === "completed";
}
