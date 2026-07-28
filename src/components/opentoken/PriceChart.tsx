import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { formatNumber } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export type ChartTick = { created_at: string; price: number; market_cap?: number };

export const PHANTOM_PERIODS = ["1H", "1D", "1W", "1M", "YTD", "ALL"] as const;
export type PhantomPeriod = (typeof PHANTOM_PERIODS)[number];

export function PriceChart({
  ticks,
  mode = "price",
  trend,
  height = 220,
  className,
}: {
  ticks: ChartTick[];
  mode?: "price" | "mcap";
  /** Force green/red like Phantom; defaults to first→last tick direction. */
  trend?: "up" | "down";
  height?: number;
  className?: string;
}) {
  const data = useMemo(
    () =>
      [...ticks]
        .reverse()
        .map((t) => ({
          t: new Date(t.created_at).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          v: mode === "mcap" ? Number(t.market_cap ?? 0) : Number(t.price),
        })),
    [ticks, mode],
  );

  const isUp =
    trend === "up"
      ? true
      : trend === "down"
        ? false
        : data.length >= 2
          ? data[data.length - 1].v >= data[0].v
          : true;

  const strokeColor = isUp ? "#22c55e" : "#ef4444";
  const gradientId = `ph-chart-${mode}-${isUp ? "up" : "dn"}-${Math.round(height)}`;

  if (!data.length) {
    return (
      <div
        className={cn("grid place-items-center text-sm text-muted-foreground", className)}
        style={{ height }}
      >
        No chart data yet
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 0, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.32} />
              <stop offset="55%" stopColor={strokeColor} stopOpacity={0.08} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={["dataMin", "dataMax"]} hide width={0} />
          <Tooltip
            cursor={{ stroke: strokeColor, strokeWidth: 1, strokeOpacity: 0.35 }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
              color: "var(--foreground)",
              boxShadow: "0 8px 24px rgba(0,0,0,.18)",
            }}
            formatter={(v: number) => [
              mode === "mcap"
                ? formatNumber(v, 2)
                : v < 0.01
                  ? formatNumber(v, 8)
                  : formatNumber(v, 4),
              mode === "mcap" ? "MCap" : "Price",
            ]}
            labelStyle={{ color: "var(--muted-foreground)" }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={strokeColor}
            fill={`url(#${gradientId})`}
            strokeWidth={2.25}
            dot={false}
            isAnimationActive
            animationDuration={400}
            activeDot={{
              r: 4.5,
              fill: strokeColor,
              stroke: "var(--background)",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function periodSpanMs(period: string) {
  switch (period) {
    case "5M":
      return 5 * 60 * 1000;
    case "15M":
      return 15 * 60 * 1000;
    case "1H":
      return 60 * 60 * 1000;
    case "1D":
      return 24 * 60 * 60 * 1000;
    case "1W":
      return 7 * 24 * 60 * 60 * 1000;
    case "1M":
      return 30 * 24 * 60 * 60 * 1000;
    case "YTD":
      return Math.max(Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime(), 24 * 60 * 60 * 1000);
    default:
      return 365 * 24 * 60 * 60 * 1000;
  }
}

function periodPoints(period: string) {
  switch (period) {
    case "5M":
      return 40;
    case "15M":
      return 48;
    case "1H":
      return 48;
    case "1D":
      return 96;
    case "1W":
      return 120;
    case "1M":
      return 140;
    default:
      return 160;
  }
}

export function candleBucketMs(period: string) {
  switch (period) {
    case "5M":
      return 15 * 1000;
    case "15M":
      return 30 * 1000;
    case "1H":
      return 60 * 1000;
    case "1D":
      return 15 * 60 * 1000;
    case "1W":
      return 60 * 60 * 1000;
    case "1M":
      return 4 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic peg sparkline (Phantom USDC-style micro moves around $1). */
export function buildPegTicks(period: string, base = 1, seed = 1): ChartTick[] {
  return buildSyntheticTicks({
    period,
    price: base,
    changePct: 0,
    seed,
    peg: true,
  });
}

/**
 * Build a Phantom-looking series for any token.
 * Prefer real ticks when available; otherwise synthesize from price + 24h change.
 */
export function resolveChartTicks({
  period,
  ticks,
  price,
  changePct = 0,
  tokenKey = "token",
  peg = false,
}: {
  period: string;
  ticks?: ChartTick[] | null;
  price: number;
  changePct?: number;
  tokenKey?: string;
  peg?: boolean;
}): ChartTick[] {
  const span = periodSpanMs(period);
  const cutoff = Date.now() - span;
  const real = (ticks ?? [])
    .filter((t) => Number(t.price) > 0 && new Date(t.created_at).getTime() >= cutoff)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (real.length >= 3) return real;

  return buildSyntheticTicks({
    period,
    price: Math.max(price, peg ? 1 : 0.00000001),
    changePct: peg ? 0 : changePct,
    seed: hashSeed(`${tokenKey}:${period}`),
    peg,
  });
}

export function buildSyntheticTicks({
  period,
  price,
  changePct,
  seed,
  peg = false,
}: {
  period: string;
  price: number;
  changePct: number;
  seed: number;
  peg?: boolean;
}): ChartTick[] {
  const points = periodPoints(period);
  const spanMs = periodSpanMs(period);
  const now = Date.now();
  const end = Math.max(price, 1e-12);
  const start = peg ? end : Math.max(end / (1 + changePct / 100), 1e-12);
  const out: ChartTick[] = [];
  let s = (seed * 1103515245 + 12345) >>> 0;

  for (let i = 0; i < points; i++) {
    const t = i / Math.max(points - 1, 1);
    s = (s * 1664525 + 1013904223) >>> 0;
    const n1 = (s % 10000) / 10000;
    s = (s * 1664525 + 1013904223) >>> 0;
    const n2 = (s % 10000) / 10000;

    const drift = start + (end - start) * t;
    const amp = peg ? end * 0.00008 : Math.max(end * 0.012, end * 0.002);
    const wave = Math.sin(t * Math.PI * (peg ? 7 : 4.5)) * amp * (peg ? 0.45 : 0.7);
    const noise = ((n1 - 0.5) * amp + (n2 - 0.5) * amp * 0.4) * (peg ? 0.5 : 1);
    const p = Math.max(drift + wave + noise, 1e-12);

    out.push({
      created_at: new Date(now - (1 - t) * spanMs).toISOString(),
      price: p,
      market_cap: p * 1e6,
    });
  }

  // Newest-first so PriceChart's reverse yields chronological
  return out.reverse();
}

/** Full-bleed Phantom sparkline + period pills used on every token detail. */
export function PhantomSparkline({
  period,
  onPeriodChange,
  ticks,
  price,
  changePct,
  tokenKey,
  peg,
  footnote,
}: {
  period: string;
  onPeriodChange: (p: PhantomPeriod) => void;
  ticks?: ChartTick[] | null;
  price: number;
  changePct: number;
  tokenKey?: string;
  peg?: boolean;
  footnote?: string;
}) {
  const up = changePct >= 0;
  const series = useMemo(
    () =>
      resolveChartTicks({
        period,
        ticks,
        price,
        changePct,
        tokenKey,
        peg,
      }),
    [period, ticks, price, changePct, tokenKey, peg],
  );

  return (
    <div className="-mx-4 overflow-hidden">
      <PriceChart ticks={series} mode="price" trend={up ? "up" : "down"} height={210} />
      <div className="mt-2 flex flex-wrap items-center justify-center gap-1 px-4">
        {PHANTOM_PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPeriodChange(p)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold press",
              period === p ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p}
          </button>
        ))}
      </div>
      {footnote ? (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">{footnote}</p>
      ) : null}
    </div>
  );
}
