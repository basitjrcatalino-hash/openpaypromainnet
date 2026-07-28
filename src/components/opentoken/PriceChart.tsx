import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { formatNumber } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

type Tick = { created_at: string; price: number; market_cap?: number };

export function PriceChart({
  ticks,
  mode = "price",
  trend,
  height = 220,
  className,
}: {
  ticks: Tick[];
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
          t: new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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

  // Phantom-style green / red
  const strokeColor = isUp ? "#22c55e" : "#ef4444";
  const gradientId = `ph-chart-${mode}-${isUp ? "up" : "dn"}-${height}`;

  if (!data.length) {
    return (
      <div
        className={cn(
          "grid place-items-center text-sm text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        No chart data yet
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.28} />
              <stop offset="70%" stopColor={strokeColor} stopOpacity={0.04} />
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
            animationDuration={450}
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

/** Deterministic peg sparkline (Phantom USDC-style micro moves around $1). */
export function buildPegTicks(
  period: string,
  base = 1,
  seed = 1,
): Tick[] {
  const points =
    period === "1H" ? 48 : period === "1D" ? 96 : period === "1W" ? 120 : period === "1M" ? 140 : 160;
  const spanMs =
    period === "1H"
      ? 60 * 60 * 1000
      : period === "1D"
        ? 24 * 60 * 60 * 1000
        : period === "1W"
          ? 7 * 24 * 60 * 60 * 1000
          : period === "1M"
            ? 30 * 24 * 60 * 60 * 1000
            : 365 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const out: Tick[] = [];
  let s = (seed * 1103515245 + 12345) >>> 0;
  for (let i = 0; i < points; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const n1 = (s % 10000) / 10000;
    s = (s * 1664525 + 1013904223) >>> 0;
    const n2 = (s % 10000) / 10000;
    // Tiny noise around peg (± a few basis points)
    const wave = Math.sin((i / points) * Math.PI * 6) * 0.000035;
    const noise = (n1 - 0.5) * 0.00008 + (n2 - 0.5) * 0.00004;
    const price = base + wave + noise;
    out.push({
      created_at: new Date(now - ((points - 1 - i) / (points - 1)) * spanMs).toISOString(),
      price,
      market_cap: price * 1e9,
    });
  }
  return out.reverse(); // PriceChart reverses again → chronological
}
