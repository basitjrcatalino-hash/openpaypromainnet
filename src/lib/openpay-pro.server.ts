// OpenPay Pro Partner Transfer API — server-only client.
// Do NOT import this file from route/component modules directly.

const DEFAULT_BASE = "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api";

export type OpenPayAccount = {
  name?: string;
  username?: string;
  account_number?: string;
  balance?: number;
  currency?: string;
  email?: string;
};

export type OpenPayCharge = {
  id: string;
  amount: number;
  currency: string;
  status: "created" | "paid" | "canceled" | "expired";
  checkout_url: string;
  expires_at?: string;
  reference?: string;
  description?: string;
};

export type OpenPayTransfer = {
  id?: string;
  amount: number;
  to: string;
  status?: string;
  created_at?: string;
};

function cfg() {
  const key =
    process.env.OPENPAY_PARTNER_API_KEY ||
    process.env.OPENPAY_API_KEY ||
    process.env.OPENPAY_TRANSFER_API_KEY;
  const base = process.env.OPENPAY_PARTNER_API_BASE || process.env.OPENPAY_API_BASE || DEFAULT_BASE;
  if (!key) throw new Error("OPENPAY_PARTNER_API_KEY not configured");
  return { key, base };
}

async function call<T>(
  path: string,
  init: RequestInit = {},
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const { key, base } = cfg();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...extraHeaders,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = body?.error || body?.message || `OpenPay ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : `OpenPay ${res.status}`);
  }
  return body as T;
}

export const openpayPro = {
  me: () => call<OpenPayAccount>(`/me`),
  balance: () => call<{ balance: number; currency?: string }>(`/balance`),
  resolveAccount: (identifier: string) =>
    call<OpenPayAccount>(`/accounts/${encodeURIComponent(identifier)}`),

  createCharge: (body: {
    amount: number;
    currency?: string;
    description?: string;
    reference?: string;
    success_url: string;
    cancel_url: string;
  }) =>
    call<OpenPayCharge>(`/charges`, {
      method: "POST",
      body: JSON.stringify({ currency: "OUSD", ...body }),
    }),

  getCharge: (id: string) => call<OpenPayCharge>(`/charges/${encodeURIComponent(id)}`),

  cancelCharge: (id: string) =>
    call<OpenPayCharge>(`/charges/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
    }),

  sendTransfer: (body: { to: string; amount: number; note?: string }, idempotencyKey?: string) =>
    call<OpenPayTransfer>(
      `/transfers`,
      { method: "POST", body: JSON.stringify(body) },
      idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    ),
};
