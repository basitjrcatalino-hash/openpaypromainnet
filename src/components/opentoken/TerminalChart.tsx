import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CandlestickChart as CandlestickIcon, LineChart as LineChartIcon } from "lucide-react";
import { formatNumber, formatOUSD, formatPct, timeAgo } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import {
  candleBucketMs,
  resolveChartTicks,
  type ChartTick,
} from "./PriceChart";
import type { OtTradeRow } from "./TradesTable";

export const TERMINAL_PERIODS = ["5M", "15M", "1H", "1D", "1W", "1M"] as const;
export type TerminalPeriod = (typeof TERMINAL_PERIODS)[number];

type Candle = {
  t: string;
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  up: boolean;
};

function valueOf(tick: ChartTick, mode: "price" | "mcap") {
  const v = mode === "mcap" ? Number(tick.market_cap ?? 0) : Number(tick.price);
  return Number.isFinite(v) ? v : 0;
}

export function ticksToCandles(
  ticks: ChartTick[],
  period: string,
  mode: "price" | "mcap",
): Candle[] {
  const chrono = [...ticks]
    .filter((t) => valueOf(t, mode) > 0)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (!chrono.length) return [];

  const bucket = candleBucketMs(period);
  const map = new Map<
    number,
    { open: number; high: number; low: number; close: number; ts: number }
  >();

  for (const tick of chrono) {
    const v = valueOf(tick, mode);
    const ms = new Date(tick.created_at).getTime();
    if (!Number.isFinite(ms)) continue;
    const key = Math.floor(ms / bucket) * bucket;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { open: v, high: v, low: v, close: v, ts: key });
    } else {
      existing.high = Math.max(existing.high, v);
      existing.low = Math.min(existing.low, v);
      existing.close = v;
    }
  }

  return [...map.values()]
    .sort((a, b) => a.ts - b.ts)
    .map((c) => ({
      ...c,
      up: c.close >= c.open,
      t: new Date(c.ts).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
}

function fmtAxis(v: number, metric: "price" | "mcap") {
  if (!Number.isFinite(v)) return "—";
  if (metric === "mcap") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return formatNumber(v, 2);
  }
  return v < 0.01 ? formatNumber(v, 6) : formatNumber(v, 4);
}

function SvgCandleChart({ candles, metric }: { candles: Candle[]; metric: "price" | "mcap" }) {
  const w = 640;
  const h = 260;
  const padL = 8;
  const padR = 56;
  const padT = 12;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const lows = candles.map((c) => c.low);
  const highs = candles.map((c) => c.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return (
      <div className="grid h-full place-items-center text-sm text-white/40">No chart data yet</div>
    );
  }
  const span = max - min || Math.max(max * 0.02, 1e-12);
  const lo = min - span * 0.08;
  const hi = max + span * 0.08;
  const range = hi - lo || 1;

  const yScale = (v: number) => padT + ((hi - v) / range) * plotH;
  const slot = plotW / Math.max(candles.length, 1);
  const bodyW = Math.max(Math.min(slot * 0.55, 10), 2);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + range * (1 - t));
  const labelStep = Math.max(1, Math.ceil(candles.length / 5));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img" aria-label="Terminal chart">
      {yTicks.map((v, i) => {
        const y = yScale(v);
        return (
          <g key={`y-${i}`}>
            <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />
            <text
              x={w - padR + 6}
              y={y + 3}
              fill="rgba(255,255,255,0.35)"
              fontSize={10}
              fontFamily="ui-sans-serif, system-ui"
            >
              {fmtAxis(v, metric)}
            </text>
          </g>
        );
      })}
      {candles.map((c, i) => {
        const cx = padL + slot * i + slot / 2;
        const color = c.up ? "#22c55e" : "#f97316";
        const openY = yScale(c.open);
        const closeY = yScale(c.close);
        const highY = yScale(c.high);
        const lowY = yScale(c.low);
        const top = Math.min(openY, closeY);
        const bodyH = Math.max(Math.abs(closeY - openY), 1.5);
        return (
          <g key={`c-${c.ts}-${i}`}>
            <line x1={cx} x2={cx} y1={highY} y2={lowY} stroke={color} strokeWidth={1.25} />
            <rect x={cx - bodyW / 2} y={top} width={bodyW} height={bodyH} fill={color} rx={1} />
          </g>
        );
      })}
      {candles.map((c, i) => {
        if (i % labelStep !== 0) return null;
        const cx = padL + slot * i + slot / 2;
        return (
          <text
            key={`x-${c.ts}-${i}`}
            x={cx}
            y={h - 8}
            textAnchor="middle"
            fill="rgba(255,255,255,0.35)"
            fontSize={9}
            fontFamily="ui-sans-serif, system-ui"
          >
            {c.t}
          </text>
        );
      })}
    </svg>
  );
}

/** Only mount Recharts after the box has a real size (avoids width/height -1 warnings). */
function useChartBoxReady() {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") {
      setReady(true);
      return;
    }
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setReady(width > 0 && height > 0);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, ready };
}

type Props = {
  period: string;
  onPeriodChange: (p: TerminalPeriod) => void;
  ticks?: ChartTick[] | null;
  trades?: OtTradeRow[];
  myUserId?: string;
  price: number;
  mcap: number;
  changePct: number;
  symbol: string;
  tokenKey?: string;
  peg?: boolean;
};

