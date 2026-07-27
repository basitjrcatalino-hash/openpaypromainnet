import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import { OUSD_LOGO_URL } from "@/lib/token-logos";

export type ActivityItem = Tables<"transactions"> & {
  logo_url?: string | null;
  source?: "wallet" | "opentoken";
  token_name?: string | null;
};

type OtTradeRow = {
  id: string;
  token_id: string;
  wallet_id: string;
  side: "buy" | "sell" | string;
  pi_amount: number;
  token_amount: number;
  price: number;
  tx_ref: string | null;
  created_at: string;
  tokens?:
    | {
        id: string;
        name: string;
        symbol: string;
        logo_url: string | null;
      }
    | Array<{
        id: string;
        name: string;
        symbol: string;
        logo_url: string | null;
      }>
    | null;
};

function mapWalletTx(tx: Tables<"transactions">): ActivityItem {
  const symbol = (tx.token_symbol ?? "").toUpperCase();
  const counterparty = (tx.counterparty ?? "").toLowerCase();
  const memo = (tx.memo ?? "").toLowerCase();
  const looksOusd =
    symbol === "OUSD" ||
    symbol.includes("OUSD") ||
    symbol.includes("→OUSD") ||
    symbol.includes("OUSD→");
  const looksOpenToken = counterparty === "opentoken" || memo.includes("opentoken");
  const looksOpenDex = counterparty === "opendex" || memo.includes("opendex") || tx.type === "swap";

  let logo: string | null = null;
  if (looksOusd && !looksOpenToken) logo = OUSD_LOGO_URL;

  return {
    ...tx,
    source: looksOpenToken ? "opentoken" : looksOpenDex ? "wallet" : "wallet",
    logo_url: logo,
    token_name: looksOpenDex ? "OpenDEX" : looksOpenToken ? "OpenToken" : null,
  };
}

function mapOpenTokenTrade(t: OtTradeRow): ActivityItem {
  const tok = Array.isArray(t.tokens) ? t.tokens[0] : t.tokens;
  const symbol = tok?.symbol ?? "TOKEN";
  const side = t.side === "sell" ? "sell" : "buy";
  const ousd = Number(t.pi_amount ?? 0);
  const tokenAmt = Number(t.token_amount ?? 0);
  return {
    id: t.id,
    wallet_id: t.wallet_id,
    type: side,
    status: "confirmed",
    token_id: t.token_id,
    token_symbol: `$${symbol}`,
    token_name: tok?.name ?? null,
    amount: tokenAmt,
    usd_value: ousd,
    counterparty: "OpenToken",
    memo:
      side === "buy"
        ? `OpenToken buy ${tokenAmt} $${symbol} for ${ousd} OUSD`
        : `OpenToken sell ${tokenAmt} $${symbol} for ${ousd} OUSD`,
    tx_hash: t.tx_ref,
    created_at: t.created_at,
    logo_url: tok?.logo_url ?? null,
    source: "opentoken",
  };
}

/** Wallet txs + OpenToken bonding-curve trades, newest first. */
export async function fetchWalletActivity(
  supabase: SupabaseClient,
  walletId: string,
  limit = 50,
): Promise<ActivityItem[]> {
  const [walletRes, otRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("wallet_id", walletId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("ot_trades")
      .select(
        "id, token_id, wallet_id, side, pi_amount, token_amount, price, tx_ref, created_at, tokens(id, name, symbol, logo_url)",
      )
      .eq("wallet_id", walletId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (walletRes.error) throw walletRes.error;

  const walletItems = (walletRes.data ?? []).map(mapWalletTx);

  let otItems: ActivityItem[] = [];
  if (!otRes.error && otRes.data) {
    otItems = (otRes.data as OtTradeRow[]).map(mapOpenTokenTrade);
  } else if (otRes.error) {
    // Fallback without join if relation alias fails
    const { data: plain } = await supabase
      .from("ot_trades")
      .select("id, token_id, wallet_id, side, pi_amount, token_amount, price, tx_ref, created_at")
      .eq("wallet_id", walletId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (plain?.length) {
      const tokenIds = [...new Set(plain.map((t) => t.token_id))];
      const { data: toks } = await supabase
        .from("tokens")
        .select("id, name, symbol, logo_url")
        .in("id", tokenIds);
      const byId = new Map((toks ?? []).map((t) => [t.id, t]));
      otItems = plain.map((row) =>
        mapOpenTokenTrade({
          ...row,
          tokens: byId.get(row.token_id) ?? null,
        }),
      );
    }
  }

  // Enrich OpenToken-mirrored wallet txs (and any row with token_id) with logos
  const needLogoIds = [
    ...new Set(
      [...walletItems, ...otItems]
        .filter((t) => t.token_id && !t.logo_url)
        .map((t) => t.token_id as string),
    ),
  ];
  let logoByToken = new Map<string, { logo_url: string | null; name: string }>();
  if (needLogoIds.length) {
    const { data: toks } = await supabase
      .from("tokens")
      .select("id, name, logo_url")
      .in("id", needLogoIds);
    logoByToken = new Map((toks ?? []).map((t) => [t.id, { logo_url: t.logo_url, name: t.name }]));
  }

  const withLogos = (items: ActivityItem[]) =>
    items.map((t) => {
      if (t.logo_url || !t.token_id) return t;
      const meta = logoByToken.get(t.token_id);
      if (!meta) return t;
      return {
        ...t,
        logo_url: meta.logo_url,
        token_name: t.token_name ?? meta.name,
        source: t.source === "opentoken" || t.counterparty === "OpenToken" ? "opentoken" : t.source,
      };
    });

  const enrichedWallet = withLogos(walletItems);
  const enrichedOt = withLogos(otItems);

  // Prefer wallet rows when the same trade was also mirrored into transactions
  const walletHashes = new Set(
    enrichedWallet.map((t) => t.tx_hash).filter((h): h is string => !!h),
  );
  const dedupedOt = enrichedOt.filter((t) => !t.tx_hash || !walletHashes.has(t.tx_hash));

  return [...enrichedWallet, ...dedupedOt]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, limit);
}
