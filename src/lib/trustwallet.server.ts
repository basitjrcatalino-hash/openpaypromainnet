/**
 * Trust Wallet API (tws.trustwallet.com) — server-only HMAC client.
 * Docs: https://portal.trustwallet.com/dashboard/docs
 * Skills: https://github.com/trustwallet/tw-agent-skills
 *
 * Env (never VITE_):
 *   TW_ACCESS_ID / TWAK_ACCESS_ID
 *   TW_HMAC_SECRET / TWAK_HMAC_SECRET
 */

import { createHmac, randomUUID } from "node:crypto";

export const TRUST_WALLET_API_BASE =
  process.env.TW_API_BASE?.trim() ||
  process.env.TRUST_WALLET_API_BASE?.trim() ||
  "https://tws.trustwallet.com";

export function getTrustWalletCredentials(): {
  accessId: string;
  hmacSecret: string;
} | null {
  const accessId =
    process.env.TW_ACCESS_ID?.trim() ||
    process.env.TWAK_ACCESS_ID?.trim() ||
    process.env.TRUST_WALLET_ACCESS_ID?.trim() ||
    "";
  const hmacSecret =
    process.env.TW_HMAC_SECRET?.trim() ||
    process.env.TWAK_HMAC_SECRET?.trim() ||
    process.env.TRUST_WALLET_HMAC_SECRET?.trim() ||
    "";
  if (!accessId || !hmacSecret) return null;
  return { accessId, hmacSecret };
}

export function trustWalletConfigured(): boolean {
  return getTrustWalletCredentials() != null;
}

