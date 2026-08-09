import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Flame, Rocket, Search, Sparkles, Wallet, Zap } from "lucide-react";

import { getPerpLiveQuotes } from "@/lib/perp-market.functions";
import { listedTradeMarkets } from "@/lib/trade-markets";
import { TokenAvatar } from "@/components/wallet/TokenAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatPct } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/exchange/explore")({
  head: () => ({
    meta: [
      { title: "Explore markets · OpenPay Pro Exchange" },
      {
        name: "description",
        content:
          "Discover spot and futures markets, earn products and trending tokens inside OpenPay Pro Exchange mode.",
      },
      { property: "og:title", content: "Explore markets · OpenPay Pro Exchange" },
      {
        property: "og:description",
        content: "Spot, futures, earn and trending markets in OpenPay Pro Exchange mode.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorePage,
});

const EARN_TILES = [
  { label: "Flash Earn", icon: Zap, to: "/ousd" as const },
  { label: "Simple Earn", icon: Wallet, to: "/assets" as const },
  { label: "Stable Rewards", icon: Sparkles, to: "/ousd" as const },
  { label: "Onchain Earn", icon: Rocket, to: "/opentoken" as const },
  { label: "Boost", icon: Flame, to: "/airdrop" as const },
];

type Tab = "favorites" | "spot" | "futures" | "new";

const TABS: { id: Tab; label: string }[] = [
  { id: "favorites", label: "Favorites" },
  { id: "spot", label: "Spot" },
  { id: "futures", label: "Futures" },
  { id: "new", label: "New" },
];

function ExplorePage() {
  const [tab, setTab] = useState<Tab>("spot");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const fetchQuotes = useServerFn(getPerpLiveQuotes);
  const { data: quotes, isLoading } = useQuery({
    queryKey: ["exchange-explore-quotes"],
    queryFn: () => fetchQuotes(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const rows = useMemo(() => {
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
    if (tab === "futures") list = list.filter((r) => r.perp);
    if (tab === "new") list = [...list].reverse();
    if (tab === "spot") list = [...list].sort((a, b) => b.volume - a.volume);
    return expanded ? list : list.slice(0, 6);
  }, [rows, query, tab, expanded]);

  return (
    <div className="animate-page-in pb-6">
      <h1 className="sr-only">Explore markets</h1>

      <label className="mb-5 flex items-center gap-2 rounded-full bg-muted/60 px-4 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search markets, tokens"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="-mx-1 mb-6 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-none">
        {EARN_TILES.map((tile) => (
          <Link
            key={tile.label}
            to={tile.to}
            className="flex w-[76px] shrink-0 flex-col items-center gap-2 text-center press"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-muted/60">
              <tile.icon className="h-5 w-5" strokeWidth={1.85} />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-muted-foreground">
              {tile.label}
            </span>
          </Link>
        ))}
      </div>

      <div className="-mx-1 mb-2 flex items-center gap-1 overflow-x-auto px-1 pb-1 scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold press",
              tab === t.id ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-border/40">
        {isLoading && rows.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
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
              <Link
                key={r.symbol}
                to="/trade"
                search={{ market: r.symbol, mode: r.perp && tab === "futures" ? "futures" : "spot" }}
                className="flex items-center gap-3 py-3"
              >
                <TokenAvatar logoUrl={r.logo} symbol={r.symbol} name={r.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold">{r.symbol}</span>
                    <span className="text-xs text-muted-foreground">/USDT</span>
                    {r.perp && (
                      <span className="rounded bg-muted px-1 py-px text-[10px] font-bold text-muted-foreground">
                        {r.leverage}x
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{r.name}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold tabular-nums">
                    {r.price >= 1 ? formatNumber(r.price, 2) : formatNumber(r.price, 6)}
                  </span>
                  <span
                    className={cn(
                      "block text-xs font-semibold tabular-nums",
                      r.change >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {formatPct(r.change)}
                  </span>
                </span>
              </Link>
            ))}
      </div>

      {!isLoading && rows.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mx-auto mt-4 block text-sm font-semibold text-muted-foreground press"
        >
          {expanded ? "Show less" : "View more"}
        </button>
      )}
    </div>
  );
}
