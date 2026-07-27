/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Wallet, Shield } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { formatUSD, formatNumber, formatPct, timeAgo } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import {
  CategoryPills,
  type OtFilter,
  OtSkeletonGrid,
  TokenCard,
  TrendingRail,
  ViewToggle,
} from "@/components/opentoken";
import { OT_CATEGORIES } from "@/lib/opentoken/bonding-curve";

export const Route = createFileRoute("/_authenticated/opentoken/")({
  head: () => ({ meta: [{ title: "OpenToken — OpenPay Pro" }] }),
  component: OpenTokenHome,
});

function OpenTokenHome() {
  const { user } = Route.useRouteContext();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<OtFilter>("all");
  const [view, setView] = useState<"grid" | "table">("grid");

  const { data: isStaff } = useQuery({
    queryKey: ["ot-is-staff", user.id],
    queryFn: async () => {
      const [{ data: a }, { data: m }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "moderator" }),
      ]);
      return !!(a || m);
    },
  });

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["ot-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("*")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        const { data: fallback } = await supabase
          .from("tokens")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        return fallback ?? [];
      }
      return data ?? [];
    },
  });

  const trending = useMemo(
    () =>
      [...tokens].sort((a: any, b: any) => Number(b.volume_24h) - Number(a.volume_24h)).slice(0, 8),
    [tokens],
  );
  const featured = useMemo(() => tokens.filter((t: any) => t.is_featured).slice(0, 8), [tokens]);
  const graduated = useMemo(
    () => tokens.filter((t: any) => t.status === "graduated").slice(0, 8),
    [tokens],
  );
  const topMcap = useMemo(
    () =>
      [...tokens].sort((a: any, b: any) => Number(b.market_cap) - Number(a.market_cap)).slice(0, 6),
    [tokens],
  );

  const list = useMemo(() => {
    let l = tokens as any[];
    if (q) {
      const qq = q.toLowerCase();
      l = l.filter(
        (t) =>
          t.name?.toLowerCase().includes(qq) ||
          t.symbol?.toLowerCase().includes(qq) ||
          t.description?.toLowerCase().includes(qq),
      );
    }
    if (filter === "trending")
      l = [...l].sort((a, b) => Number(b.volume_24h) - Number(a.volume_24h));
    else if (filter === "new")
      l = [...l].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (filter === "verified") l = l.filter((t) => t.is_verified);
    else if (filter === "graduated") l = l.filter((t) => t.status === "graduated");
    else if ((OT_CATEGORIES as readonly string[]).includes(filter)) {
      l = l.filter((t) => t.category === filter);
    }
    return l;
  }, [tokens, q, filter]);

  return (
    <div className="animate-page-in space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">OpenToken</h1>
          <p className="text-sm text-muted-foreground">
            Fair-launch community tokens on OpenPay · powered by Pi
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/opentoken/portfolio">
              <Wallet className="mr-1.5 h-4 w-4" /> Portfolio
            </Link>
          </Button>
          {isStaff && (
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/opentoken/admin">
                <Shield className="mr-1.5 h-4 w-4" /> Admin
              </Link>
            </Button>
          )}
          <Button
            asChild
            className="rounded-full bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Link to="/opentoken/create">
              <Plus className="mr-1.5 h-4 w-4" /> Create
            </Link>
          </Button>
        </div>
      </div>

      {featured.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Featured
          </h2>
          <TrendingRail tokens={featured} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Trending now
        </h2>
        <TrendingRail tokens={trending} />
      </section>

      {graduated.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recently graduated
          </h2>
          <TrendingRail tokens={graduated} />
        </section>
      )}

      {topMcap.length > 0 && (
        <Card className="glass-strong rounded-3xl border-border/60 p-4">
          <h2 className="text-sm font-semibold">Highest market cap</h2>
          <ul className="mt-3 divide-y divide-border/50">
            {topMcap.map((t: any, i: number) => (
              <li key={t.id}>
                <Link
                  to="/opentoken/$tokenId"
                  params={{ tokenId: t.id }}
                  className="flex items-center gap-3 py-2.5 hover:opacity-90"
                >
                  <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
                  <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
                    {t.logo_url ? (
                      <img src={t.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      t.symbol.slice(0, 2)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">${t.symbol}</div>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    {formatUSD(t.market_cap, { compact: true })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Explore coins
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative min-w-45 flex-1 sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search coins…"
                className="rounded-full pl-9"
              />
            </div>
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
        <CategoryPills value={filter} onChange={setFilter} />

        {isLoading ? (
          <OtSkeletonGrid />
        ) : list.length === 0 ? (
          <Card className="rounded-3xl border-border/60 p-10 text-center text-sm text-muted-foreground">
            No tokens yet. Be the first to launch on OpenToken.
            <div className="mt-4">
              <Button asChild className="rounded-full bg-gradient-primary text-primary-foreground">
                <Link to="/opentoken/create">Create coin</Link>
              </Button>
            </div>
          </Card>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {list.map((t: any) => (
              <TokenCard key={t.id} token={t} />
            ))}
          </div>
        ) : (
          <Card className="glass-strong overflow-hidden rounded-3xl border-border/60">
            <div className="hidden grid-cols-12 gap-2 border-b border-border/60 px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground md:grid">
              <div className="col-span-4">Token</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">24h</div>
              <div className="col-span-2 text-right">Volume</div>
              <div className="col-span-2 text-right">MCap</div>
            </div>
            <ul className="divide-y divide-border/50">
              {list.map((t: any) => (
                <li key={t.id}>
                  <Link
                    to="/opentoken/$tokenId"
                    params={{ tokenId: t.id }}
                    className="grid grid-cols-12 items-center gap-2 px-4 py-3 hover:bg-accent/40"
                  >
                    <div className="col-span-12 flex items-center gap-3 md:col-span-4">
                      <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
                        {t.logo_url ? (
                          <img src={t.logo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          t.symbol.slice(0, 2)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          ${t.symbol} · {timeAgo(t.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-4 text-sm tabular-nums md:col-span-2 md:text-right">
                      {formatNumber(t.price_usd, 6)}
                    </div>
                    <div
                      className={cn(
                        "col-span-4 text-sm tabular-nums md:col-span-2 md:text-right",
                        Number(t.change_24h) >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {formatPct(t.change_24h)}
                    </div>
                    <div className="col-span-4 text-sm tabular-nums md:col-span-2 md:text-right">
                      {formatUSD(t.volume_24h, { compact: true })}
                    </div>
                    <div className="col-span-4 text-sm tabular-nums md:col-span-2 md:text-right">
                      {formatUSD(t.market_cap, { compact: true })}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