export function TerminalChart({
  period,
  onPeriodChange,
  ticks,
  trades = [],
  myUserId,
  price,
  mcap,
  changePct,
  symbol,
  tokenKey,
  peg,
}: Props) {
  const reactId = useId().replace(/:/g, "");
  const gradId = `term-area-${reactId}`;
  const markersId = `term-markers-${reactId}`;
  const { ref: chartBoxRef, ready: chartReady } = useChartBoxReady();
  const [metric, setMetric] = useState<"price" | "mcap">("mcap");
  const [chartStyle, setChartStyle] = useState<"candle" | "line">("candle");
  const [tradeTab, setTradeTab] = useState<"trades" | "mine">("trades");
  const [showMarkers, setShowMarkers] = useState(true);
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

  const candles = useMemo(
    () => ticksToCandles(series, period, metric),
    [series, period, metric],
  );

  const lineData = useMemo(
    () =>
      candles.map((c) => ({
        t: c.t,
        v: c.close,
      })),
    [candles],
  );

  const visibleTrades = useMemo(() => {
    const list =
      tradeTab === "mine" && myUserId ? trades.filter((t) => t.user_id === myUserId) : trades;
    return showMarkers ? list : [];
  }, [trades, tradeTab, myUserId, showMarkers]);

  const stroke = up ? "#22c55e" : "#ef4444";

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-[#0b0d12] text-white dark:border-border dark:bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <div className="flex items-center gap-0.5 rounded-lg bg-white/5 p-0.5">
          {TERMINAL_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold press",
                period === p ? "bg-white/15 text-white" : "text-white/50 hover:text-white",
              )}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-lg bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => setChartStyle("candle")}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-md",
                chartStyle === "candle" ? "bg-white/15 text-white" : "text-white/45",
              )}
              aria-label="Candlestick"
            >
              <CandlestickIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartStyle("line")}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-md",
                chartStyle === "line" ? "bg-white/15 text-white" : "text-white/45",
              )}
              aria-label="Line"
            >
              <LineChartIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex rounded-lg bg-white/5 p-0.5">
            {(["price", "mcap"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold press",
                  metric === m
                    ? "bg-emerald-500/25 text-emerald-300"
                    : "text-white/45 hover:text-white",
                )}
              >
                {m === "price" ? "Price" : "MCap"}
              </button>
            ))}
          </div>

          <label
            htmlFor={markersId}
            className="flex cursor-pointer items-center gap-1.5 px-1 text-[11px] text-white/55"
          >
            <input
              id={markersId}
              type="checkbox"
              checked={showMarkers}
              onChange={(e) => setShowMarkers(e.target.checked)}
              className="h-3 w-3 accent-emerald-400"
            />
            Trade markers
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-white/45">
            {metric === "mcap" ? "Market cap" : "Price"} · {symbol}
          </div>
          <div className="mt-0.5 text-xl font-bold tabular-nums">
            {metric === "mcap"
              ? formatOUSD(mcap, { compact: true })
              : formatOUSD(price, { price: true })}
          </div>
        </div>
        <div
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
            up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
          )}
        >
          {formatPct(changePct)} · 24h
        </div>
      </div>

      <div ref={chartBoxRef} className="relative h-65 w-full px-1 pb-1 pt-2 sm:h-75">
        {candles.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-white/40">No chart data yet</div>
        ) : chartStyle === "candle" ? (
          <SvgCandleChart candles={candles} metric={metric} />
        ) : !chartReady ? (
          <div className="grid h-full place-items-center text-sm text-white/40">Loading chart…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={50}>
            <AreaChart data={lineData} margin={{ top: 8, right: 48, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="t"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={48}
              />
              <YAxis
                domain={["auto", "auto"]}
                orientation="right"
                width={48}
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => fmtAxis(v, metric)}
              />
              <Tooltip
                contentStyle={{
                  background: "#12151c",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#fff",
                }}
                formatter={(v: number) => [
                  fmtAxis(v, metric),
                  metric === "mcap" ? "MCap" : "Price",
                ]}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={stroke}
                fill={`url(#${gradId})`}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border-t border-white/10">
        <div className="flex gap-1 px-3 pt-2">
          {(
            [
              ["trades", "Trades"],
              ["mine", "My trades"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTradeTab(id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold press",
                tradeTab === id ? "bg-white/10 text-white" : "text-white/45 hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="max-h-52 overflow-y-auto px-2 pb-2 pt-1">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-1 bg-[#0b0d12] text-[10px] uppercase text-white/40 dark:bg-card">
              <tr>
                <th className="px-2 py-1.5 font-medium">Time</th>
                <th className="px-2 py-1.5 font-medium">Type</th>
                <th className="px-2 py-1.5 text-right font-medium">Price</th>
                <th className="px-2 py-1.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visibleTrades.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-8 text-center text-white/35">
                    {tradeTab === "mine" ? "No trades from you yet" : "No trades yet"}
                  </td>
                </tr>
              ) : (
                visibleTrades.map((t) => {
                  const buy = t.side === "buy";
                  return (
                    <tr key={t.id} className="border-t border-white/5">
                      <td className="px-2 py-1.5 text-white/45">{timeAgo(t.created_at)}</td>
                      <td
                        className={cn(
                          "px-2 py-1.5 font-semibold",
                          buy ? "text-emerald-400" : "text-orange-400",
                        )}
                      >
                        {buy ? "Buy" : "Sell"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-white/80">
                        {formatNumber(t.price, t.price < 0.01 ? 8 : 4)}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-1.5 text-right tabular-nums font-medium",
                          buy ? "text-emerald-400" : "text-orange-400",
                        )}
                      >
                        {formatNumber(t.token_amount, 2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