function signHeaders(
  method: string,
  path: string,
  query: string,
  accessId: string,
  hmacSecret: string,
): Record<string, string> {
  const date = new Date().toUTCString();
  const nonce = randomUUID();

  const sortedQuery = query
    ? [...new URLSearchParams(query).entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => `${k}=${v}`)
        .join("&")
    : "";

  const plaintext = [
    method.toUpperCase(),
    path,
    sortedQuery,
    accessId,
    nonce,
    date,
  ].join(";");

  const signature = createHmac("sha256", hmacSecret)
    .update(plaintext)
    .digest("base64");

  return {
    "X-TW-CREDENTIAL": accessId,
    "X-TW-NONCE": nonce,
    "X-TW-DATE": date,
    Authorization: `HMAC-SHA256 Signature=${signature}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export type TrustWalletFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Path only, e.g. `/v2/market/tickers` */
  path: string;
  /** Raw query string without `?`, or Record of params */
  query?: string | Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
};

function normalizeQuery(
  query?: TrustWalletFetchOptions["query"],
): string {
  if (!query) return "";
  if (typeof query === "string") {
    return query.replace(/^\?/, "");
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  return params.toString();
}

/** Authenticated request to Trust Wallet REST API. */
export async function trustWalletFetch<T = unknown>(
  options: TrustWalletFetchOptions,
): Promise<{ ok: boolean; status: number; data: T; error?: string }> {
  const creds = getTrustWalletCredentials();
  if (!creds) {
    return {
      ok: false,
      status: 503,
      data: {} as T,
      error:
        "Trust Wallet API is not configured (set TW_ACCESS_ID and TW_HMAC_SECRET).",
    };
  }

  const method = options.method ?? (options.body !== undefined ? "POST" : "GET");
  const path = options.path.startsWith("/") ? options.path : `/${options.path}`;
  const query = normalizeQuery(options.query);
  const url = `${TRUST_WALLET_API_BASE.replace(/\/$/, "")}${path}${
    query ? `?${query}` : ""
  }`;

  const headers = signHeaders(
    method,
    path,
    query,
    creds.accessId,
    creds.hmacSecret,
  );

  const res = await fetch(url, {
    method,
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

  if (!res.ok) {
    const msg =
      (data as { message?: string; error?: string })?.message ||
      (data as { error?: string })?.error ||
      text.slice(0, 200) ||
      res.statusText;
    return { ok: false, status: res.status, data, error: msg };
  }

  return { ok: true, status: res.status, data };
}

/* ── Convenience wrappers ─────────────────────────────────────────── */

export type TrustTicker = {
  id: string;
  price?: number;
  change_24h?: number;
  market_cap?: number;
  volume_24h?: number;
  total_supply?: string;
};

export async function trustWalletTickers(
  assets: string[],
  currency = "USD",
): Promise<{ ok: boolean; tickers: TrustTicker[]; error?: string }> {
  const unique = [...new Set(assets.filter(Boolean))].slice(0, 50);
  if (!unique.length) return { ok: true, tickers: [] };

  const res = await trustWalletFetch<{
    currency?: string;
    tickers?: TrustTicker[];
  }>({
    method: "POST",
    path: "/v2/market/tickers",
    body: { currency, assets: unique },
  });

  if (!res.ok) return { ok: false, tickers: [], error: res.error };
  return { ok: true, tickers: res.data.tickers ?? [] };
}

export async function trustWalletSearchAssets(opts: {
  query: string;
  networks?: string;
  limit?: number;
}) {
  return trustWalletFetch<{
    total?: number;
    docs?: Array<Record<string, unknown>>;
  }>({
    method: "GET",
    path: "/v1/search/assets",
    query: {
      query: opts.query,
      networks: opts.networks,
      limit: opts.limit ?? 20,
    },
  });
}

export async function trustWalletListings(opts: {
  category_id?: string;
  currency?: string;
  sort?: string;
  limit?: number;
  networks?: string;
  cursor?: string;
}) {
  return trustWalletFetch<{
    docs?: Array<Record<string, unknown>>;
    cursor?: string;
  }>({
    method: "GET",
    path: "/v1/assets/listings",
    query: {
      version: 27,
      currency: opts.currency ?? "USD",
      category_id: opts.category_id ?? "trending",
      sort: opts.sort,
      limit: opts.limit ?? 20,
      networks: opts.networks,
      cursor: opts.cursor,
      use_pagination: opts.cursor ? true : undefined,
    },
  });
}

export async function trustWalletValidateAddress(opts: {
  address: string;
  asset_id?: string;
  type?: "address" | "transaction";
}) {
  return trustWalletFetch<Record<string, unknown>>({
    method: "GET",
    path: "/v1/validate",
    query: {
      address: opts.address,
      asset_id: opts.asset_id,
      type: opts.type ?? "address",
    },
  });
}

export async function trustWalletSwapQuote(body: {
  fromAsset: string;
  fromAddress: string;
  fromDomain: string;
  amount: string;
  toAsset: string;
  toDomain: string;
  toAddress?: string;
  slippage?: string;
  sortBy?: string;
  contractCall?: boolean;
  preferredProviders?: string[];
  ignoredProviders?: string[];
}) {
  return trustWalletFetch<Record<string, unknown>>({
    method: "POST",
    path: "/amber-api/v1/route",
    body: {
      slippage: "1",
      sortBy: "outcome",
      contractCall: false,
      ...body,
    },
  });
}

export async function trustWalletDomains(includeTon = true) {
  return trustWalletFetch<{ domains?: Array<Record<string, unknown>> }>({
    method: "GET",
    path: "/amber-api/v1/domains",
    query: includeTon ? { ton: true } : undefined,
  });
}

/**
 * Overlay Trust Wallet index prices onto a major→USD map (server-only).
 * Chunks assets (max 50) and respects free-tier 1 rps with small gaps.
 */
export async function mergeTrustWalletMajorPrices<T extends string>(
  prices: Record<T, number>,
  majorIds: T[],
): Promise<Record<T, number>> {
  if (!trustWalletConfigured()) return prices;

  const { trustWalletAssetIdsForMajors } = await import(
    "@/lib/trustwallet-assets"
  );
  const mapped = trustWalletAssetIdsForMajors(
    majorIds as unknown as import("@/lib/major-tokens").MajorTokenId[],
  );
  if (!mapped.length) return prices;

  const out = { ...prices };
  const CHUNK = 50;
  for (let i = 0; i < mapped.length; i += CHUNK) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));
    const chunk = mapped.slice(i, i + CHUNK);
    const res = await trustWalletTickers(chunk.map((c) => c.assetId));
    if (!res.ok) continue;
    const byId = new Map(
      res.tickers.map((t) => [t.id, Number(t.price)] as const),
    );
    for (const { assetId, majorId } of chunk) {
      const p = byId.get(assetId);
      if (p && p > 0) out[majorId as T] = p;
    }
  }
  return out;
}
