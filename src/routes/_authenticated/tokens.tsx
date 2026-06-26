import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingUp, TrendingDown, Star, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatUSD, formatNumber, formatPct } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tokens")({
  head: () => ({ meta: [{ title: "Tokens — OpenPay Pro Wallet" }] }),
  component: TokensPage,
});

type Filter = "all" | "trending" | "gainers" | "losers" | "new";

function TokensPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["tokens-all"],
    queryFn: async () => {
      const { data } = await supabase.from("tokens").select("*").order("market_cap", { ascending: false });
      return data ?? [];
    },
  });

  const list = useMemo(() => {
    let l = tokens as any[];
    if (q) l = l.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()) || t.symbol.toLowerCase().includes(q.toLowerCase()));
    if (filter === "trending") l = [...l].sort((a, b) => Number(b.volume_24h) - Number(a.volume_24h));
    if (filter === "gainers") l = [...l].sort((a, b) => Number(b.change_24h) - Number(a.change_24h));
    if (filter === "losers") l = [...l].sort((a, b) => Number(a.change_24h) - Number(b.change_24h));
    if (filter === "new") l = [...l].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return l;
  }, [tokens, q, filter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Tokens</h1>
          <p className="text-sm text-muted-foreground">Discover, trade and launch tokens</p>
        </div>
        <Button asChild className="rounded-full bg-gradient-primary text-primary-foreground shadow-glow">
          <Link to="/tokens/create"><Plus className="mr-1.5 h-4 w-4" /> Create Token</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tokens" className="pl-9" />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="gainers">Gainers</TabsTrigger>
            <TabsTrigger value="losers">Losers</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="glass-strong overflow-hidden rounded-3xl border-border/60">
        <div className="hidden grid-cols-12 gap-2 border-b border-border/60 px-5 py-3 text-xs uppercase tracking-wide text-muted-foreground md:grid">
          <div className="col-span-4">Token</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-2 text-right">24h</div>
          <div className="col-span-2 text-right">Volume</div>
          <div className="col-span-2 text-right">Market Cap</div>
        </div>
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : list.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No tokens match.</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {list.map((t) => (
              <li key={t.id} className="grid grid-cols-12 items-center gap-2 px-5 py-3 hover:bg-accent/40">
                <div className="col-span-12 flex items-center gap-3 md:col-span-4">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                    {t.symbol.slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      {t.name}
                      {t.is_featured && <Star className="h-3 w-3 fill-warning text-warning" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.symbol}</div>
                  </div>
                </div>
                <div className="col-span-4 text-left text-sm tabular-nums md:col-span-2 md:text-right">{formatUSD(t.price_usd)}</div>
                <div className={cn("col-span-4 inline-flex items-center justify-end gap-1 text-sm tabular-nums md:col-span-2",
                  Number(t.change_24h) >= 0 ? "text-success" : "text-destructive")}>
                  {Number(t.change_24h) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {formatPct(t.change_24h)}
                </div>
                <div className="col-span-4 text-right text-sm tabular-nums text-muted-foreground md:col-span-2">{formatUSD(t.volume_24h, { compact: true })}</div>
                <div className="col-span-12 flex items-center justify-end gap-2 text-sm tabular-nums text-muted-foreground md:col-span-2">
                  <span>{formatUSD(t.market_cap, { compact: true })}</span>
                  <Button asChild size="sm" variant="outline" className="ml-2 rounded-full">
                    <Link to="/swap">Trade</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
