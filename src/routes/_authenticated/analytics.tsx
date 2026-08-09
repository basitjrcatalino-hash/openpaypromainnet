import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, LineChart, PieChart, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatCurrency, useCurrency } from "@/lib/currency";
import { fetchActiveWallet } from "@/lib/wallet-utils";
import { MAJOR_TOKENS, fetchMajorMarkets, majorMarketById } from "@/lib/major-tokens";
import { LEDGER_MAJOR_IDS, readMajorBalance } from "@/lib/ledger-majors";
import { PageHeader } from "@/components/wallet/PageHeader";
import { TokenAvatar } from "@/components/wallet/TokenAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ANALYTICS_RANGES,
  buildAssetPnl,
  buildSeries,
  fetchPortfolioSnapshots,
  rangeStats,
  recordPortfolioSnapshot,
  type AnalyticsRange,
} from "@/lib/portfolio-analytics";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Portfolio Analytics — OpenPay Pro" },
      {
        name: "description",
        content:
          "Track portfolio value, realized and unrealized PnL, per-token gains and losses, and full history charts across every OpenPay Pro account.",
      },
      { property: "og:title", content: "Portfolio Analytics — OpenPay Pro" },
      {
        property: "og:description",
        content: "Gains, losses, allocation and history charts for every token you hold.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

type WalletRow = { id: string; ousd_balance?: number | null } & Record<string, unknown>;

function AnalyticsPage() {
  const { user } = Route.useRouteContext();
  const { code: currency } = useCurrency();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const rangeDef = ANALYTICS_RANGES.find((r) => r.id === range) ?? ANALYTICS_RANGES[1];

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () => fetchActiveWallet<WalletRow>(supabase, user.id),
  });

  const { data: majorMarkets } = useQuery({
    queryKey: ["major-markets"],
    staleTime: 60_000,
    queryFn: fetchMajorMarkets,
  });

  const { data: holdings = [] } = useQuery({
    queryKey: ["holdings", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("token_holdings")
        .select("balance, tokens:token_id(name, symbol, price_usd, change_24h, logo_url)")
        .eq("wallet_id", wallet!.id);
      return (data ?? []) as {
        balance: number;
        tokens: {
          name: string;
          symbol: string;
          price_usd: number | null;
          change_24h: number | null;
          logo_url: string | null;
        } | null;
      }[];
    },
  });

  const assets = useMemo(() => {
    const rows: {
      symbol: string;
      name: string;
      balance: number;
      priceUsd: number;
      change24h: number;
      logoUrl: string | null;
    }[] = [];
    if (wallet) {
      rows.push({
        symbol: "OUSD",
        name: "OpenUSD",
        balance: Number(wallet.ousd_balance ?? 0),
        priceUsd: 1,
        change24h: 0,
        logoUrl: null,
      });
      for (const id of LEDGER_MAJOR_IDS) {
        const def = MAJOR_TOKENS[id];
        const m = majorMarketById(majorMarkets, id);
        rows.push({
          symbol: def.symbol,
          name: def.name,
          balance: readMajorBalance(wallet as Record<string, unknown>, id),
          priceUsd: m.price,
          change24h: m.change24h,
          logoUrl: def.logoUrl,
        });
      }
    }
    for (const h of holdings) {
      if (!h.tokens) continue;
      rows.push({
        symbol: h.tokens.symbol,
        name: h.tokens.name,
        balance: Number(h.balance ?? 0),
        priceUsd: Number(h.tokens.price_usd ?? 0),
        change24h: Number(h.tokens.change_24h ?? 0),
        logoUrl: h.tokens.logo_url,
      });
    }
    return rows;
  }, [wallet, majorMarkets, holdings]);

  const totalUsd = assets.reduce((s, a) => s + a.balance * a.priceUsd, 0);
  const pnl24h = assets.reduce(
    (s, a) => s + (a.balance * a.priceUsd * a.change24h) / 100,
    0,
  );

  const { data: snapshots = [], isLoading: snapsLoading } = useQuery({
    queryKey: ["portfolio-snapshots", user.id, rangeDef.days],
    queryFn: () => fetchPortfolioSnapshots(supabase, user.id, rangeDef.days),
    staleTime: 60_000,
  });

  /** Record today's value once we know the live total. */
  useEffect(() => {
    if (!wallet?.id || !(totalUsd > 0)) return;
    const key = `op.snapshot.${user.id}.${new Date().toISOString().slice(0, 10)}`;
    try {
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    void recordPortfolioSnapshot(supabase, {
      userId: user.id,
      walletId: wallet.id,
      totalUsd,
      breakdown: assets
        .filter((a) => a.balance > 0 && a.priceUsd > 0)
        .map((a) => ({
          symbol: a.symbol,
          name: a.name,
          balance: a.balance,
          priceUsd: a.priceUsd,
          valueUsd: a.balance * a.priceUsd,
        })),
    });
  }, [wallet?.id, totalUsd, assets, user.id]);

  const series = useMemo(() => buildSeries(snapshots, totalUsd), [snapshots, totalUsd]);
  const stats = useMemo(() => rangeStats(series), [series]);
  const assetRows = useMemo(
    () => buildAssetPnl(assets, snapshots[0] ?? null),
    [assets, snapshots],
  );

  const { data: perp = [] } = useQuery({
    queryKey: ["analytics-perp", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("perp_positions")
        .select("id, market, side, realized_pnl, closed_at, size_usd, leverage")
        .eq("user_id", user.id)
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(50);
      return (data ?? []) as {
        id: string;
        market: string;
        side: string;
        realized_pnl: number | null;
        closed_at: string | null;
        size_usd: number | null;
        leverage: number | null;
      }[];
    },
  });

  const { data: fills = [] } = useQuery({
    queryKey: ["analytics-fills", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("spot_fills")
        .select("id, market, side, price, amount, quote_amount, fee_usd, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as {
        id: string;
        market: string;
        side: string;
        price: number | null;
        amount: number | null;
        quote_amount: number | null;
        fee_usd: number | null;
        created_at: string;
      }[];
    },
  });

  const realizedPnl = perp.reduce((s, p) => s + Number(p.realized_pnl ?? 0), 0);
  const totalFees = fills.reduce((s, f) => s + Number(f.fee_usd ?? 0), 0);

  const money = (n: number) => formatCurrency(n, currency);
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${money(Math.abs(n))}`;

  return (
    <div className="mx-auto w-full max-w-5xl animate-page-in pb-10">
      <PageHeader title="Analytics" subtitle="Track gains, losses and history" />

      {/* Summary */}
      <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total value" value={money(totalUsd)} icon={Wallet} />
        <StatCard
          label="Today's PnL"
          value={signed(pnl24h)}
          tone={pnl24h >= 0 ? "up" : "down"}
          icon={pnl24h >= 0 ? ArrowUpRight : ArrowDownRight}
        />
        <StatCard
          label={`${rangeDef.label} PnL`}
          value={signed(stats.changeUsd)}
          hint={`${stats.changePct >= 0 ? "+" : ""}${stats.changePct.toFixed(2)}%`}
          tone={stats.changeUsd >= 0 ? "up" : "down"}
          icon={LineChart}
        />
        <StatCard
          label="Realized (Futures)"
          value={signed(realizedPnl)}
          hint={`Fees ${money(totalFees)}`}
          tone={realizedPnl >= 0 ? "up" : "down"}
          icon={PieChart}
        />
      </section>

      {/* Range tabs */}
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1">
        {ANALYTICS_RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-bold press",
              range === r.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Value history */}
      <section className="mb-4 rounded-2xl bg-card p-3">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-bold">Portfolio value</h2>
          <span className="text-xs text-muted-foreground">
            High {money(stats.high)} · Low {money(stats.low)}
          </span>
        </div>
        {snapsLoading ? (
          <Skeleton className="h-56 w-full rounded-xl" />
        ) : series.length < 2 ? (
          <EmptyChart note="History starts building today — come back tomorrow for your first trend line." />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v: number) => money(Number(v))}
                />
                <Tooltip
                  formatter={(v: number | string) => money(Number(v))}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#pv)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* PnL bars per token */}
      <section className="mb-4 rounded-2xl bg-card p-3">
        <h2 className="mb-2 px-1 text-sm font-bold">Gains &amp; losses by token (24h)</h2>
        {assetRows.length === 0 ? (
          <EmptyChart note="No assets yet — fund your wallet to start tracking performance." />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={assetRows.map((a) => ({ symbol: a.symbol, pnl: a.pnl24hUsd }))}
                margin={{ top: 6, right: 6, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis dataKey="symbol" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v: number) => money(Number(v))}
                />
                <Tooltip
                  formatter={(v: number | string) => money(Number(v))}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="pnl" radius={[4, 4, 4, 4]}>
                  {assetRows.map((a) => (
                    <Cell
                      key={a.symbol}
                      fill={a.pnl24hUsd >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Per-token table */}
      <section className="mb-4 rounded-2xl bg-card p-3">
        <h2 className="mb-2 px-1 text-sm font-bold">Holdings performance</h2>
        <div className="space-y-1">
          {assetRows.map((a) => (
            <div key={a.symbol} className="flex items-center gap-3 rounded-xl px-1 py-2">
              <TokenAvatar
                symbol={a.symbol}
                name={a.name}
                logoUrl={
                  assets.find((x) => x.symbol === a.symbol)?.logoUrl ?? null
                }
                className="h-9 w-9"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{a.name}</div>
                <div className="text-xs text-muted-foreground">
                  {a.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {a.symbol} ·{" "}
                  {a.allocationPct.toFixed(1)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{money(a.valueUsd)}</div>
                <div
                  className={cn(
                    "text-xs font-semibold",
                    a.pnl24hUsd >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {signed(a.pnl24hUsd)} ({a.change24hPct >= 0 ? "+" : ""}
                  {a.change24hPct.toFixed(2)}%)
                </div>
                {a.rangePnlUsd != null ? (
                  <div className="text-[11px] text-muted-foreground">
                    {rangeDef.label} {signed(a.rangePnlUsd)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {assetRows.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">No holdings yet.</p>
          ) : null}
        </div>
      </section>

      {/* Trade history */}
      <section className="rounded-2xl bg-card p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-bold">Realized history</h2>
          <Link to="/trade" className="text-xs font-semibold text-primary">
            Trade
          </Link>
        </div>
        <div className="space-y-1">
          {perp.map((p) => (
            <HistoryRow
              key={p.id}
              title={`${p.market} Perp · ${p.side}`}
              sub={p.closed_at ? new Date(p.closed_at).toLocaleString() : "—"}
              value={signed(Number(p.realized_pnl ?? 0))}
              positive={Number(p.realized_pnl ?? 0) >= 0}
            />
          ))}
          {fills.map((f) => (
            <HistoryRow
              key={f.id}
              title={`${f.market} Spot · ${f.side}`}
              sub={new Date(f.created_at).toLocaleString()}
              value={money(Number(f.quote_amount ?? 0))}
              positive={f.side === "sell"}
            />
          ))}
          {perp.length === 0 && fills.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">
              No closed trades yet. Spot fills and futures results appear here.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "up" | "down";
  icon: typeof Wallet;
}) {
  return (
    <div className="rounded-2xl bg-card p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "text-lg font-bold tabular-nums",
          tone === "up" && "text-success",
          tone === "down" && "text-destructive",
        )}
      >
        {value}
      </div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function HistoryRow({
  title,
  sub,
  value,
  positive,
}: {
  title: string;
  sub: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-1 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
      <div className={cn("text-sm font-semibold", positive ? "text-success" : "text-destructive")}>
        {value}
      </div>
    </div>
  );
}

function EmptyChart({ note }: { note: string }) {
  return (
    <div className="grid h-40 place-items-center rounded-xl bg-muted/30 px-6 text-center text-sm text-muted-foreground">
      {note}
    </div>
  );
}
