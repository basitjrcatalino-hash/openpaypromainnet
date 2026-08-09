import type { SupabaseClient } from "@supabase/supabase-js";

/** One asset line inside a daily portfolio snapshot. */
export type SnapshotAsset = {
  symbol: string;
  name?: string;
  balance: number;
  priceUsd: number;
  valueUsd: number;
};

export type PortfolioSnapshot = {
  snapshot_date: string;
  total_usd: number;
  funding_usd: number;
  spot_usd: number;
  trading_usd: number;
  p2p_usd: number;
  breakdown: SnapshotAsset[];
};

export type AnalyticsRange = "7d" | "30d" | "90d" | "1y" | "all";

export const ANALYTICS_RANGES: { id: AnalyticsRange; label: string; days: number | null }[] = [
  { id: "7d", label: "7D", days: 7 },
  { id: "30d", label: "30D", days: 30 },
  { id: "90d", label: "90D", days: 90 },
  { id: "1y", label: "1Y", days: 365 },
  { id: "all", label: "ALL", days: null },
];

function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayUtc(): string {
  return utcDate(new Date());
}

/** Upsert today's portfolio snapshot (one row per user per UTC day). */
export async function recordPortfolioSnapshot(
  supabase: SupabaseClient,
  input: {
    userId: string;
    walletId?: string | null;
    totalUsd: number;
    fundingUsd?: number;
    spotUsd?: number;
    tradingUsd?: number;
    p2pUsd?: number;
    breakdown: SnapshotAsset[];
  },
): Promise<void> {
  if (!(input.totalUsd >= 0)) return;
  await supabase
    .from("portfolio_snapshots")
    .upsert(
      {
        user_id: input.userId,
        wallet_id: input.walletId ?? null,
        snapshot_date: todayUtc(),
        total_usd: input.totalUsd,
        funding_usd: input.fundingUsd ?? 0,
        spot_usd: input.spotUsd ?? 0,
        trading_usd: input.tradingUsd ?? 0,
        p2p_usd: input.p2pUsd ?? 0,
        breakdown: input.breakdown as unknown as never,
      } as never,
      { onConflict: "user_id,snapshot_date" },
    );
}

export async function fetchPortfolioSnapshots(
  supabase: SupabaseClient,
  userId: string,
  days: number | null,
): Promise<PortfolioSnapshot[]> {
  let query = supabase
    .from("portfolio_snapshots")
    .select(
      "snapshot_date, total_usd, funding_usd, spot_usd, trading_usd, p2p_usd, breakdown",
    )
    .eq("user_id", userId)
    .order("snapshot_date", { ascending: true })
    .limit(800);

  if (days != null) {
    const from = new Date(Date.now() - days * 86_400_000);
    query = query.gte("snapshot_date", utcDate(from));
  }

  const { data } = await query;
  return ((data ?? []) as unknown[]).map((r) => {
    const row = r as Record<string, unknown>;
    const raw = row.breakdown;
    return {
      snapshot_date: String(row.snapshot_date),
      total_usd: Number(row.total_usd ?? 0),
      funding_usd: Number(row.funding_usd ?? 0),
      spot_usd: Number(row.spot_usd ?? 0),
      trading_usd: Number(row.trading_usd ?? 0),
      p2p_usd: Number(row.p2p_usd ?? 0),
      breakdown: Array.isArray(raw) ? (raw as SnapshotAsset[]) : [],
    };
  });
}

export type SeriesPoint = { date: string; label: string; value: number; pnl: number };

/** Snapshot list → chart series with cumulative PnL vs the first point. */
export function buildSeries(
  snapshots: PortfolioSnapshot[],
  liveTotal?: number,
): SeriesPoint[] {
  const rows = [...snapshots];
  const today = todayUtc();
  if (liveTotal != null && Number.isFinite(liveTotal)) {
    const last = rows[rows.length - 1];
    if (last && last.snapshot_date === today) {
      last.total_usd = liveTotal;
    } else {
      rows.push({
        snapshot_date: today,
        total_usd: liveTotal,
        funding_usd: 0,
        spot_usd: 0,
        trading_usd: 0,
        p2p_usd: 0,
        breakdown: [],
      });
    }
  }
  const base = rows[0]?.total_usd ?? 0;
  return rows.map((r) => ({
    date: r.snapshot_date,
    label: new Date(`${r.snapshot_date}T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    value: r.total_usd,
    pnl: r.total_usd - base,
  }));
}

export type RangeStats = {
  start: number;
  end: number;
  changeUsd: number;
  changePct: number;
  high: number;
  low: number;
};

export function rangeStats(series: SeriesPoint[]): RangeStats {
  if (series.length === 0) {
    return { start: 0, end: 0, changeUsd: 0, changePct: 0, high: 0, low: 0 };
  }
  const values = series.map((p) => p.value);
  const start = values[0] ?? 0;
  const end = values[values.length - 1] ?? 0;
  const changeUsd = end - start;
  return {
    start,
    end,
    changeUsd,
    changePct: start > 0 ? (changeUsd / start) * 100 : 0,
    high: Math.max(...values),
    low: Math.min(...values),
  };
}

export type AssetPnlRow = {
  symbol: string;
  name: string;
  balance: number;
  priceUsd: number;
  valueUsd: number;
  change24hPct: number;
  pnl24hUsd: number;
  /** Change vs the oldest snapshot in range (null when no history yet). */
  rangePnlUsd: number | null;
  allocationPct: number;
};

/** Per-token gain/loss table: 24h PnL from price change, range PnL from snapshots. */
export function buildAssetPnl(
  assets: { symbol: string; name: string; balance: number; priceUsd: number; change24h: number }[],
  firstSnapshot?: PortfolioSnapshot | null,
): AssetPnlRow[] {
  const held = assets.filter((a) => a.balance > 0 && a.priceUsd > 0);
  const total = held.reduce((s, a) => s + a.balance * a.priceUsd, 0);
  const baseline = new Map<string, number>();
  for (const b of firstSnapshot?.breakdown ?? []) {
    baseline.set(b.symbol.toUpperCase(), Number(b.valueUsd ?? 0));
  }
  return held
    .map((a) => {
      const valueUsd = a.balance * a.priceUsd;
      const before = baseline.get(a.symbol.toUpperCase());
      return {
        symbol: a.symbol,
        name: a.name,
        balance: a.balance,
        priceUsd: a.priceUsd,
        valueUsd,
        change24hPct: a.change24h,
        pnl24hUsd: (valueUsd * a.change24h) / 100,
        rangePnlUsd: before == null ? null : valueUsd - before,
        allocationPct: total > 0 ? (valueUsd / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.valueUsd - a.valueUsd);
}
