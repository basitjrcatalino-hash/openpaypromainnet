import type { HelioDepositProduct } from "@/lib/helio-deposit";

/**
 * MoonPay Commerce (Helio) Deposit — create/reuse deposit customers.
 * Docs: https://docs.hel.io/reference/deposit-customers/create
 *
 * Products:
 * - crypto — multi-asset deposit (SOL / USDC / …)
 * - usdc   — USDC-focused deposit
 */

export type { HelioDepositProduct };

export type HelioDepositProductConfig = {
  id: HelioDepositProduct;
  depositId: string;
  recipientWallet: string;
  /** Shared dashboard token used when API keys are unset */
  fallbackToken: string | null;
  label: string;
};

const RECIPIENT_DEFAULT =
  process.env.HELIO_RECIPIENT_WALLET?.trim() ||
  "FX8VyDp7SMbnUpn6D1KbjSvQv9VBybQ2cchHrSE4dReR";

export const HELIO_PRODUCTS: Record<HelioDepositProduct, HelioDepositProductConfig> = {
  crypto: {
    id: "crypto",
    depositId:
      process.env.HELIO_DEPOSIT_ID?.trim() || "6a6ac63aec05a9b4c060e59b",
    recipientWallet: RECIPIENT_DEFAULT,
    fallbackToken:
      process.env.HELIO_DEPOSIT_CUSTOMER_TOKEN?.trim() ||
      process.env.VITE_HELIO_DEPOSIT_CUSTOMER_TOKEN?.trim() ||
      "f23d57b0-5671-4253-8252-06cb174b92c8",
    label: "Crypto Deposit",
  },
  usdc: {
    id: "usdc",
    depositId:
      process.env.HELIO_USDC_DEPOSIT_ID?.trim() || "6a6ac77cec05a9b4c060eaca",
    recipientWallet:
      process.env.HELIO_USDC_RECIPIENT_WALLET?.trim() || RECIPIENT_DEFAULT,
    fallbackToken:
      process.env.HELIO_USDC_DEPOSIT_CUSTOMER_TOKEN?.trim() ||
      process.env.VITE_HELIO_USDC_DEPOSIT_CUSTOMER_TOKEN?.trim() ||
      "281e8bdb-a020-44cc-9fe3-2a7e844ac9a3",
    label: "USDC Pay",
  },
};

/** @deprecated use HELIO_PRODUCTS.crypto.depositId */
export const HELIO_DEPOSIT_ID = HELIO_PRODUCTS.crypto.depositId;
/** @deprecated use HELIO_PRODUCTS.crypto.recipientWallet */
export const HELIO_RECIPIENT_WALLET = HELIO_PRODUCTS.crypto.recipientWallet;

/** Merchant brand prefix for Helio `customerId` (unique per OpenPay user). */
export const HELIO_CUSTOMER_PREFIX = "OPENPAY-PRO";

const HELIO_API_BASE =
  process.env.HELIO_API_BASE?.trim() || "https://api.hel.io/v1";

export function getHelioProduct(
  product: HelioDepositProduct = "crypto",
): HelioDepositProductConfig {
  return HELIO_PRODUCTS[product] ?? HELIO_PRODUCTS.crypto;
}

export function isKnownHelioDepositId(depositId: string | undefined | null): boolean {
  if (!depositId) return true;
  const id = String(depositId);
  return Object.values(HELIO_PRODUCTS).some(
    (p) => id === p.depositId || id.includes(p.depositId),
  );
}

export function helioCustomerIdForUser(userId: string): string {
  return `${HELIO_CUSTOMER_PREFIX}-${userId}`;
}

export function parseUserIdFromHelioCustomerId(customerId: string): string | null {
  const id = String(customerId || "").trim();
  if (!id) return null;
  const prefix = `${HELIO_CUSTOMER_PREFIX}-`;
  if (id.startsWith(prefix)) return id.slice(prefix.length) || null;
  // Shared dashboard customer used wallet address as customerId — not mappable
  if (/^OPENPAY[\s_-]*PRO$/i.test(id)) return null;
  return null;
}

function helioKeys() {
  const apiKey =
    process.env.HELIO_API_KEY?.trim() ||
    process.env.HELIO_PUBLIC_KEY?.trim() ||
    "";
  const secret =
    process.env.HELIO_SECRET_KEY?.trim() ||
    process.env.HELIO_API_SECRET?.trim() ||
    "";
  return { apiKey, secret };
}

export function isHelioDepositApiConfigured(): boolean {
  const { apiKey, secret } = helioKeys();
  return Boolean(apiKey && secret);
}

/** Shared deposit-customer token from dashboard (widget-only fallback). */
export function helioFallbackDepositCustomerToken(
  product: HelioDepositProduct = "crypto",
): string | null {
  return getHelioProduct(product).fallbackToken;
}

