import { useEffect, useMemo, useState } from "react";
import { Flame, Search, Star, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import { TokenAvatar } from "@/components/wallet/TokenAvatar";
import { PERP_MARKETS, marketToMajorId, type PerpMarket } from "@/lib/perp";
import { getMajorToken, majorMarketById, type MajorMarketSnapshot } from "@/lib/major-tokens";
import { pairLabel, type TradeMode } from "@/lib/exchange-depth";
import { quoteByMarket, type PerpLiveQuote } from "@/lib/tradingview-perps";
import {
  loadRecentMarkets,
  loadTradeFavorites,
  saveTradeFavorites,
} from "@/lib/trade-advanced";

type Bucket = "favorites" | "all" | "gainers" | "losers" | "trending" | "recent";

const BUCKETS: { id: Bucket; label: string; icon?: typeof Star }[] = [
  { id: "favorites", label: "Favorites", icon: Star },
  { id: "all", label: "Markets" },
  { id: "gainers", label: "Gainers", icon: TrendingUp },
  { id: "losers", label: "Losers", icon: TrendingDown },
  { id: "trending", label: "Trending", icon: Flame },
  { id: "recent", label: "Recent" },
];

type Row = {
  market: PerpMarket;
  price: number;
  change: number;
  volume: number;
};

/** OKX-style market discovery rail — favorites, movers, trending, recents. */
export function MarketDiscoveryPanel({
  mode,
  market,
  quotes,
  majors,
  onSelect,
  className,
}: {
  mode: TradeMode;
  market: PerpMarket;
  quotes?: PerpLiveQuote[];
  majors?: MajorMarketSnapshot[];
  onSelect: (m: PerpMarket) => void;
  className?: string;
}) {
  const [bucket, setBucket] = useState<Bucket>("all");
  const [q, setQ] = useState("");
  const [favs, setFavs] = useState<string[]>([]);
  const [recent, setRecent] = useState<PerpMarket[]>([]);

  useEffect(() => {
    setFavs(loadTradeFavorites());
    setRecent(loadRecentMarkets());
  }, [market]);

  function toggleFav(m: PerpMarket) {
    setFavs((prev) => {
      const next = prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m];
      saveTradeFavorites(next);
      return next;
    });
  }

  const rows: Row[] = useMemo(
    () =>
      PERP_MARKETS.map((m) => {
        const quote = quoteByMarket(quotes, m);
        const snap = majorMarketById(majors, marketToMajorId(m));
        const price = quote?.markPrice || quote?.price || snap.price || 0;
        const change = Number.isFinite(quote?.change24h)
          ? Number(quote?.change24h)
          : (snap.change24h ?? 0);
        return {
          market: m,
          price,
          change,
          volume: quote?.volume24h ?? snap.volume24h ?? 0,
        };
      }),
    [quotes, majors],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = rows;
    if (term) {
      list = list.filter((r) => {
        const token = getMajorToken(marketToMajorId(r.market));
        return (
          r.market.toLowerCase().includes(term) ||
          (token?.name ?? "").toLowerCase().includes(term)
        );
      });
    }
    switch (bucket) {
      case "favorites":
        return list.filter((r) => favs.includes(r.market));
      case "gainers":
        return [...list].filter((r) => r.change > 0).sort((a, b) => b.change - a.change);
      case "losers":
        return [...list].filter((r) => r.change < 0).sort((a, b) => a.change - b.change);
      case "trending":
        return [...list].sort((a, b) => b.volume - a.volume);
      case "recent":
        return recent
          .map((m) => list.find((r) => r.market === m))
          .filter((r): r is Row => Boolean(r));
      default:
        return list;
    }
  }, [rows, q, bucket, favs, recent]);

  return (
    <aside className={cn("flex min-h-0 flex-col border-r border-border/40 bg-card/20", className)}>
      <div className="shrink-0 p-2">
        <label className="relative block">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search markets"
            className="h-8 w-full rounded-md bg-muted/60 pl-7 pr-2 text-xs outline-none ring-1 ring-transparent focus:ring-primary/40"
          />
        </label>
      </div>

      <div className="flex shrink-0 gap-1 overflow-x-auto px-2 pb-2 scrollbar-none">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBucket(b.id)}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold press",
              bucket === b.id
                ? "bg-foreground text-background"
                : "bg-muted/50 text-muted-foreground",
            )}
          >
            {b.icon ? <b.icon className="h-3 w-3" /> : null}
            {b.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-2">
        {!filtered.length ? (
          <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">
            Nothing here yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((r) => {
              const token = getMajorToken(marketToMajorId(r.market));
              const up = r.change >= 0;
              return (
                <li key={r.market}>
                  <div
                    className={cn(
                      "group flex items-center gap-2 rounded-lg px-2 py-1.5",
                      r.market === market ? "bg-muted/60" : "hover:bg-muted/35",
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Favorite ${r.market}`}
                      onClick={() => toggleFav(r.market)}
                      className="shrink-0 press"
                    >
                      <Star
                        className={cn(
                          "h-3.5 w-3.5",
                          favs.includes(r.market)
                            ? "fill-[#ffad0a] text-[#ffad0a]"
                            : "text-muted-foreground/50",
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(r.market)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left press"
                    >
                      <TokenAvatar
                        symbol={r.market}
                        logoUrl={token?.logoUrl}
                        className="h-6 w-6 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold">
                          {pairLabel(r.market, mode)}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          Vol {formatNumber(r.volume, 0)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[12px] font-semibold tabular-nums">
                          {r.price > 0 ? formatNumber(r.price, r.price >= 1000 ? 1 : 2) : "—"}
                        </span>
                        <span
                          className={cn(
                            "block text-[10px] font-bold tabular-nums",
                            up ? "text-[#0ecb81]" : "text-[#f6465d]",
                          )}
                        >
                          {up ? "+" : ""}
                          {formatNumber(r.change, 2)}%
                        </span>
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
