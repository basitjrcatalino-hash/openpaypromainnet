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
  user_id?: string;
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
  to?: string;
  status?: string;
  created_at?: string;
  direction?: "debit" | "credit" | string;
  counterparty_identifier?: string;
  counterparty_user_id?: string;
  note?: string;
  currency?: string;
  transaction_id?: string;
};

export type OpenPayTransferRow = OpenPayTransfer;

function cfg() {
  const key = (
    process.env.OPENPAY_PARTNER_API_KEY ||
    process.env.OPENPAY_API_KEY ||
    process.env.OPENPAY_TRANSFER_API_KEY ||
    ""
  )
    .trim()
    .replace(/^["']+|["']+$/g, "");
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

function normalizeAccount(raw: any): OpenPayAccount {
  const a = raw?.account && typeof raw.account === "object" ? raw.account : raw;
  if (!a || typeof a !== "object") return {};
  return {
    name: a.name ?? a.full_name ?? undefined,
    username: a.username ?? undefined,
    account_number: a.account_number ?? undefined,
    balance: typeof a.balance === "number" ? a.balance : undefined,
    currency: a.currency ?? undefined,
    email: a.email ?? undefined,
    user_id: a.user_id ?? undefined,
  };
}

function idsMatch(a: string | undefined, b: string): boolean {
  if (!a) return false;
  return a.replace(/^@+/, "").toLowerCase() === b.replace(/^@+/, "").toLowerCase();
}

export function isAmbiguousUsernameError(message: string): boolean {
  return /column reference ["']?username["']? is ambiguous/i.test(message);
}

/** Resolve by OP account number (reliable), else /me match, else /accounts. */
export async function resolvePartnerAccount(identifierRaw: string): Promise<OpenPayAccount> {
  const identifier = identifierRaw.trim().replace(/^@+/, "");
  if (!identifier) throw new Error("Missing OpenPay identifier");

  // OP account numbers work on the current partner API; @username/email hit a SQL bug.
  if (/^OP[A-Z0-9]+$/i.test(identifier)) {
    return normalizeAccount(await call(`/accounts/${encodeURIComponent(identifier)}`));
  }

  // Partner-key owner: /me always works — match username / email / account number.
  try {
    const me = normalizeAccount(await call(`/me`));
    if (
      idsMatch(me.username, identifier) ||
      idsMatch(me.email, identifier) ||
      idsMatch(me.account_number, identifier) ||
      idsMatch(me.user_id, identifier)
    ) {
      try {
        const bal = await call<{ balance: number; currency?: string }>(`/balance`);
        if (typeof bal.balance === "number") me.balance = bal.balance;
        if (bal.currency) me.currency = bal.currency;
      } catch {
        /* ignore */
      }
      return me;
    }
  } catch {
    /* continue to /accounts */
  }

  try {
    return normalizeAccount(await call(`/accounts/${encodeURIComponent(identifier)}`));
  } catch (e) {
    const msg = (e as Error).message || "";
    if (isAmbiguousUsernameError(msg)) {
      throw new Error(
        `OpenPay username lookup is temporarily unavailable. To send, use an OpenPay account number that starts with OP.`,
      );
    }
    throw e;
  }
}

export const openpayPro = {
  me: async () => normalizeAccount(await call(`/me`)),
  balance: () => call<{ balance: number; currency?: string }>(`/balance`),
  resolveAccount: (identifier: string) => resolvePartnerAccount(identifier),

  createCharge: async (body: {
    amount: number;
    currency?: string;
    description?: string;
    reference?: string;
    success_url: string;
    cancel_url: string;
  }) => {
    const charge = await call<OpenPayCharge>(`/charges`, {
      method: "POST",
      body: JSON.stringify({ currency: "OUSD", ...body }),
    });
    // Canonical PayButton host (openpay.lovable.app/paybutton 404s)
    if (charge?.id) {
      charge.checkout_url = `https://openpy.space/paybutton/${encodeURIComponent(charge.id)}`;
    }
    return charge;
  },

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

  listTransfers: async (opts?: { limit?: number; direction?: "credit" | "debit" }) => {
    const q = new URLSearchParams();
    if (opts?.limit) q.set("limit", String(opts.limit));
    if (opts?.direction) q.set("direction", opts.direction);
    const qs = q.toString();
    const body = await call<{ data?: OpenPayTransferRow[] } | OpenPayTransferRow[]>(
      `/transfers${qs ? `?${qs}` : ""}`,
    );
    return Array.isArray(body) ? body : (body.data ?? []);
  },
};
