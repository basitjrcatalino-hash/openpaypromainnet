/**
 * OpenPay OpenNFT Collectibles — public read-only API.
 * Docs: https://openpy.space/web3/nft/api/collectibles
 *
 * Prefer GET /collectibles/:username. Falls back to legacy GET /owners/:id
 * when collectibles is not deployed yet (404).
 */

export const OPENPAY_NFT_API_BASE =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_OPENPAY_NFT_PUBLIC_URL) ||
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_OPENPAY_NFT_API_BASE) ||
  "https://araojncyittkahvvpdrn.supabase.co/functions/v1/nft-public-api";

export const OPENPAY_NFT_MARKET_URL = "https://openpy.space/web3/nft";
export const OPENPAY_PRO_STORE_URL = "https://openpy.space/web3/nft/store/openpay-pro";

/**
 * Force public NFT links onto openpy.space (API often returns openpay.lovable.app).
 */
export function toOpenPyNftUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    if (
      host === "openpay.lovable.app" ||
      host === "openpay.lovable.dev" ||
      host.endsWith(".lovable.app") ||
      host.endsWith(".lovableproject.com")
    ) {
      u.protocol = "https:";
      u.hostname = "openpy.space";
      return u.toString().replace(/\/$/, "") || "https://openpy.space/web3/nft";
    }
  } catch {
    /* relative or invalid — fall through */
  }
  return trimmed
    .replace(/https?:\/\/openpay\.lovable\.app/gi, "https://openpy.space")
    .replace(/https?:\/\/[a-z0-9-]+\.lovable\.app/gi, "https://openpy.space");
}

export function openNftItemUrl(itemId: string): string {
  return `${OPENPAY_NFT_MARKET_URL}/${encodeURIComponent(itemId)}`;
}

export type OpenNftStore = {
  handle?: string;
  name?: string;
  url?: string;
};

export type OpenNftItem = {
  id: string;
  name: string;
  code?: string;
  image?: string | null;
  image_url?: string | null;
  permalink?: string | null;
  url?: string | null;
  store?: OpenNftStore | null;
};

export type OpenNftCollectible = {
  quantity: number;
  item: OpenNftItem;
};

export type OpenNftCollectiblesResponse = {
  owner: string;
  collectibles: OpenNftCollectible[];
  pagination?: { limit: number; offset: number; total?: number };
  source: "collectibles" | "owners";
};

export type OpenNftOwnership = {
  owns: boolean;
  quantity: number;
  item?: OpenNftItem | null;
};

function normalizeHandle(usernameOrId: string): string {
  return String(usernameOrId || "")
    .trim()
    .replace(/^@+/, "");
}

function itemPermalink(item: OpenNftItem): string {
  const raw =
    item.permalink ||
    item.url ||
    item.store?.url ||
    openNftItemUrl(item.id);
  return toOpenPyNftUrl(raw) || openNftItemUrl(item.id);
}

function itemImage(item: OpenNftItem): string | null {
  const src = item.image || item.image_url || null;
  if (!src || typeof src !== "string") return null;
  return src;
}

function normalizeItem(raw: Record<string, unknown> | null | undefined): OpenNftItem | null {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "");
  if (!id) return null;
  const storeRaw =
    raw.store && typeof raw.store === "object"
      ? (raw.store as OpenNftStore)
      : null;
  const store = storeRaw
    ? {
        ...storeRaw,
        url: toOpenPyNftUrl(storeRaw.url) || storeRaw.url,
      }
    : null;
  const item: OpenNftItem = {
    id,
    name: String(raw.name || raw.code || "OpenNFT"),
    code: raw.code ? String(raw.code) : undefined,
    image: typeof raw.image === "string" ? raw.image : null,
    image_url: typeof raw.image_url === "string" ? raw.image_url : null,
    permalink: toOpenPyNftUrl(
      typeof raw.permalink === "string" ? raw.permalink : null,
    ),
    url: toOpenPyNftUrl(typeof raw.url === "string" ? raw.url : null),
    store,
  };
  item.permalink = itemPermalink(item);
  return item;
}

function mapHoldingsRow(row: Record<string, unknown>): OpenNftCollectible | null {
  const quantity = Number(row.quantity ?? 0);
  const item =
    normalizeItem(row.item as Record<string, unknown>) ||
    normalizeItem({
      id: row.item_id,
      name: row.name,
      code: row.code,
      image: row.image,
      image_url: row.image_url,
      permalink: row.permalink,
    });
  if (!item) return null;
  return { quantity: Number.isFinite(quantity) ? quantity : 0, item };
}

