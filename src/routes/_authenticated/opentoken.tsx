/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Wallet, Shield, BadgeCheck, ChevronDown } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUSD, formatNumber, formatPct } from "@/lib/wallet-utils";
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

    // category filter
    if (catFilter !== "all") {
      if (catFilter === "verified") l = l.filter((t) => t.is_verified);
      else if (catFilter === "graduated") l = l.filter((t) => t.status === "graduated");
      else if ((OT_CATEGORIES as readonly string[]).includes(catFilter))
        l = l.filter((t) => t.category === catFilter);
    }

    // search
    if (q) {
      const qq = q.toLowerCase();
      l = l.filter(
        (t) =>
          t.name?.toLowerCase().includes(qq) ||
          t.symbol?.toLowerCase().includes(qq),
      );
    }

    // sort
    if (sort === "rank" || sort === "trending")
      l = [...l].sort((a, b) => Number(b.market_cap ?? 0) - Number(a.market_cap ?? 0));
    else if (sort === "new")
      l = [...l].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sort === "gainers")
      l = [...l].sort((a, b) => Number(b.change_24h ?? 0) - Number(a.change_24h ?? 0));

    return l;
  }, [tokens, q, sort, catFilter]);

  /* ── render ───────────────────────────────────────────────────── */
  return (
    <div className="ot-phantom mx-auto min-h-screen max-w-2xl animate-page-in">
      {/* ── top bar ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl">
        {/* top nav row */}
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h1 className="text-lg font-bold text-white">Trade</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-zinc-400 hover:text-white"
              onClick={() => setShowSearch((v) => !v)}
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-400 hover:text-white">
              <Link to="/opentoken/portfolio">
                <Wallet className="h-4 w-4" />
              </Link>
            </Button>
            {isStaff && (
              <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-400 hover:text-white">
                <Link to="/opentoken/admin">
                  <Shield className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* category pills — horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                  ? "bg-white text-black"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* search bar (collapsible) */}
        {showSearch && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search OpenToken…"
                autoFocus
                className="rounded-full border-zinc-800 bg-zinc-900 pl-9 text-white placeholder:text-zinc-500 focus-visible:ring-zinc-700"
              />
            </div>
          </div>
        )}

        {/* sort / time pills */}
        <div className="flex items-center gap-2 px-4 pb-3">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSort(opt.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                sort === opt.id
                  ? "border-zinc-600 bg-zinc-800 text-white"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
              )}
            >
              {opt.label}
              {sort === opt.id && <ChevronDown className="h-3 w-3" />}
            </button>
          ))}

          <div className="ml-auto flex gap-1 rounded-full border border-zinc-800 p-0.5">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTime(t)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  _time === t
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── token list ───────────────────────────────────────────── */}
      <div className="divide-y divide-zinc-900">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <div className="h-4 w-4 rounded bg-zinc-800" />
              <div className="h-10 w-10 rounded-full bg-zinc-800" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-zinc-800" />
                <div className="h-3 w-16 rounded bg-zinc-800" />
              </div>
              <div className="space-y-1.5 text-right">
                <div className="ml-auto h-3.5 w-16 rounded bg-zinc-800" />
                <div className="ml-auto h-3 w-12 rounded bg-zinc-800" />
              </div>
            </div>
          ))
        ) : list.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-zinc-500">No tokens found</p>
            <Button asChild className="mt-4 rounded-full bg-purple-600 text-white hover:bg-purple-500">
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
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-900/60 active:bg-zinc-900"
              >
                {/* rank */}
                <span className="w-5 text-center text-xs font-semibold text-zinc-500">
                  {idx + 1}
                </span>

                {/* avatar */}
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-800">
                  {t.logo_url ? (
                    <img src={t.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-linear-to-br from-purple-600 to-purple-900 text-xs font-bold text-white">
                      {t.symbol?.slice(0, 2)}
                    </div>
                  )}
                  {t.is_verified && (
                    <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-black text-purple-400" />
                  )}
                </div>

                {/* name + mcap */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-white">{t.name}</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {mcap > 0 ? `₱${formatNumber(mcap, mcap >= 1e6 ? 0 : 2)}${mcap >= 1e9 ? "B" : mcap >= 1e6 ? "M" : mcap >= 1e3 ? "K" : ""} MC` : `$${t.symbol}`}
                  </div>
                </div>

                {/* price + change */}
                <div className="text-right">
                  <div className="text-sm font-medium tabular-nums text-white">
                    ₱{formatNumber(t.price_usd, t.price_usd < 0.01 ? 8 : t.price_usd < 1 ? 4 : 2)}
                  </div>
                  <div
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      change >= 0 ? "text-green-400" : "text-red-400",
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

      {/* ── FAB: create token ────────────────────────────────────── */}
      <Link
        to="/opentoken/create"
        className="fixed bottom-20 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-900/40 transition hover:bg-purple-500 md:bottom-6 md:right-8"
      >
        <Plus className="h-5 w-5" />
      </Link>
    </div>
  );
}
