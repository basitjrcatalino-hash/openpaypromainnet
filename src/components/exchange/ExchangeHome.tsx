import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Eye, EyeOff, Search, Star } from "lucide-react";

import { getPerpLiveQuotes } from "@/lib/perp-market.functions";
import { listedTradeMarkets } from "@/lib/trade-markets";
import { majorWatchKey, useWatchlist } from "@/lib/watchlist";
import { TokenAvatar } from "@/components/wallet/TokenAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, type CurrencyCode } from "@/lib/currency";
import { formatNumber, formatPct } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

type Category = "favorites" | "hot" | "gainers" | "losers" | "all";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "favorites", label: "Favorites" },
  { id: "hot", label: "Hot" },
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
  { id: "all", label: "All" },
];

type Row = {
  symbol: string;
  name: string;
  logo: string;
  leverage: number;
  perp: boolean;
  price: number;
  change: number;
  volume: number;
};

/**
 * Exchange mode home — OKX-style markets desk: estimated value, quick
 * deposit/buy, category tabs and a live ticker list wired to the same
 * perpetual quote feed the trade terminal uses (no mock data).
 */
export function ExchangeHome({
  userId,
  totalUsd,
  change24hUsd,
  currency,
}: {
  userId: string;
  totalUsd: number;
  change24hUsd: number;
  currency: CurrencyCode;
}) {
  const [cat, setCat] = useState<Category>("hot");
  const [query, setQuery] = useState("");
  const [hide, setHide] = useState(false);
  const { keys, toggleWatch } = useWatchlist(userId);

  const fetchQuotes = useServerFn(getPerpLiveQuotes);
  const { data: quotes, isLoading } = useQuery({
    queryKey: ["exchange-home-quotes"],
    queryFn: () => fetchQuotes(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const rows = useMemo((): Row[] => {
    const byMarket = new Map((quotes ?? []).map((q) => [q.market, q]));
    return listedTradeMarkets()
      .map((m) => {
        const q = byMarket.get(m.symbol);
        return {
          symbol: m.symbol,
          name: m.name,
          logo: m.logo,
          leverage: m.max_leverage,
          perp: m.perpetual_enabled,
          price: q?.price ?? 0,
          change: q?.change24h ?? 0,
          volume: q?.volume24h ?? 0,
        };
      })
      .filter((r) => r.price > 0);
  }, [quotes]);

  const visible = useMemo(() => {
    const qq = query.trim().toLowerCase();
    let list = rows;
    if (qq) {
      list = list.filter(
        (r) => r.symbol.toLowerCase().includes(qq) || r.name.toLowerCase().includes(qq),
      );
    }
    if (cat === "favorites") {
      list = list.filter((r) => keys.has(majorWatchKey(r.symbol)));
    } else if (cat === "gainers") {
      list = [...list].sort((a, b) => b.change - a.change);
    } else if (cat === "losers") {
      list = [...list].sort((a, b) => a.change - b.change);
    } else if (cat === "hot") {
      list = [...list].sort((a, b) => b.volume - a.volume);
    }
    return list.slice(0, cat === "all" ? 200 : 40);
  }, [rows, query, cat, keys]);

  const pnlUp = change24hUsd >= 0;
  const pnlPct = totalUsd > 0 ? (change24hUsd / totalUsd) * 100 : 0;

  return (
    <div className="animate-page-in pb-6">
      {/* Search */}
      <div className="mb-5 flex items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-muted/60 px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      {/* Est. total value */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setHide((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground press"
        >
          Est total value
          {hide ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-4xl font-black tabular-nums tracking-tight">
            {hide ? "••••••" : formatCurrency(totalUsd, currency)}
          </span>
        </div>
        <div className="mt-1 text-sm">
          <span className="text-muted-foreground">Today&apos;s PnL </span>
          <span className={cn("font-semibold tabular-nums", pnlUp ? "text-success" : "text-destructive")}>
            {hide
              ? "••••"
              : `${pnlUp ? "+" : "-"}${formatCurrency(Math.abs(change24hUsd), currency)} (${formatPct(pnlPct)})`}
          </span>
        </div>
      </div>

      {/* Primary CTAs */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Link
          to="/deposit"
          className="rounded-full bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground press"
        >
          Deposit crypto
        </Link>
        <Link
          to="/topup"
          search={{
            openpay_charge: undefined,
            openpay_ref: undefined,
            openpay_tx: undefined,
            openpay_return: undefined,
            openpay_cancel: undefined,
            banxa_return: undefined,
            banxa_ext: undefined,
          }}
          className="rounded-full bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground press"
        >
          Buy
        </Link>
      </div>

      {/* Categories */}
      <div className="-mx-1 mb-2 flex items-center gap-1 overflow-x-auto px-1 pb-1 scrollbar-none">
        {CATEGORIES.map((c) => {
          const active = cat === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors press",
                active ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              {c.id === "favorites" ? (
                <span className="flex items-center gap-1">
                  {c.label}
                  <ChevronDown className="h-3.5 w-3.5" />
                </span>
              ) : (
                c.label
              )}
            </button>
          );
        })}
      </div>

      {/* Ticker list */}
      <div className="divide-y divide-border/40">
        {isLoading && rows.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            ))
          : visible.map((r) => (
              <MarketRow
                key={r.symbol}
                row={r}
                watched={keys.has(majorWatchKey(r.symbol))}
                onToggleWatch={() => toggleWatch(majorWatchKey(r.symbol)).catch(() => undefined)}
              />
            ))}
        {!isLoading && visible.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {cat === "favorites"
              ? "No favorites yet — tap the star on any market."
              : "No markets match your search."}
          </p>
        )}
      </div>
    </div>
  );
}

function MarketRow({
  row,
  watched,
  onToggleWatch,
}: {
  row: Row;
  watched: boolean;
  onToggleWatch: () => void;
}) {
  const up = row.change >= 0;
  return (
    <div className="flex items-center gap-3 py-3">
      <button
        type="button"
        aria-label={watched ? "Remove from favorites" : "Add to favorites"}
        onClick={onToggleWatch}
        className="shrink-0 text-muted-foreground press"
      >
        <Star className={cn("h-4 w-4", watched && "fill-warning text-warning")} />
      </button>
      <Link
        to="/trade"
        search={{ market: row.symbol, mode: row.perp ? "futures" : "spot" }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <TokenAvatar logoUrl={row.logo} symbol={row.symbol} name={row.name} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold">{row.symbol}</span>
            <span className="text-xs text-muted-foreground">/USDT</span>
            {row.perp && (
              <span className="rounded bg-muted px-1 py-px text-[10px] font-bold text-muted-foreground">
                {row.leverage}x
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {row.volume > 0 ? `Vol ${formatNumber(row.volume, 0)}` : row.name}
          </span>
        </span>
        <span className="shrink-0 text-right text-sm font-bold tabular-nums">
          {row.price >= 1 ? formatNumber(row.price, 2) : formatNumber(row.price, 6)}
        </span>
        <span
          className={cn(
            "ml-2 w-20 shrink-0 rounded-lg py-1.5 text-center text-xs font-bold tabular-nums text-white",
            up ? "bg-success" : "bg-destructive",
          )}
        >
          {formatPct(row.change)}
        </span>
      </Link>
    </div>
  );
}
