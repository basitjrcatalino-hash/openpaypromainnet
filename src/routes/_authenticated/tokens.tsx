/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CircleDollarSign, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExploreDock } from "@/components/wallet/ExploreDock";
import { OusdIcon } from "@/components/ousd-icon";
import { useCurrency, type CurrencyCode } from "@/lib/currency";
import { TokenPriceRate } from "@/components/wallet/TokenPriceRate";
import {
  MAJOR_TOKEN_IDS,
  MAJOR_TOKENS,
  MAJOR_SYMBOLS,
  fetchMajorMarkets,
  majorMarketById,
  type MajorTokenId,
} from "@/lib/major-tokens";

export const Route = createFileRoute("/_authenticated/tokens")({
  head: () => ({ meta: [{ title: "Tokens — OpenPay Pro" }] }),
  component: TokensPage,
});

function TokensPage() {
  const { code: currency } = useCurrency();
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["ot-tokens", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("*")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        const { data: fallback } = await supabase
          .from("tokens")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        return fallback ?? [];
      }
      return data ?? [];
    },
  });

  const { data: majorMarkets = [] } = useQuery({
    queryKey: ["major-markets"],
    staleTime: 60_000,
    queryFn: fetchMajorMarkets,
  });

  const filtered = useMemo(() => {
    let list = tokens as any[];
    // Hide DB seed duplicates of BTC/ETH/SOL — majors are pinned above
    list = list.filter((t) => {
      const sym = String(t.symbol ?? "").toUpperCase();
      const name = String(t.name ?? "").toUpperCase();
      if (MAJOR_SYMBOLS.has(sym) || MAJOR_SYMBOLS.has(name)) return false;
      return true;
    });
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name?.toLowerCase().includes(qq) ||
          t.symbol?.toLowerCase().includes(qq) ||
          String(t.id).toLowerCase().includes(qq),
      );
    }
    return [...list].sort((a, b) => Number(b.market_cap ?? 0) - Number(a.market_cap ?? 0));
  }, [tokens, q]);

  const showOusd =
    !q.trim() ||
    "openusd ousd".includes(q.trim().toLowerCase()) ||
    q.trim().toLowerCase().includes("ousd") ||
    q.trim().toLowerCase().includes("openusd");

  const visibleMajors = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return MAJOR_TOKEN_IDS;
    return MAJOR_TOKEN_IDS.filter((id) => {
      const m = MAJOR_TOKENS[id];
      return (
        m.name.toLowerCase().includes(qq) ||
        m.symbol.toLowerCase().includes(qq) ||
        m.network.toLowerCase().includes(qq) ||
        id.includes(qq)
      );
    });
  }, [q]);

  return (
    <div className="ot-phantom mx-auto w-full max-w-lg animate-page-in md:max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
            <CircleDollarSign className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Tokens</h1>
            <p className="ph-caption">Majors · OpenPay Pro tokens</p>
          </div>
        </div>
        <Button asChild size="sm" className="rounded-full">
          <Link to="/opentoken/create">
            <Plus className="mr-1 h-4 w-4" />
            Create
          </Link>
        </Button>
      </div>

      <ul className="pb-4">
        {showOusd && (
          <li>
            <Link to="/asset/$tokenId" params={{ tokenId: "ousd" }} className="ph-row press">
              <div className="flex min-w-0 items-center gap-3">
                <OusdIcon className="h-11 w-11 shrink-0" />
                <div className="min-w-0">
                  <div className="ph-row-title truncate">OpenUSD OUSD</div>
                  <div className="ph-row-sub">OUSD · Stablecoin</div>
                </div>
              </div>
              <TokenPriceRate price={1} change={0} currency={currency} />
            </Link>
          </li>
        )}

        {visibleMajors.map((id) => (
          <MajorTokenRow key={id} id={id} currency={currency} markets={majorMarkets} />
        ))}

        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 py-3">
              <div className="h-11 w-11 rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-28 rounded bg-muted" />
                <div className="h-3 w-14 rounded bg-muted" />
              </div>
            </li>
          ))
        ) : filtered.length === 0 && visibleMajors.length === 0 && !showOusd ? (
          <li className="py-16 text-center text-sm text-muted-foreground">No tokens found</li>
        ) : (
          filtered
            .filter((t) => t?.id)
            .map((t) => <TokenRow key={String(t.id)} token={t} currency={currency} />)
        )}
      </ul>

      <ExploreDock
        query={q}
        onQueryChange={setQ}
        searchOpen={searchOpen}
        onSearchOpenChange={setSearchOpen}
        placeholder="Search Bitcoin, Solana, tokens…"
      />
    </div>
  );
}

function MajorTokenRow({
  id,
  currency,
  markets,
}: {
  id: MajorTokenId;
  currency: CurrencyCode;
  markets: Awaited<ReturnType<typeof fetchMajorMarkets>>;
}) {
  const def = MAJOR_TOKENS[id];
  const m = majorMarketById(markets, id);
  return (
    <li>
      <Link to="/asset/$tokenId" params={{ tokenId: id }} className="ph-row press">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
            <img src={def.logoUrl} alt="" className="h-full w-full object-cover" />
            <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background text-primary" />
          </div>
          <div className="min-w-0">
            <div className="ph-row-title truncate">{def.name}</div>
            <div className="ph-row-sub">
              {def.symbol} · {def.network}
            </div>
          </div>
        </div>
        <TokenPriceRate price={m.price} change={m.change24h} currency={currency} />
      </Link>
    </li>
  );
}

function TokenRow({ token: t, currency }: { token: any; currency: CurrencyCode }) {
  const change = Number(t.change_24h ?? 0);
  const price = Number(t.price_usd ?? 0);
  return (
    <li>
      <Link
        to="/asset/$tokenId"
        params={{ tokenId: t.id }}
        className="ph-row press"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
            {t.logo_url ? (
              <img src={t.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-primary/20 text-xs font-bold text-primary">
                {t.symbol?.slice(0, 2)}
              </div>
            )}
            {t.is_verified && (
              <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <div className="ph-row-title truncate">{t.name}</div>
            <div className="ph-row-sub">{t.symbol}</div>
          </div>
        </div>
        <TokenPriceRate price={price} change={change} currency={currency} />
      </Link>
    </li>
  );
}
