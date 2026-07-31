/**
 * Circle Mint Payments API (server-only).
 *
 * Docs:
 * - List payments: https://developers.circle.com/api-reference/circle-mint/payments/list-payments
 * - Create payment intent: https://developers.circle.com/api-reference/circle-mint/payments/create-payment-intent
 * - Receive stablecoin payin: https://developers.circle.com/circle-mint/howtos/receive-stablecoin-payin
 *
 * Uses CIRCLE_API_KEY against Circle Mint REST (sandbox or production).
 * Separate from Programmable Wallets (@circle-fin/developer-controlled-wallets).
 */

import { getCircleApiKey, getCircleBaseUrl, isCircleTestnet } from "@/lib/circle";

export type CircleMoney = { amount: string; currency: string };

export type CirclePaymentMethod = {
  type: string;
  chain?: string;
  address?: string;
};

export type CirclePaymentIntent = {
  id: string;
  type?: string;
  amount?: CircleMoney;
  amountPaid?: CircleMoney;
  settlementCurrency?: string;
  currency?: string;
  paymentMethods?: CirclePaymentMethod[];
  paymentIds?: string[];
  timeline?: Array<{ status?: string; time?: string }>;
  expiresOn?: string;
  createDate?: string;
  updateDate?: string;
  customerExternalRef?: string;
  purposeOfTransfer?: string;
};

export type CircleCryptoPayment = {
  id: string;
  type?: string;
  status?: string;
  amount?: CircleMoney;
  fees?: CircleMoney;
  merchantId?: string;
  merchantWalletId?: string;
  paymentIntentId?: string;
  settlementAmount?: CircleMoney;
  depositAddress?: { chain?: string; address?: string };
  fromAddresses?: { chain?: string; addresses?: string[] };
  transactionHash?: string;
  createDate?: string;
  updateDate?: string;
};

export function isCircleMintConfigured(): boolean {
  return Boolean(getCircleApiKey());
}

export function getCircleMintMerchantWalletId(): string {
  return (process.env.CIRCLE_MINT_MERCHANT_WALLET_ID || "").trim();
}

export function getCircleMintChain(): string {
  return (process.env.CIRCLE_MINT_CHAIN || "ETH").trim().toUpperCase();
}

export function getCircleMintPurposeOfTransfer(): string | undefined {
  const v = (process.env.CIRCLE_PURPOSE_OF_TRANSFER || "").trim();
  return v || undefined;
}

function mintBaseUrl(): string {
  const explicit = process.env.CIRCLE_MINT_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (isCircleTestnet() || getCircleBaseUrl().includes("sandbox")) {
    return "https://api-sandbox.circle.com";
  }
  const base = getCircleBaseUrl();
  if (base.includes("api.circle.com") || base.includes("api-sandbox")) return base;
  return "https://api.circle.com";
}

async function circleMintFetch<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined | null> },
): Promise<T> {
  const apiKey = getCircleApiKey();
  if (!apiKey) throw new Error("CIRCLE_API_KEY is not configured for Circle Mint");

  const url = new URL(path.startsWith("http") ? path : `${mintBaseUrl()}${path}`);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v == null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }

  const { query: _q, ...rest } = init ?? {};
  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(rest.headers || {}),
    },
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg =
      (json as { message?: string; error?: string })?.message ||
      (json as { error?: string })?.error ||
      `Circle Mint HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json as T;
}

/** GET /v1/payments — https://developers.circle.com/api-reference/circle-mint/payments/list-payments */
export async function listCirclePayments(params: {
  paymentIntentId?: string;
  status?: string;
  from?: string;
  to?: string;
  pageSize?: number;
  pageAfter?: string;
  pageBefore?: string;
  type?: string;
} = {}): Promise<CircleCryptoPayment[]> {
  const res = await circleMintFetch<{ data?: CircleCryptoPayment[] }>("/v1/payments", {
    method: "GET",
    query: {
      paymentIntentId: params.paymentIntentId,
      status: params.status,
      from: params.from,
      to: params.to,
      pageSize: params.pageSize ?? 50,
      pageAfter: params.pageAfter,
      pageBefore: params.pageBefore,
      type: params.type,
    },
  });
  return Array.isArray(res.data) ? res.data : [];
}

/** GET /v1/payments/{id} */
export async function getCirclePayment(paymentId: string): Promise<CircleCryptoPayment> {
  const res = await circleMintFetch<{ data: CircleCryptoPayment }>(
    `/v1/payments/${encodeURIComponent(paymentId)}`,
    { method: "GET" },
  );
  if (!res.data?.id) throw new Error("Circle payment not found");
  return res.data;
}

/** GET /v1/paymentIntents/{id} */
export async function getCirclePaymentIntent(
  paymentIntentId: string,
): Promise<CirclePaymentIntent> {
  const res = await circleMintFetch<{ data: CirclePaymentIntent }>(
    `/v1/paymentIntents/${encodeURIComponent(paymentIntentId)}`,
    { method: "GET" },
  );
  if (!res.data?.id) throw new Error("Circle payment intent not found");
  return res.data;
}

export type CreateTransientIntentInput = {
  idempotencyKey: string;
  amountUsd: number;
  chain?: string;
  customerExternalRef?: string;
};

/** POST /v1/paymentIntents — transient fixed-amount payin */
export async function createTransientPaymentIntent(
  input: CreateTransientIntentInput,
): Promise<CirclePaymentIntent> {
  const amount = Math.round(input.amountUsd * 100) / 100;
  if (!(amount >= 0.01)) throw new Error("Amount must be at least $0.01");

  const chain = (input.chain || getCircleMintChain()).toUpperCase();
  const merchantWalletId = getCircleMintMerchantWalletId();
  const purposeOfTransfer = getCircleMintPurposeOfTransfer();

  const body: Record<string, unknown> = {
    idempotencyKey: input.idempotencyKey,
    type: "transient",
    amount: {
      amount: amount.toFixed(2),
      currency: "USD",
    },
    settlementCurrency: "USD",
    paymentMethods: [
      {
        type: "blockchain",
        chain,
      },
    ],
  };

  if (merchantWalletId) body.merchantWalletId = merchantWalletId;
  if (purposeOfTransfer) body.purposeOfTransfer = purposeOfTransfer;
  if (input.customerExternalRef) {
    body.customerExternalRef = input.customerExternalRef;
  }

  const res = await circleMintFetch<{ data: CirclePaymentIntent }>("/v1/paymentIntents", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.data?.id) throw new Error("Circle createPaymentIntent returned no id");
  return res.data;
}

export function extractDepositAddress(
  intent: CirclePaymentIntent,
): { chain: string; address: string } | null {
  const method = intent.paymentMethods?.find(
    (m) => m.type === "blockchain" && m.address,
  );
  if (!method?.address) return null;
  return {
    chain: String(method.chain || getCircleMintChain()).toUpperCase(),
    address: method.address,
  };
}

export function latestIntentStatus(intent: CirclePaymentIntent): string {
  const timeline = intent.timeline || [];
  const last = timeline[timeline.length - 1];
  return String(last?.status || "created").toLowerCase();
}

export function paymentUsdAmount(p: CircleCryptoPayment): number {
  const raw =
    p.settlementAmount?.amount ??
    p.amount?.amount ??
    "0";
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function isPaymentSettled(p: CircleCryptoPayment): boolean {
  const s = String(p.status || "").toLowerCase();
  return s === "paid" || s === "confirmed";
}
