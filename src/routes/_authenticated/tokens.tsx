/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, BadgeCheck, CircleDollarSign, Plus, Shield } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExploreDock } from "@/components/wallet/ExploreDock";
import { TokenAvatar } from "@/components/wallet/TokenAvatar";
import { OusdIcon } from "@/components/ousd-icon";
import { useCurrency, type CurrencyCode } from "@/lib/currency";
import { TokenPriceRate } from "@/components/wallet/TokenPriceRate";
import { cn } from "@/lib/utils";
import {
  MAJOR_TOKEN_IDS,
  MAJOR_TOKENS,
  MAJOR_SYMBOLS,
  fetchMajorMarkets,
  majorMarketById,
  type MajorTokenId,
} from "@/lib/major-tokens";
import {
  WALLET_NETWORKS,
  type WalletNetworkId,
} from "@/lib/wallet-networks";

export const Route = createFileRoute("/_authenticated/tokens")({
  head: () => ({
    meta: [
      { title: "Tokens — OpenPay Pro" },
      {
        name: "description",
        content: "Browse, swap, and track token prices and balances inside your OpenPay Pro wallet.",
      },
      { property: "og:title", content: "Tokens — OpenPay Pro" },
      {
        property: "og:description",
        content: "Browse, swap, and track token prices and balances in OpenPay Pro.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Tokens on OpenPay Pro",
          description: "Digital tokens available to hold and swap in the OpenPay Pro wallet.",
        }),
      },
    ],
  }),
  component: TokensPage,
});

type ListMode = "all" | "featured" | "trending" | "volume";
type SortKey = "market" | "name" | "price" | "change";

const LIST_MODES: { id: ListMode; label: string }[] = [
  { id: "all", label: "All" },
  { id: "featured", label: "Featured" },
  { id: "trending", label: "Trending" },
  { id: "volume", label: "Top Vol" },
];

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "market", label: "Market" },
  { id: "name", label: "Name" },
  { id: "price", label: "Price" },
  { id: "change", label: "24h %" },
];

