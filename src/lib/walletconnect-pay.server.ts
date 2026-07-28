/**
 * WalletConnect Pay Merchant API — server-only.
 * Auth: https://docs.walletconnect.com/api-reference/authentication
 * Never expose WALLETCONNECT_PAY_API_KEY to the browser (no VITE_ prefix).
 */

export const WALLETCONNECT_PAY_API_BASE =
  process.env.WALLETCONNECT_PAY_API_BASE?.trim() ||
  "https://api.pay.walletconnect.com";

export function getWalletConnectPayApiKey(): string {
  const key =
    process.env.WALLETCONNECT_PAY_API_KEY?.trim() ||
    process.env.WCP_API_KEY?.trim() ||
    "";
  if (!key) {
    throw new Error(
      "WalletConnect Pay API key is not configured (set WALLETCONNECT_PAY_API_KEY).",
    );
  }
  return key;
}

export type WcPayFetchOptions = {
  method?: string;
  path: string;
  body?: unknown;
  merchantId?: string;
  idempotencyKey?: string;
  headers?: Record<string, string>;
};

/** Authenticated request to WalletConnect Pay Merchant API (`Api-Key` header). */
export async function walletConnectPayFetch<T = unknown>(
  options: WcPayFetchOptions,
): Promise<{ ok: boolean; status: number; data: T }> {
  const apiKey = getWalletConnectPayApiKey();
  const path = options.path.startsWith("/") ? options.path : `/${options.path}`;
  const url = `${WALLETCONNECT_PAY_API_BASE.replace(/\/$/, "")}${path}`;

  const headers: Record<string, string> = {
    "Api-Key": apiKey,
    Accept: "application/json",
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.merchantId) {
    headers["Merchant-Id"] = options.merchantId;
  }
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  const res = await fetch(url, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data: T;
  try {
    data = (text ? JSON.parse(text) : {}) as T;
  } catch {
    data = { raw: text } as T;
  }

  return { ok: res.ok, status: res.status, data };
}
