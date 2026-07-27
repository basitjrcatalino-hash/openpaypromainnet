import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

  if (!data.length) {
    return (
      <div className="grid h-56 place-items-center rounded-2xl border border-border/60 bg-card/40 text-sm text-muted-foreground">
        No chart data yet — be the first to trade
      </div>
    );
  }

  return (
    <div className="h-56 w-full rounded-2xl border border-border/60 bg-card/40 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="otPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis
            domain={["auto", "auto"]}
            width={56}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => formatNumber(v, v < 0.01 ? 6 : 2)}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(v: number) => [formatNumber(v, 8), mode === "mcap" ? "MCap" : "Price"]}
          />
          <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" fill="url(#otPrice)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
