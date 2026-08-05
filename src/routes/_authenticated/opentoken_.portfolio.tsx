/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BadgeCheck,
  Compass,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/wallet/PageHeader";
import { TokenCard } from "@/components/opentoken";
import {
  formatNumber,
  formatOUSD,
  formatPct,
  fetchActiveWallet,
  timeAgo,
} from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import {
  OT_CATEGORY_LABELS,
  type OtCategory,
} from "@/lib/opentoken/bonding-curve";

export const Route = createFileRoute("/_authenticated/opentoken_/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio — OpenToken" }] }),
  component: OpenTokenPortfolio,
});

function OpenTokenPortfolio() {
  const { user } = Route.useRouteContext();

  const { data: wallet, isPending: walletPending } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () =>
      fetchActiveWallet<{ id: string; pi_balance: number; ousd_balance: number }>(
        supabase,
        user.id,
        "id, pi_balance, ousd_balance",
      ),
  });

  const { data: holdings = [], isLoading: holdingsLoading } = useQuery({
    queryKey: ["ot-portfolio", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("token_holdings")
        .select("balance, token_id, tokens(*)")
        .eq("wallet_id", wallet!.id)
        .gt("balance", 0);
      if (error) throw error;
      return (data ?? []).filter((h: any) => h.tokens && !h.tokens.is_hidden);
    },
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["ot-favorites", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_favorites")
        .select("token_id, tokens(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return (data ?? []).map((f: any) => f.tokens).filter(Boolean);
    },
  });

  const { data: activity = [], isPending: activityPending } = useQuery({
    queryKey: ["ot-my-trades", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_trades")
        .select(
          "id, side, pi_amount, token_amount, created_at, token_id, tokens(name, symbol, logo_url, is_verified)",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const { rows, totalValue, change24hUsd, change24hPct } = useMemo(() => {
    const mapped = (holdings as any[]).map((h) => {
      const t = h.tokens;
      const bal = Number(h.balance ?? 0);
      const price = Number(t?.price_usd ?? 0);
      const change = Number(t?.change_24h ?? 0);
      const value = bal * price;
      return { h, t, bal, price, change, value };
    });
    mapped.sort((a, b) => b.value - a.value);
    const total = mapped.reduce((s, r) => s + r.value, 0);
    const delta = mapped.reduce((s, r) => {
      // Reconstruct prior value from % change when available
      if (!Number.isFinite(r.change) || r.change === -100) return s;
      const prior = r.value / (1 + r.change / 100);
      return s + (r.value - prior);
    }, 0);
    const pct = total - delta > 0 ? (delta / (total - delta)) * 100 : 0;
    return {
      rows: mapped,
      totalValue: total,
      change24hUsd: delta,
      change24hPct: pct,
    };
  }, [holdings]);

  const ousdBal = Number(wallet?.ousd_balance ?? 0);
  const isLoading = walletPending || (!!wallet?.id && holdingsLoading);
  const up = change24hUsd >= 0;

  return (
    <div className="ot-phantom ph-page mx-auto w-full max-w-lg animate-page-in pb-8 md:max-w-2xl">
      <PageHeader
        title="Portfolio"
        backTo="/opentoken"
        right={
          <Link
            to="/opentoken"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground press"
            aria-label="Explore tokens"
          >
            <Compass className="h-4 w-4" />
          </Link>
        }
      />

      {/* Portfolio hero */}
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="ph-label">OpenToken value</p>
        <div className="ph-display">
          {isLoading ? (
            <span className="inline-block h-10 w-36 animate-pulse rounded-lg bg-muted" />
          ) : (
            formatOUSD(totalValue, { compact: true })
          )}
        </div>
        {!isLoading && totalValue > 0 && (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
              up ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {up ? "+" : ""}
            {formatOUSD(change24hUsd, { compact: true })}
            <span className="text-muted-foreground">·</span>
            {formatPct(change24hPct)}
            <span className="font-medium text-muted-foreground">24h</span>
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-muted/70 px-3 py-1.5 text-xs tabular-nums text-muted-foreground">
            Wallet{" "}
            <span className="font-semibold text-foreground">
              {formatNumber(ousdBal, ousdBal > 0 && ousdBal < 1 ? 4 : 2)} OUSD
            </span>
          </span>
          {rows.length > 0 && (
            <span className="rounded-full bg-muted/70 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{rows.length}</span>{" "}
              {rows.length === 1 ? "holding" : "holdings"}
            </span>
          )}
        </div>
      </div>

      {/* Holdings */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-semibold">Holdings</h2>
          {rows.length > 0 && (
            <Link
              to="/opentoken"
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary press"
            >
              Trade
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {isLoading ? (
          <HoldingsSkeleton />
        ) : rows.length === 0 ? (
          <EmptyPanel
            title="No holdings yet"
            body="Buy a coin on the bonding curve to see it here."
            actionLabel="Explore coins"
            actionTo="/opentoken"
          />
        ) : (
          <ul className="animate-in fade-in duration-300">
            {rows.map(({ h, t, bal, price, change, value }) => {
              const share = totalValue > 0 ? (value / totalValue) * 100 : 0;
              const cat = (t.category as OtCategory) || null;
              return (
                <li key={h.token_id}>
                  <Link
                    to="/opentoken/$tokenId"
                    params={{ tokenId: t.id }}
                    className="ph-row press"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-11 w-11 shrink-0">
                        <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                          {t.logo_url ? (
                            <img
                              src={t.logo_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            t.symbol?.slice(0, 2)
                          )}
                        </div>
                        {t.is_verified && (
                          <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="ph-row-title truncate">{t.name}</span>
                          {cat && (
                            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {OT_CATEGORY_LABELS[cat] ?? cat}
                            </span>
                          )}
                        </div>
                        <div className="ph-row-sub tabular-nums">
                          {formatNumber(bal, bal >= 1_000_000 ? 2 : 4)} ${t.symbol}
                          <span className="mx-1 opacity-50">·</span>
                          <span
                            className={cn(
                              change >= 0 ? "text-success" : "text-destructive",
                            )}
                          >
                            {formatPct(change)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[15px] font-bold tabular-nums tracking-tight">
                        {formatOUSD(value, { compact: true })}
                      </div>
                      <div className="ph-row-sub tabular-nums">
                        {formatOUSD(price, { price: true, suffix: false })}
                        <span className="ml-1 opacity-80">
                          · {share.toFixed(0)}%
                        </span>
                      </div>
                      {/* Allocation bar */}
                      <div className="ml-auto mt-1.5 h-1 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${Math.min(100, Math.max(2, share))}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Favorites */}
      {favorites.length > 0 && (
        <section className="mt-6 space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              Favorites
            </h2>
            <span className="text-xs text-muted-foreground">{favorites.length}</span>
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4">
            {favorites.map((t: any) => (
              <div key={t.id} className="w-38 shrink-0 md:w-auto">
                <TokenCard token={t} compact />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Activity */}
      <section className="mt-6 space-y-2">
        <h2 className="px-0.5 text-sm font-semibold">Recent activity</h2>
        {activityPending ? (
          <ActivitySkeleton />
        ) : activity.length === 0 ? (
          <EmptyPanel
            title="No trades yet"
            body="Your buys and sells will show up here."
            actionLabel="Find a coin"
            actionTo="/opentoken"
            icon="star"
          />
        ) : (
          <ul className="animate-in fade-in duration-300">
            {(activity as any[]).map((t) => {
              const tok = t.tokens as any;
              const buy = t.side === "buy";
              return (
                <li key={t.id}>
                  <Link
                    to="/opentoken/$tokenId"
                    params={{ tokenId: t.token_id }}
                    className="ph-row press"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0">
                        <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                          {tok?.logo_url ? (
                            <img
                              src={tok.logo_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (tok?.symbol ?? "?").slice(0, 2)
                          )}
                        </div>
                        {tok?.is_verified && (
                          <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-background text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-semibold">
                          <span className={buy ? "text-success" : "text-destructive"}>
                            {buy ? "Bought" : "Sold"}
                          </span>{" "}
                          {formatNumber(t.token_amount, t.token_amount >= 1_000_000 ? 2 : 4)} $
                          {tok?.symbol}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tok?.name ?? "Token"} · {timeAgo(t.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                      {buy ? "−" : "+"}
                      {formatOUSD(t.pi_amount, { compact: true })}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyPanel({
  title,
  body,
  actionLabel,
  actionTo,
  icon = "compass",
}: {
  title: string;
  body: string;
  actionLabel: string;
  actionTo: "/opentoken";
  icon?: "compass" | "star";
}) {
  const Icon = icon === "star" ? Star : Compass;
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-muted/40 px-6 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      </div>
      <Button asChild className="mt-1 h-10 rounded-full px-5 font-semibold">
        <Link to={actionTo}>{actionLabel}</Link>
      </Button>
    </div>
  );
}

function HoldingsSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading holdings">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="ph-row pointer-events-none">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted/70" />
            </div>
          </div>
          <div className="space-y-1.5 text-right">
            <div className="ml-auto h-3.5 w-16 animate-pulse rounded bg-muted" />
            <div className="ml-auto h-3 w-12 animate-pulse rounded bg-muted/70" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ActivitySkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading activity">
      {Array.from({ length: 2 }).map((_, i) => (
        <li key={i} className="ph-row pointer-events-none">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted/70" />
            </div>
          </div>
          <div className="h-3.5 w-14 animate-pulse rounded bg-muted" />
        </li>
      ))}
    </ul>
  );
}