function TokensPage() {
  const { code: currency } = useCurrency();
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [network, setNetwork] = useState<WalletNetworkId>("all");
  const [listMode, setListMode] = useState<ListMode>("all");
  const [sort, setSort] = useState<SortKey>("market");

  const curatedOnly = listMode !== "all";
  const activeNetwork = WALLET_NETWORKS.find((n) => n.id === network) ?? WALLET_NETWORKS[0]!;
  const isOpenPayNet = network === "all" || network === "openpay";

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

  const { data: isStaff = false } = useQuery({
    queryKey: ["ot-staff"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const [{ data: isAdmin }, { data: isMod }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userData.user.id, _role: "moderator" }),
      ]);
      return !!(isAdmin || isMod);
    },
  });

  const showOusd = useMemo(() => {
    if (curatedOnly) return false;
    if (!isOpenPayNet) return false;
    if (!q.trim()) return true;
    const qq = q.trim().toLowerCase();
    return (
      "openusd ousd".includes(qq) ||
      qq.includes("ousd") ||
      qq.includes("openusd") ||
      qq.includes("openpay")
    );
  }, [q, curatedOnly, isOpenPayNet]);

  const visibleMajors = useMemo(() => {
    if (curatedOnly) return [] as MajorTokenId[];
    const qq = q.trim().toLowerCase();
    let ids = MAJOR_TOKEN_IDS.filter((id) => {
      const m = MAJOR_TOKENS[id];
      if (activeNetwork.match && m.network !== activeNetwork.match) return false;
      if (!qq) return true;
      return (
        m.name.toLowerCase().includes(qq) ||
        m.symbol.toLowerCase().includes(qq) ||
        m.network.toLowerCase().includes(qq) ||
        id.includes(qq)
      );
    });

    ids = [...ids].sort((a, b) => {
      const ma = majorMarketById(majorMarkets, a);
      const mb = majorMarketById(majorMarkets, b);
      const da = MAJOR_TOKENS[a];
      const db = MAJOR_TOKENS[b];
      switch (sort) {
        case "name":
          return da.name.localeCompare(db.name);
        case "price":
          return (mb.price ?? 0) - (ma.price ?? 0);
        case "change":
          return (mb.change24h ?? 0) - (ma.change24h ?? 0);
        case "market":
        default:
          return (mb.marketCap ?? 0) - (ma.marketCap ?? 0);
      }
    });
    return ids;
  }, [q, sort, majorMarkets, curatedOnly, activeNetwork]);

  const filtered = useMemo(() => {
    // OpenTokens live on OpenPay Pro ledger (no external chain column).
    if (!isOpenPayNet) return [] as any[];

    let list = (tokens as any[]).filter((t) => {
      const sym = String(t.symbol ?? "").toUpperCase();
      const name = String(t.name ?? "").toUpperCase();
      if (MAJOR_SYMBOLS.has(sym) || MAJOR_SYMBOLS.has(name)) return false;
      return true;
    });

    if (listMode === "featured") {
      list = list.filter((t) => !!t.is_featured);
    } else if (listMode === "trending") {
      const pinned = list.filter((t) => !!t.is_trending);
      if (pinned.length) list = pinned;
    } else if (listMode === "volume") {
      const pinned = list.filter((t) => !!t.is_top_volume);
      if (pinned.length) list = pinned;
    }

    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name?.toLowerCase().includes(qq) ||
          t.symbol?.toLowerCase().includes(qq) ||
          String(t.id).toLowerCase().includes(qq),
      );
    }

    return [...list].sort((a, b) => {
      if (listMode === "trending") {
        const pin = Number(!!b.is_trending) - Number(!!a.is_trending);
        if (pin !== 0) return pin;
        const vol = Number(b.volume_24h ?? 0) - Number(a.volume_24h ?? 0);
        if (vol !== 0) return vol;
        return Math.abs(Number(b.change_24h ?? 0)) - Math.abs(Number(a.change_24h ?? 0));
      }
      if (listMode === "volume") {
        const pin = Number(!!b.is_top_volume) - Number(!!a.is_top_volume);
        if (pin !== 0) return pin;
        return Number(b.volume_24h ?? 0) - Number(a.volume_24h ?? 0);
      }
      if (listMode === "featured") {
        return Number(b.market_cap ?? 0) - Number(a.market_cap ?? 0);
      }
      switch (sort) {
        case "name":
          return String(a.name ?? "").localeCompare(String(b.name ?? ""));
        case "price":
          return Number(b.price_usd ?? 0) - Number(a.price_usd ?? 0);
        case "change":
          return Number(b.change_24h ?? 0) - Number(a.change_24h ?? 0);
        case "market":
        default:
          return Number(b.market_cap ?? 0) - Number(a.market_cap ?? 0);
      }
    });
  }, [tokens, q, sort, listMode, isOpenPayNet]);

  const empty =
    !isLoading && filtered.length === 0 && visibleMajors.length === 0 && !showOusd;

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
        <div className="flex items-center gap-2">
          {isStaff && (
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link to="/opentoken/admin">
                <Shield className="mr-1 h-4 w-4" />
                Admin
              </Link>
            </Button>
          )}
          <Button asChild size="sm" className="rounded-full">
            <Link to="/opentoken/create" search={{}}>
              <Plus className="mr-1 h-4 w-4" />
              Create
            </Link>
          </Button>
        </div>
      </div>

      {/* List mode */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {LIST_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setListMode(m.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition press",
              listMode === m.id
                ? "bg-foreground text-background"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Network filter — Phantom-style full list */}
      {!curatedOnly && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {WALLET_NETWORKS.map((n) => {
            const active = network === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setNetwork(n.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-xs font-semibold transition press",
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {n.id === "all" ? (
                  <span
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold",
                      active ? "bg-background/20" : "bg-background/80 text-foreground",
                    )}
                  >
                    ∗
                  </span>
                ) : n.id === "openpay" ? (
                  <span className="grid h-5 w-5 place-items-center overflow-hidden rounded-full">
                    <OusdIcon className="h-5 w-5" />
                  </span>
                ) : n.logoUrl ? (
                  <img
                    src={n.logoUrl}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="grid h-5 w-5 place-items-center rounded-full text-[8px] font-bold text-white"
                    style={{ background: n.accent }}
                  >
                    {n.short.slice(0, 2)}
                  </span>
                )}
                {n.short}
              </button>
            );
          })}
        </div>
      )}

      {/* Sort (All mode only) */}
      {listMode === "all" && (
        <div className="mb-3 flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sort
          </span>
          <div className="flex flex-1 gap-1 overflow-x-auto scrollbar-none">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSort(s.id)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition press",
                  sort === s.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="pb-4">
        {showOusd && (
          <li>
            <Link
              to="/asset/$tokenId"
              params={{ tokenId: "ousd" }}
              search={{}}
              className="ph-row press"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-11 w-11 shrink-0">
                  <OusdIcon className="h-11 w-11" />
                  <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="ph-row-title truncate">OpenUSD OUSD</div>
                  <div className="ph-row-sub">OUSD · OpenPay</div>
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
        ) : empty ? (
          <li className="py-16 text-center text-sm text-muted-foreground">
            {listMode === "featured"
              ? "No featured tokens yet"
              : listMode === "trending"
                ? "No trending tokens yet"
                : listMode === "volume"
                  ? "No top volume tokens yet"
                  : activeNetwork.status === "soon"
                    ? `${activeNetwork.label} coming soon`
                    : `No tokens on ${activeNetwork.label}`}
          </li>
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
        placeholder="Search Solana, Base, Bitcoin…"
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
      <Link
        to="/asset/$tokenId"
        params={{ tokenId: id }}
        search={{}}
        className="ph-row press"
      >
        <div className="flex min-w-0 items-center gap-3">
          <TokenAvatar
            logoUrl={def.logoUrl}
            name={def.name}
            symbol={def.symbol}
            verified
          />
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
        search={{}}
        className="ph-row press"
      >
        <div className="flex min-w-0 items-center gap-3">
          <TokenAvatar
            logoUrl={t.logo_url}
            name={t.name}
            symbol={t.symbol}
            verified={Boolean(t.is_verified)}
          />
          <div className="min-w-0">
            <div className="ph-row-title truncate">{t.name}</div>
            <div className="ph-row-sub">{t.symbol} · OpenPay</div>
          </div>
        </div>
        <TokenPriceRate price={price} change={change} currency={currency} />
      </Link>
    </li>
  );
}