async function getJson(path: string): Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; body: unknown }> {
  const res = await fetch(`${OPENPAY_NFT_API_BASE}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  return { ok: true, status: res.status, body };
}

/**
 * List OpenNFTs owned by an OpenPay @username or user id.
 */
export async function fetchOpenNftCollectibles(
  usernameOrUserId: string,
  opts: { limit?: number; offset?: number; category?: string; collection_id?: string } = {},
): Promise<OpenNftCollectiblesResponse> {
  const key = normalizeHandle(usernameOrUserId);
  if (!key) {
    return { owner: "", collectibles: [], source: "collectibles" };
  }

  const qs = new URLSearchParams();
  if (opts.limit != null) qs.set("limit", String(opts.limit));
  if (opts.offset != null) qs.set("offset", String(opts.offset));
  if (opts.category) qs.set("category", opts.category);
  if (opts.collection_id) qs.set("collection_id", opts.collection_id);
  const q = qs.toString() ? `?${qs}` : "";

  // Preferred Collectibles API
  const primary = await getJson(`/collectibles/${encodeURIComponent(key)}${q}`);
  if (primary.ok) {
    const body = (primary.body ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(body.collectibles)
      ? body.collectibles
      : Array.isArray(body.holdings)
        ? body.holdings
        : [];
    const collectibles = (rows as Record<string, unknown>[])
      .map(mapHoldingsRow)
      .filter((c): c is OpenNftCollectible => !!c && c.quantity > 0);
    return {
      owner: String(body.owner || body.owner_id || key),
      collectibles,
      pagination: body.pagination as OpenNftCollectiblesResponse["pagination"],
      source: "collectibles",
    };
  }

  // Legacy /owners — works today while collectibles is redeployed
  if (primary.status === 404) {
    const legacy = await getJson(`/owners/${encodeURIComponent(key)}${q}`);
    if (legacy.ok) {
      const body = (legacy.body ?? {}) as Record<string, unknown>;
      const rows = Array.isArray(body.holdings) ? (body.holdings as Record<string, unknown>[]) : [];
      const collectibles = rows
        .map(mapHoldingsRow)
        .filter((c): c is OpenNftCollectible => !!c && c.quantity > 0);
      return {
        owner: String(body.owner_id || key),
        collectibles,
        pagination: body.pagination as OpenNftCollectiblesResponse["pagination"],
        source: "owners",
      };
    }
    if (legacy.status === 404) {
      return { owner: key, collectibles: [], source: "owners" };
    }
    throw new Error(
      (legacy.body as { error?: string })?.error ||
        `OpenNFT owners failed (${legacy.status})`,
    );
  }

  throw new Error(
    (primary.body as { error?: string })?.error ||
      `Collectibles failed: ${primary.status}`,
  );
}

/**
 * Ownership check for feature gating.
 * Prefers GET /collectibles/:user/items/:itemId; falls back to holdings scan.
 */
export async function checkOpenNftOwnership(
  usernameOrUserId: string,
  itemIdOrCode: string,
): Promise<OpenNftOwnership> {
  const key = normalizeHandle(usernameOrUserId);
  const itemKey = String(itemIdOrCode || "").trim();
  if (!key || !itemKey) return { owns: false, quantity: 0 };

  const primary = await getJson(
    `/collectibles/${encodeURIComponent(key)}/items/${encodeURIComponent(itemKey)}`,
  );
  if (primary.ok) {
    const body = (primary.body ?? {}) as Record<string, unknown>;
    const quantity = Number(body.quantity ?? 0);
    const owns = Boolean(body.owns) && quantity > 0;
    return {
      owns,
      quantity: owns ? quantity : 0,
      item: normalizeItem(body.item as Record<string, unknown>),
    };
  }

  // Fallback: scan holdings (legacy owners API)
  if (primary.status === 404) {
    const list = await fetchOpenNftCollectibles(key, { limit: 100 });
    const hit = list.collectibles.find(
      (c) =>
        c.item.id === itemKey ||
        c.item.code === itemKey ||
        c.item.code?.replace(/^#/, "") === itemKey.replace(/^#/, ""),
    );
    if (hit && hit.quantity > 0) {
      return { owns: true, quantity: hit.quantity, item: hit.item };
    }
    return { owns: false, quantity: 0 };
  }

  return { owns: false, quantity: 0 };
}

export async function ownsOpenNft(
  usernameOrUserId: string,
  itemIdOrCode: string,
): Promise<boolean> {
  try {
    const r = await checkOpenNftOwnership(usernameOrUserId, itemIdOrCode);
    return r.owns && r.quantity > 0;
  } catch {
    return false;
  }
}

/** Best display image for a collectible card. */
export function openNftImageSrc(item: OpenNftItem): string | null {
  return itemImage(item);
}

/** Aliases matching OpenPay partner docs */
export const fetchCollectibles = fetchOpenNftCollectibles;
export const ownsNft = ownsOpenNft;

/** Single NFT detail from public API */
export async function fetchOpenNftItem(itemId: string): Promise<OpenNftItem | null> {
  const id = String(itemId || "").trim();
  if (!id) return null;
  const res = await getJson(`/items/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const body = (res.body ?? {}) as Record<string, unknown>;
  const raw = (body.item as Record<string, unknown>) || body;
  return normalizeItem(raw);
}

/** Connected OpenPay Pro store (when configured on OpenPay) */
export async function fetchOpenPayProStore(): Promise<Record<string, unknown> | null> {
  const res = await getJson(`/stores/openpay-pro`);
  if (!res.ok) return null;
  return (res.body as Record<string, unknown>) ?? null;
}

export type OpenNftMarketplaceCollection = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  cover_url?: string | null;
  permalink?: string | null;
  floor_price?: number | null;
  item_count?: number | null;
};

