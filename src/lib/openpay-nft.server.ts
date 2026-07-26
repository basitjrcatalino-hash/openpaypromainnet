// OpenPay OpenNFT Partner Mint API — server-only.
// Never import from browser route modules except via server functions.

const DEFAULT_MINT_BASE =
  "https://araojncyittkahvvpdrn.supabase.co/functions/v1/nft-partner-api";

export type OpenNftMintRequest = {
  name: string;
  code: string;
  description?: string;
  image_url: string;
  media_url: string;
  media_type?: "image" | "video" | "audio" | "model" | string;
  quantity?: number;
  price?: number;
  currency?: string;
  creator_mode?: "platform" | "user" | string;
  recipient_username: string;
  list_on_marketplace?: boolean;
  payment_method?: string;
  properties: {
    source: "openpay_pro";
    external_mint_id: string;
    category?: string;
    [k: string]: unknown;
  };
};

export type OpenNftMintResult = {
  success: boolean;
  item_id: string;
  permalink: string;
  store_url?: string;
  mint_fee?: number;
  currency?: string;
  raw?: unknown;
};

export class OpenNftMintUnavailableError extends Error {
  status: number;
  constructor(message: string, status = 404) {
    super(message);
    this.name = "OpenNftMintUnavailableError";
    this.status = status;
  }
}

function partnerKey(): string {
  const key = (
    process.env.OPENPAY_PARTNER_API_KEY ||
    process.env.OPENPAY_API_KEY ||
    process.env.OPENPAY_TRANSFER_API_KEY ||
    ""
  )
    .trim()
    .replace(/^["']+|["']+$/g, "");
  if (!key) throw new Error("OPENPAY_PARTNER_API_KEY not configured");
  if (!/^opk_(live|test)_/i.test(key)) {
    throw new Error("OPENPAY_PARTNER_API_KEY must be an opk_live_… / opk_test_… key");
  }
  return key;
}

function mintBase(): string {
  return (
    process.env.OPENPAY_NFT_MINT_URL ||
    process.env.OPENPAY_NFT_PARTNER_API_URL ||
    DEFAULT_MINT_BASE
  ).replace(/\/$/, "");
}

/** Probe whether partner mint endpoint is deployed. */
export async function probeOpenNftMintApi(): Promise<{
  available: boolean;
  status: number;
  base: string;
}> {
  const base = mintBase();
  try {
    const res = await fetch(`${base}/`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    // 401/403 = deployed but needs auth; 404 = not deployed
    if (res.status === 404) return { available: false, status: 404, base };
    return { available: true, status: res.status, base };
  } catch {
    return { available: false, status: 0, base };
  }
}

export async function mintOpenNftPartner(body: OpenNftMintRequest): Promise<OpenNftMintResult> {
  const key = partnerKey();
  const base = mintBase();
  const res = await fetch(`${base}/mint`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      ...body,
      media_type: body.media_type ?? "image",
      quantity: body.quantity ?? 1,
      currency: body.currency ?? "OUSD",
      creator_mode: body.creator_mode ?? "platform",
      list_on_marketplace: body.list_on_marketplace ?? true,
      payment_method: body.payment_method ?? "openpay_balance",
      properties: {
        ...body.properties,
        source: "openpay_pro",
      },
    }),
  });

  const text = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    parsed = { raw: text };
  }

  if (res.status === 404) {
    throw new OpenNftMintUnavailableError(
      "OpenPay NFT mint API is not deployed yet (nft-partner-api). Collectibles still work — mint coming soon.",
      404,
    );
  }

  if (!res.ok) {
    const msg =
      (parsed?.error as string) ||
      (parsed?.message as string) ||
      (typeof parsed?.raw === "string" ? parsed.raw : null) ||
      `OpenPay mint failed (${res.status})`;
    throw new Error(msg);
  }

  const itemId = String(parsed?.item_id || parsed?.id || "");
  const rawPermalink =
    String(parsed?.permalink || "") ||
    (itemId ? `https://openpy.space/web3/nft/${itemId}` : "");
  const permalink = rawPermalink
    .replace(/https?:\/\/openpay\.lovable\.app/gi, "https://openpy.space")
    .replace(/https?:\/\/[a-z0-9-]+\.lovable\.app/gi, "https://openpy.space");
  if (!itemId) {
    throw new Error("OpenPay mint response missing item_id");
  }

  const rawStore =
    (parsed?.store_url as string) ||
    "https://openpy.space/web3/nft/store/openpay-pro";
  const store_url = rawStore
    .replace(/https?:\/\/openpay\.lovable\.app/gi, "https://openpy.space")
    .replace(/https?:\/\/[a-z0-9-]+\.lovable\.app/gi, "https://openpy.space");

  return {
    success: Boolean(parsed?.success ?? true),
    item_id: itemId,
    permalink,
    store_url,
    mint_fee: typeof parsed?.mint_fee === "number" ? parsed.mint_fee : undefined,
    currency: (parsed?.currency as string) || "OUSD",
    raw: parsed,
  };
}