type HelioCustomerPayload = {
  id?: string;
  token?: string;
  customerId?: string;
  deposit?: string | { id?: string };
  recipientPublicKeys?: string[];
  disabled?: boolean;
};

function extractToken(body: unknown): string | null {
  if (!body) return null;
  if (Array.isArray(body)) {
    for (const item of body) {
      const t = extractToken(item);
      if (t) return t;
    }
    return null;
  }
  if (typeof body === "object") {
    const o = body as HelioCustomerPayload;
    if (typeof o.token === "string" && o.token.trim()) return o.token.trim();
  }
  return null;
}

async function helioFetch(path: string, init?: RequestInit): Promise<Response> {
  const { apiKey, secret } = helioKeys();
  if (!apiKey || !secret) {
    throw new Error(
      "Helio API not configured. Set HELIO_API_KEY and HELIO_SECRET_KEY from moonpay.hel.io → Settings.",
    );
  }
  const url = new URL(`${HELIO_API_BASE}${path}`);
  url.searchParams.set("apiKey", apiKey);
  return fetch(url.toString(), {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
      ...(init?.headers ?? {}),
    },
  });
}

async function getCustomerById(
  depositId: string,
  customerId: string,
): Promise<string | null> {
  const res = await helioFetch(
    `/deposits/${encodeURIComponent(depositId)}/customer/${encodeURIComponent(customerId)}/api-key`,
  );
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return extractToken(body);
}

/**
 * Create or reuse a Helio deposit customer for this OpenPay user + product.
 * Returns `depositCustomerToken` for `MoonpayCommerceDeposit`.
 */
export async function getOrCreateHelioDepositCustomer(opts: {
  userId: string;
  product?: HelioDepositProduct;
  defaultOnrampAmount?: number;
  customerEmail?: string | null;
}): Promise<{
  depositCustomerToken: string;
  customerId: string;
  depositId: string;
  product: HelioDepositProduct;
  reused: boolean;
}> {
  const product = opts.product ?? "crypto";
  const cfg = getHelioProduct(product);
  const customerId = helioCustomerIdForUser(opts.userId);
  const depositId = cfg.depositId;

  const existing = await getCustomerById(depositId, customerId);
  if (existing) {
    return {
      depositCustomerToken: existing,
      customerId,
      depositId,
      product,
      reused: true,
    };
  }

  const body: Record<string, unknown> = {
    customerId,
    depositId,
    recipientPublicKeys: [cfg.recipientWallet],
    additionalJSON: JSON.stringify({
      openpay_user_id: opts.userId,
      brand: "OPENPAY PRO",
      product,
    }),
  };

  if (
    typeof opts.defaultOnrampAmount === "number" &&
    Number.isFinite(opts.defaultOnrampAmount) &&
    opts.defaultOnrampAmount >= 1
  ) {
    body.defaultOnrampAmount = Math.round(opts.defaultOnrampAmount);
  }
  if (opts.customerEmail?.trim()) {
    body.customerEmail = opts.customerEmail.trim();
  }

  const res = await helioFetch("/deposit-customers/api-key", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const again = await getCustomerById(depositId, customerId);
    if (again) {
      return {
        depositCustomerToken: again,
        customerId,
        depositId,
        product,
        reused: true,
      };
    }
    const msg =
      (parsed as { message?: string } | null)?.message ||
      raw.slice(0, 240) ||
      `Helio create customer failed (${res.status})`;
    throw new Error(msg);
  }

  const token = extractToken(parsed);
  if (!token) {
    throw new Error("Helio create customer returned no deposit customer token");
  }

  return {
    depositCustomerToken: token,
    customerId,
    depositId,
    product,
    reused: false,
  };
}

/**
 * Resolve a widget token: prefer per-user create/get, else shared env token.
 */
export async function resolveHelioDepositCustomerToken(opts: {
  userId: string;
  product?: HelioDepositProduct;
  defaultOnrampAmount?: number;
  customerEmail?: string | null;
}): Promise<{
  depositCustomerToken: string;
  customerId: string | null;
  depositId: string;
  product: HelioDepositProduct;
  mode: "api" | "fallback";
}> {
  const product = opts.product ?? "crypto";
  const cfg = getHelioProduct(product);

  if (isHelioDepositApiConfigured()) {
    const r = await getOrCreateHelioDepositCustomer({ ...opts, product });
    return {
      depositCustomerToken: r.depositCustomerToken,
      customerId: r.customerId,
      depositId: r.depositId,
      product,
      mode: "api",
    };
  }

  if (cfg.fallbackToken) {
    return {
      depositCustomerToken: cfg.fallbackToken,
      customerId: null,
      depositId: cfg.depositId,
      product,
      mode: "fallback",
    };
  }

  throw new Error(
    `Helio ${cfg.label} not configured. Set HELIO_API_KEY + HELIO_SECRET_KEY, or a fallback deposit customer token.`,
  );
}
