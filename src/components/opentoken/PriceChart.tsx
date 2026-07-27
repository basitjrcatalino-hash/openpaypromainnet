import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { formatNumber } from "@/lib/wallet-utils";

type Tick = { created_at: string; price: number; market_cap?: number };

export function PriceChart({
  ticks,
  mode = "price",
}: {
  ticks: Tick[];
  mode?: "price" | "mcap";
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

  // Determine trend color (green if last >= first, red otherwise)
  const isUp = data.length >= 2 ? data[data.length - 1].v >= data[0].v : true;
  const strokeColor = isUp ? "#4ade80" : "#f87171";
  const gradientId = `otPhantomGrad-${mode}`;

  if (!data.length) {
    return (
      <div className="grid h-56 place-items-center rounded-2xl bg-muted/40 text-sm text-muted-foreground">
        No chart data yet — be the first to trade
      </div>
    );
  }

  return (
    <div className="h-56 w-full rounded-2xl bg-transparent">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis
            domain={["auto", "auto"]}
            hide
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 12,
              fontSize: 12,
              color: "#f5f5f5",
            }}
            formatter={(v: number) => [
              `${formatNumber(v, 8)} OUSD`,
              mode === "mcap" ? "MCap" : "Price",
            ]}
            labelStyle={{ color: "#a1a1aa" }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={strokeColor}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 5,
              fill: strokeColor,
              stroke: "#000",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