export type OpenNftMarketplaceItem = OpenNftItem & {
  price?: number | null;
  currency?: string | null;
  collection_id?: string | null;
  activity_type?: string | null;
};

export type OpenNftMarketplaceStats = {
  collections: number;
  active_items: number;
  stores: number;
  mints: number;
  sales: number;
  auctions: number;
  live_auctions: number;
  active_listings: number;
  total_volume_ousd: number;
  marketplace_url: string;
  generated_at?: string;
};

/** Live marketplace stats — lightweight (docs: GET /stats). */
export async function fetchOpenNftStats(): Promise<OpenNftMarketplaceStats> {
  const res = await getJson("/stats");
  if (!res.ok) {
    throw new Error(
      (res.body as { error?: string })?.error || `Stats failed (${res.status})`,
    );
  }
  const body = (res.body ?? {}) as Record<string, unknown>;
  const vol = (body.total_volume ?? {}) as Record<string, number>;
  return {
    collections: Number(body.collections ?? 0),
    active_items: Number(body.active_items ?? 0),
    stores: Number(body.stores ?? 0),
    mints: Number(body.mints ?? 0),
    sales: Number(body.sales ?? 0),
    auctions: Number(body.auctions ?? 0),
    live_auctions: Number(body.live_auctions ?? 0),
    active_listings: Number(body.active_listings ?? 0),
    total_volume_ousd: Number(vol.OUSD ?? 0),
    marketplace_url:
      toOpenPyNftUrl(String(body.marketplace_url || "")) || OPENPAY_NFT_MARKET_URL,
    generated_at: body.generated_at ? String(body.generated_at) : undefined,
  };
}

/**
 * Activity feed (docs: GET /activity, /activity/mints, /activity/sales).
 * Keep limit tiny — events still embed large images on some items.
 */
