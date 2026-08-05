/**
 * Browser-safe Trust Wallet API helpers (same-origin proxies).
 * Secrets never leave the server — see trustwallet.server.ts.
 */

export type TwTicker = {
  id: string;
  price?: number;
  change_24h?: number;
  market_cap?: number;
  volume_24h?: number;
};

export type TwListingDoc = {
  asset?: {
    asset_id?: string;
    name?: string;
    symbol?: string;
    icon_url?: string;
    network?: number;
    is_verified?: boolean;
  };
  market?: {
    market_cap?: number;
    volume_24h?: number;
  };
  price?: {
    price?: number;
    change_24h?: number;
    percent_change_24h?: number;
  };
};

export type TwSearchDoc = {
  name?: string;
  symbol?: string;
  asset_id?: string;
  icon_url?: string;
  price?: number;
  market_cap?: number;
  volume_24h?: number;
  verifiers?: string[];
};

export type TwValidateResult = {
  configured?: boolean;
  valid?: boolean;
  result?: string;
  details?: {
    is_contract?: boolean;
    is_sanctioned?: boolean;
    risk_score?: number;
    labels?: string[];
  };
  error?: string;
};

export async function twStatus(): Promise<{ configured: boolean }> {
  const res = await fetch("/api/public/trustwallet-status");
  if (!res.ok) return { configured: false };
  return (await res.json()) as { configured: boolean };
}

export async function twPrices(
  assets: string[],
  currency = "USD",
): Promise<TwTicker[]> {
  if (!assets.length) return [];
  const res = await fetch("/api/public/trustwallet-prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currency, assets: assets.slice(0, 50) }),
  });
  if (!res.ok) return [];
  const j = (await res.json()) as { tickers?: TwTicker[] };
  return j.tickers ?? [];
}

export async function twListings(opts?: {
  category_id?: string;
  limit?: number;
  sort?: string;
}): Promise<TwListingDoc[]> {
  const sp = new URLSearchParams({
    version: "27",
    currency: "USD",
    category_id: opts?.category_id ?? "trending",
    limit: String(opts?.limit ?? 30),
  });
  if (opts?.sort) sp.set("sort", opts.sort);
  const res = await fetch(`/api/public/trustwallet-listings?${sp}`);
  if (!res.ok) return [];
  const j = (await res.json()) as { docs?: TwListingDoc[] };
  return j.docs ?? [];
}

export async function twSearch(
  query: string,
  opts?: { networks?: string; limit?: number },
): Promise<TwSearchDoc[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const sp = new URLSearchParams({
    query: q,
    limit: String(opts?.limit ?? 20),
  });
  if (opts?.networks) sp.set("networks", opts.networks);
  const res = await fetch(`/api/public/trustwallet-search?${sp}`);
  if (!res.ok) return [];
  const j = (await res.json()) as { docs?: TwSearchDoc[] };
  return j.docs ?? [];
}

export async function twValidate(
  address: string,
  assetId?: string,
): Promise<TwValidateResult> {
  const sp = new URLSearchParams({
    address: address.trim(),
    type: "address",
  });
  if (assetId) sp.set("asset_id", assetId);
  const res = await fetch(`/api/public/trustwallet-validate?${sp}`);
  const j = (await res.json().catch(() => ({}))) as TwValidateResult;
  if (!res.ok) return { ...j, error: j.error || `HTTP ${res.status}` };
  return j;
}

export async function twSwapQuote(body: Record<string, unknown>): Promise<{
  ok: boolean;
  data: Record<string, unknown>;
  error?: string;
}> {
  const res = await fetch("/api/public/trustwallet-quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      data,
      error: String(data.error || `HTTP ${res.status}`),
    };
  }
  return { ok: true, data };
}

export function twRiskLabel(result?: string): {
  label: string;
  tone: "ok" | "warn" | "bad" | "neutral";
} {
  switch ((result || "").toLowerCase()) {
    case "whitelist":
      return { label: "Trusted", tone: "ok" };
    case "neutral":
      return { label: "No flags", tone: "neutral" };
    case "blacklist":
      return { label: "High risk", tone: "bad" };
    case "unknown":
      return { label: "Unknown", tone: "warn" };
    default:
      return { label: result || "Unchecked", tone: "neutral" };
  }
}

/** Map OpenPay swap network → Amber domain id. */
export function amberDomainForSwapNetwork(network: string): string | null {
  switch (network) {
    case "ethereum":
      return "ethereum";
    case "bnb":
      return "bsc";
    case "solana":
      return "solana";
    case "avalanche":
      return "avalanche";
    case "tron":
      return "tron";
    case "bitcoin":
      return "bitcoin";
    default:
      return null;
  }
}

export const AMBER_NATIVE_EVM =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const AMBER_NATIVE_SOL =
  "So11111111111111111111111111111111111111112";
