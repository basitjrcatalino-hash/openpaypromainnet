/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Star } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatNumber, formatUSD, fetchActiveWallet, timeAgo } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import { TokenCard } from "@/components/opentoken";

export const Route = createFileRoute("/_authenticated/opentoken_/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio — OpenToken" }] }),
  component: OpenTokenPortfolio,
});

function OpenTokenPortfolio() {
  const { user } = Route.useRouteContext();

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () =>
      fetchActiveWallet<{ id: string; pi_balance: number; ousd_balance: number }>(
        supabase,
        user.id,
        "id, pi_balance, ousd_balance",
      ),
  });

  const { data: holdings = [], isLoading } = useQuery({
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

  const { data: activity = [] } = useQuery({
    queryKey: ["ot-my-trades", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_trades")
        .select("id, side, pi_amount, token_amount, created_at, token_id, tokens(name, symbol)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const { totalValue, pnlApprox } = useMemo(() => {
    let value = 0;
    let cost = 0;
    for (const h of holdings as any[]) {
      const price = Number(h.tokens?.price_usd ?? 0);
      const bal = Number(h.balance ?? 0);
      value += price * bal;
      cost += bal * price * 0.9; // approx without avg cost basis
    }
    return { totalValue: value, pnlApprox: value - cost };
  }, [holdings]);

  return (
    <div className="animate-page-in space-y-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link to="/opentoken">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-sm text-muted-foreground">OpenToken holdings & activity</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl border-border/60 p-4">
          <div className="text-xs text-muted-foreground">Wallet Pi</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {formatNumber(wallet?.pi_balance, 4)} π
          </div>
        </Card>
        <Card className="rounded-2xl border-border/60 p-4">
          <div className="text-xs text-muted-foreground">Token value</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {formatUSD(totalValue, { compact: true })}
          </div>
        </Card>
        <Card className="rounded-2xl border-border/60 p-4">
          <div className="text-xs text-muted-foreground">Est. move</div>
          <div
            className={cn(
              "mt-1 text-xl font-semibold tabular-nums",
              pnlApprox >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {pnlApprox >= 0 ? "+" : ""}
            {formatUSD(pnlApprox, { compact: true })}
          </div>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Holdings</h2>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : holdings.length === 0 ? (
          <Card className="rounded-2xl border-border/60 p-8 text-center text-sm text-muted-foreground">
            No OpenToken holdings yet.{" "}
            <Link to="/opentoken" className="text-primary hover:underline">
              Explore coins
            </Link>
          </Card>
        ) : (
          <Card className="overflow-hidden rounded-2xl border-border/60">
            <ul className="divide-y divide-border/50">
              {(holdings as any[]).map((h) => {
                const t = h.tokens;
                const val = Number(h.balance) * Number(t.price_usd ?? 0);
                return (
                  <li key={h.token_id}>
                    <Link
                      to="/opentoken/$tokenId"
                      params={{ tokenId: t.id }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40"
                    >
                      <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                        {t.logo_url ? (
                          <img src={t.logo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          t.symbol.slice(0, 2)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatNumber(h.balance, 4)} ${t.symbol}
                        </div>
                      </div>
                      <div className="text-right text-sm tabular-nums">{formatUSD(val)}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      {favorites.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Star className="h-4 w-4 text-warning" /> Favorites
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {favorites.map((t: any) => (
              <TokenCard key={t.id} token={t} compact />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        <Card className="overflow-hidden rounded-2xl border-border/60">
          {activity.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No trades yet</div>
          ) : (
            <ul className="divide-y divide-border/50">
              {(activity as any[]).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <span className={t.side === "buy" ? "text-success" : "text-destructive"}>
                      {t.side === "buy" ? "Bought" : "Sold"}
                    </span>{" "}
                    {formatNumber(t.token_amount, 2)} ${(t.tokens as any)?.symbol}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(t.pi_amount, 4)} π · {timeAgo(t.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
