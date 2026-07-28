/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Wallet, Shield, BadgeCheck, ChevronDown } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatOUSD, formatPct } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import { OT_CATEGORIES, OT_CATEGORY_LABELS, type OtCategory } from "@/lib/opentoken/bonding-curve";

/* ── route ────────────────────────────────────────────────────────── */
export const Route = createFileRoute("/_authenticated/opentoken")({
  head: () => ({ meta: [{ title: "OpenToken — OpenPay Pro" }] }),
  component: OpenTokenHome,
});

/* ── filter types ─────────────────────────────────────────────────── */
const SORT_OPTIONS = [
  { id: "rank", label: "Rank" },
  { id: "trending", label: "Trending" },
  { id: "new", label: "New" },
  { id: "gainers", label: "Top Gainers" },
] as const;
type SortOption = (typeof SORT_OPTIONS)[number]["id"];

const TIME_OPTIONS = ["1h", "24h", "7d"] as const;
type TimeOption = (typeof TIME_OPTIONS)[number];

/* ── main component ───────────────────────────────────────────────── */
function OpenTokenHome() {
  const { user } = Route.useRouteContext();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortOption>("rank");
  const [_time, setTime] = useState<TimeOption>("24h");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [showSearch, setShowSearch] = useState(false);

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

  /* ── derived list ─────────────────────────────────────────────── */
  const list = useMemo(() => {
    let l = tokens as any[];

    if (catFilter !== "all") {
      if (catFilter === "verified") l = l.filter((t) => t.is_verified);
      else if (catFilter === "graduated") l = l.filter((t) => t.status === "graduated");
      else if ((OT_CATEGORIES as readonly string[]).includes(catFilter))
        l = l.filter((t) => t.category === catFilter);
    }

    if (q) {
      const qq = q.toLowerCase();
      l = l.filter(
        (t) =>
          t.name?.toLowerCase().includes(qq) ||
          t.symbol?.toLowerCase().includes(qq),
      );
    }

    if (sort === "rank" || sort === "trending")
      l = [...l].sort((a, b) => Number(b.market_cap ?? 0) - Number(a.market_cap ?? 0));
    else if (sort === "new")
      l = [...l].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sort === "gainers")
      l = [...l].sort((a, b) => Number(b.change_24h ?? 0) - Number(a.change_24h ?? 0));

    return l;
  }, [tokens, q, sort, catFilter]);

  return (
    <div className="ot-phantom mx-auto w-full max-w-3xl animate-page-in pb-8 md:max-w-4xl">
      <div className="ph-header sticky top-0 z-30 -mx-4 border-b border-border/40 px-4 md:mx-0 md:rounded-2xl md:border-0">
        <div className="flex items-center justify-between pb-2 pt-3 md:px-2">
          <h1 className="text-lg font-bold text-foreground">Trade</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setShowSearch((v) => !v)}
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
              <Link to="/opentoken/portfolio">
                <Wallet className="h-4 w-4" />
              </Link>
            </Button>
            {isStaff && (
              <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
                <Link to="/opentoken/admin">
                  <Shield className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none [-ms-overflow-style:none] md:px-6 [&::-webkit-scrollbar]:hidden">
          {[
            { id: "all", label: "Featured" },
            { id: "trending", label: "Top Volume" },
            ...OT_CATEGORIES.map((c) => ({
              id: c,
              label: OT_CATEGORY_LABELS[c as OtCategory] ?? c,
            })),
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setCatFilter(pill.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                catFilter === pill.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {showSearch && (
          <div className="px-4 pb-3 md:px-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search OpenToken…"
                autoFocus
                className="rounded-full border-border bg-card pl-9 text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-4 pb-3 md:px-6">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSort(opt.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                sort === opt.id
                  ? "border-border bg-muted text-foreground"
                  : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {opt.label}
              {sort === opt.id && <ChevronDown className="h-3 w-3" />}
            </button>
          ))}

          <div className="ml-auto flex gap-1 rounded-full border border-border p-0.5">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTime(t)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  _time === t
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="divide-y divide-border/60">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 md:px-6">
              <div className="h-4 w-4 rounded bg-muted" />
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
              </div>
              <div className="space-y-1.5 text-right">
                <div className="ml-auto h-3.5 w-16 rounded bg-muted" />
                <div className="ml-auto h-3 w-12 rounded bg-muted" />
              </div>
            </div>
          ))
        ) : list.length === 0 ? (
          <div className="px-4 py-16 text-center md:px-6">
            <p className="text-sm text-muted-foreground">No tokens found</p>
            <Button asChild className="mt-4 rounded-full">
              <Link to="/opentoken/create">Create coin</Link>
            </Button>
          </div>
        ) : (
          list.map((t: any, idx: number) => {
            const change = Number(t.change_24h ?? 0);
            const mcap = Number(t.market_cap ?? 0);
            return (
              <Link
                key={t.id}
                to="/opentoken/$tokenId"
                params={{ tokenId: t.id }}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 active:bg-muted md:px-6"
              >
                <span className="w-5 text-center text-xs font-semibold text-muted-foreground">
                  {idx + 1}
                </span>

                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                  {t.logo_url ? (
                    <img src={t.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-linear-to-br from-primary to-primary/70 text-xs font-bold text-primary-foreground">
                      {t.symbol?.slice(0, 2)}
                    </div>
                  )}
                  {t.is_verified && (
                    <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background text-primary" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">{t.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {mcap > 0
                      ? `${formatOUSD(mcap, { compact: true, suffix: false })} MC`
                      : `$${t.symbol}`}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-medium tabular-nums text-foreground">
                    {formatOUSD(t.price_usd, { price: true, suffix: false })}
                  </div>
                  <div
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      change >= 0 ? "text-emerald-500" : "text-red-500",
                    )}
                  >
                    {change >= 0 ? "+" : ""}
                    {formatPct(change)}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <Link
        to="/opentoken/create"
        className="fixed bottom-20 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:opacity-90 md:bottom-6 md:right-8"
        aria-label="Create coin"
      >
        <Plus className="h-5 w-5" />
      </Link>
    </div>
  );
}