export async function fetchOpenNftActivity(
  kind: "all" | "mints" | "sales" | "auctions" | "gifts" = "all",
  opts: { limit?: number } = {},
): Promise<OpenNftMarketplaceItem[]> {
  const path =
    kind === "all"
      ? "/activity"
      : kind === "mints"
        ? "/activity/mints"
        : kind === "sales"
          ? "/activity/sales"
          : kind === "auctions"
            ? "/activity/auctions"
            : "/activity/gifts";
  const wanted = Math.min(Math.max(opts.limit ?? 8, 1), 12);
  const res = await getJsonWithBackoff(path, { limit: wanted, label: "activity" });
  if (!res.ok) {
    throw new Error(
      (res.body as { error?: string })?.error ||
        `Activity failed (${res.status || "network"})`,
    );
  }
  const body = (res.body ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(body.activity)
    ? (body.activity as Record<string, unknown>[])
    : Array.isArray(body.transactions)
      ? (body.transactions as Record<string, unknown>[])
      : [];

  const out: OpenNftMarketplaceItem[] = [];
  const seen = new Set<string>();
  for (const ev of rows) {
    const itemRaw = (ev.item as Record<string, unknown>) || ev;
    const mapped = mapMarketplaceItem({
      ...itemRaw,
      price:
        typeof ev.price_each === "number"
          ? ev.price_each
          : typeof ev.total === "number"
            ? ev.total
            : itemRaw.price,
      currency: ev.currency || itemRaw.currency,
    });
    if (!mapped || seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    mapped.activity_type = ev.type ? String(ev.type) : kind;
    out.push(mapped);
  }
  return out;
}

export const OPENPAY_NFT_API_DOCS_URL = "https://openpy.space/web3/nft/api";

function safeImage(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  // Never keep inline base64 in list views — OpenPay embeds multi‑MB data URLs
  if (url.startsWith("data:")) return null;
  return url;
}

async function getJsonWithBackoff(
  pathWithoutQuery: string,
  opts: { limit: number; offset?: number; label: string },
): Promise<{ ok: true; body: unknown } | { ok: false; status: number; body: unknown }> {
  // OpenPay list endpoints embed full base64 images — high limits return HTTP 546.
  const tryLimits = [...new Set([opts.limit, 2, 1].filter((n) => n > 0))].sort(
    (a, b) => b - a,
  );
  let last: { ok: false; status: number; body: unknown } = {
    ok: false,
    status: 0,
    body: null,
  };
  for (const limit of tryLimits) {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    if (opts.offset != null) qs.set("offset", String(opts.offset));
    const res = await getJson(`${pathWithoutQuery}?${qs}`);
    if (res.ok) return res;
    last = res;
    // 546 = edge gateway rejected oversized payload; retry smaller
    if (res.status !== 546 && res.status !== 413 && res.status !== 502) break;
  }
  return last;
}

/** Live OpenPay marketplace collections */
export async function fetchOpenNftCollections(
  opts: { limit?: number; offset?: number } = {},
): Promise<OpenNftMarketplaceCollection[]> {
  // Keep limit tiny — each collection cover can be several MB of base64
  const wanted = Math.min(opts.limit ?? 6, 6);
  const res = await getJsonWithBackoff("/collections", {
    limit: wanted,
    offset: opts.offset,
    label: "collections",
  });
  if (!res.ok) {
    throw new Error(
      (res.body as { error?: string })?.error ||
        `Collections failed (${res.status || "network"})`,
    );
  }
  const body = (res.body ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(body.collections) ? body.collections : [];
  return (rows as Record<string, unknown>[]).map((c) => {
    const id = String(c.id || "");
    return {
      id,
      name: String(c.name || "Collection"),
      code: c.code ? String(c.code) : undefined,
      description: c.description ? String(c.description) : undefined,
      cover_url: safeImage(c.cover_url || c.image || c.image_url),
      permalink:
        toOpenPyNftUrl(
          (typeof c.permalink === "string" && c.permalink) ||
            (typeof c.url === "string" && c.url) ||
            null,
        ) ||
        (id ? `${OPENPAY_NFT_MARKET_URL}/collection/${id}` : OPENPAY_NFT_MARKET_URL),
      floor_price: typeof c.floor_price === "number" ? c.floor_price : null,
      item_count: typeof c.item_count === "number" ? c.item_count : null,
    };
  });
}

function mapMarketplaceItem(raw: Record<string, unknown>): OpenNftMarketplaceItem | null {
  const item = normalizeItem({
    ...raw,
    image: safeImage(raw.image),
    image_url: safeImage(raw.image_url || raw.image),
    permalink:
      raw.permalink ||
      (raw.id ? openNftItemUrl(String(raw.id)) : null),
  });
  if (!item) return null;
  return {
    ...item,
    price: typeof raw.price === "number" ? raw.price : Number(raw.price ?? NaN) || null,
    currency: raw.currency ? String(raw.currency) : "OUSD",
    collection_id: raw.collection_id ? String(raw.collection_id) : null,
  };
}

/**
 * Live OpenPay marketplace items.
 * Bulk /items?limit=N returns HTTP 546 (edge rejects multi‑MB base64 payloads).
 * We only pull a tiny page and strip images for the Pro UI.
 */
export async function fetchOpenNftMarketplaceItems(
  opts: { limit?: number; offset?: number } = {},
): Promise<OpenNftMarketplaceItem[]> {
  // Never request more than 2 — each row can be multi‑MB of embedded base64
  const wanted = Math.min(Math.max(opts.limit ?? 2, 1), 2);
  const startOffset = opts.offset ?? 0;
  const out: OpenNftMarketplaceItem[] = [];

  const bulk = await getJsonWithBackoff("/items", {
    limit: wanted,
    offset: startOffset,
    label: "items",
  });
  if (bulk.ok) {
    const body = (bulk.body ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
    for (const raw of rows) {
      const mapped = mapMarketplaceItem(raw);
      if (mapped) out.push(mapped);
    }
    return out;
  }

  // Final fallback: single row
  const res = await getJson(
    `/items?limit=1&offset=${encodeURIComponent(String(startOffset))}`,
  );
  if (!res.ok) {
    throw new Error(
      (res.body as { error?: string })?.error ||
        `Items failed (${res.status}). OpenPay list payloads are too large — open the marketplace directly.`,
    );
  }
  const body = (res.body ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
  for (const raw of rows) {
    const mapped = mapMarketplaceItem(raw);
    if (mapped) out.push(mapped);
  }
  return out;
}
