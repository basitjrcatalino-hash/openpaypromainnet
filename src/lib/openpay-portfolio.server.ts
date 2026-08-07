// OpenPay Pro → OpenPay partner read API (server-only helpers).
// Returns token balances for a Pro account, authenticated with a partner /
// developer / ledger API key (same pattern as the inbound credit endpoint).

import { createHash } from "crypto";

export type PortfolioAsset = {
  symbol: string;
  name: string;
  balance: number;
  usd_value: number;
  logo?: string;
};

export type PortfolioPayload = {
  ok: true;
  username: string | null;
  wallet: string | null;
  updated_at: string;
  assets: PortfolioAsset[];
};

export type PartnerAuth = { ok: true; restrictToUserId?: string };

function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

/** Resolve the caller's API key. Throws { status } shaped errors. */
export async function authorizePartnerRead(
  request: Request,
): Promise<PartnerAuth | { error: string; status: number }> {
  const key =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (!key) return { error: "missing_api_key", status: 401 };

  const { partnerKeyFromEnv } = await import("@/lib/openpay-inbound.server");
  const master = partnerKeyFromEnv();
  if (master && key === master) return { ok: true };

  try {
    const { resolveDeveloperApiKey } = await import("@/lib/developer-auth.server");
    const dev = await resolveDeveloperApiKey(key);
    if (dev) return { ok: true, restrictToUserId: dev.userId };
  } catch {
    /* ignore */
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ledger_api_keys")
      .select("id, active")
      .eq("key_hash", sha256(key))
      .eq("active", true)
      .maybeSingle();
    if (data) return { ok: true };
  } catch {
    /* ignore */
  }

  return { error: "invalid_api_key", status: 401 };
}

/** Tokens OpenPay renders in Dashboard → Assets. */
const TOKENS: Array<{
  symbol: string;
  name: string;
  column: string;
  /** ledger-majors price id; omit for USD-pegged assets. */
  priceId?: "sol" | "pi";
}> = [
  { symbol: "OUSD", name: "OpenUSD", column: "ousd_balance" },
  { symbol: "USDT", name: "Tether", column: "usdt_balance" },
  { symbol: "USDC", name: "USD Coin", column: "usdc_balance" },
  { symbol: "SOL", name: "Solana", column: "sol_balance", priceId: "sol" },
  { symbol: "PI", name: "Pi Network", column: "pi_balance", priceId: "pi" },
];

async function usdPrices(): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana,pi-network&vs_currencies=usd",
      { headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const j = (await res.json()) as Record<string, { usd?: number }>;
      return {
        sol: Number(j["solana"]?.usd) || 0,
        pi: Number(j["pi-network"]?.usd) || 0,
      };
    }
  } catch {
    /* fall through to defaults */
  }
  return { sol: 0, pi: 0 };
}

function isAddress(v: string) {
  return /^0x[a-f0-9]{40}$/i.test(v.trim());
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Resolve a Pro account by username / wallet address / uid and return its
 * token balances. Throws Error with a machine code as the message.
 */
export async function getPartnerPortfolio(opts: {
  identifier: string;
  restrictToUserId?: string;
}): Promise<PortfolioPayload> {
  const raw = (opts.identifier || "").trim();
  if (!raw) throw new Error("invalid_request");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { normalizeRecipientId, findLocalProfileByHandle } = await import(
    "@/lib/recipient-resolve"
  );
  const handle = normalizeRecipientId(raw);

  const columns = ["id", "user_id", "address", ...TOKENS.map((t) => t.column)].join(", ");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wallet: any = null;
  let username: string | null = null;

  if (isAddress(handle)) {
    const { data: rows } = await supabaseAdmin
      .from("wallets")
      .select(columns)
      .ilike("address", handle)
      .limit(1);
    wallet = Array.isArray(rows) ? rows[0] : rows;
  } else {
    let userId: string | null = null;
    if (/^uid_/i.test(handle)) userId = handle.replace(/^uid_/i, "");
    else if (isUuid(handle)) userId = handle;
    else {
      const prof = await findLocalProfileByHandle(supabaseAdmin as never, handle);
      if (!prof?.id) throw new Error("user_not_found");
      userId = prof.id;
      username = prof.username ?? prof.pi_username ?? null;
    }
    const { data } = await supabaseAdmin
      .from("wallets")
      .select(columns)
      .eq("user_id", userId)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    wallet = data;
  }

  if (!wallet) throw new Error("user_not_found");
  if (opts.restrictToUserId && wallet.user_id !== opts.restrictToUserId) {
    throw new Error("forbidden");
  }

  if (!username) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("username, pi_username")
      .eq("id", wallet.user_id)
      .maybeSingle();
    username = prof?.username ?? prof?.pi_username ?? null;
  }

  const prices = await usdPrices();

  const assets: PortfolioAsset[] = TOKENS.map((t) => {
    const balance = Number(wallet[t.column] ?? 0) || 0;
    const price = t.priceId ? (prices[t.priceId] ?? 0) : 1;
    return {
      symbol: t.symbol,
      name: t.name,
      balance,
      usd_value: Math.round(balance * price * 1e6) / 1e6,
    };
  });

  return {
    ok: true,
    username,
    wallet: wallet.address ?? null,
    updated_at: new Date().toISOString(),
    assets,
  };
}

export function portfolioErrorStatus(code: string): number {
  switch (code) {
    case "invalid_request":
      return 400;
    case "forbidden":
      return 403;
    case "user_not_found":
      return 404;
    default:
      return 500;
  }
}
