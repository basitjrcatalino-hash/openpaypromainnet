import { useMemo } from "react";
import { useTheme } from "@/components/theme-provider";
import { formatNumber } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

type Candle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  up: boolean;
  label: string;
};

/** Build OHLC candles from CoinGecko sparkline prices. */
export function sparklineToCandles(prices: number[], markPrice?: number): Candle[] {
  const pts = prices.filter((p) => Number.isFinite(p) && p > 0);
  if (pts.length < 4) {
    const px = markPrice && markPrice > 0 ? markPrice : 1;
    const now = Date.now();
    return Array.from({ length: 24 }, (_, i) => {
      const wobble = 1 + Math.sin(i / 3) * 0.002;
      const v = px * wobble;
      return {
        ts: now - (24 - i) * 60_000,
        open: v,
        high: v * 1.001,
        low: v * 0.999,
        close: v,
        up: true,
        label: "",
      };
    });
  }

  const bucket = Math.max(1, Math.floor(pts.length / 36));
  const candles: Candle[] = [];
  const now = Date.now();
  const stepMs = (7 * 24 * 60 * 60 * 1000) / Math.max(pts.length, 1);

  for (let i = 0; i < pts.length; i += bucket) {
    const slice = pts.slice(i, i + bucket);
    if (!slice.length) continue;
    const open = slice[0]!;
    const close = slice[slice.length - 1]!;
    const high = Math.max(...slice);
    const low = Math.min(...slice);
    const ts = now - (pts.length - i) * stepMs;
    candles.push({
      ts,
      open,
      high,
      low,
      close,
      up: close >= open,
      label: new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  }

  if (markPrice && markPrice > 0 && candles.length) {
    const last = candles[candles.length - 1]!;
    last.close = markPrice;
    last.high = Math.max(last.high, markPrice);
    last.low = Math.min(last.low, markPrice);
    last.up = last.close >= last.open;
  }

  return candles;
}

export function PhantomPerpChart({
  prices,
  markPrice,
  className,
  height = 280,
}: {
  prices: number[];
  markPrice?: number;
  className?: string;
  height?: number;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const candles = useMemo(() => sparklineToCandles(prices, markPrice), [prices, markPrice]);

  const chrome = dark
    ? { grid: "rgba(255,255,255,0.06)", axis: "rgba(255,255,255,0.4)", mark: "#fff" }
    : { grid: "rgba(15,23,42,0.08)", axis: "rgba(15,23,42,0.45)", mark: "#0f172a" };

  const w = 640;
  const h = 280;
  const padL = 4;
  const padR = 58;
  const padT = 10;
  const padB = 24;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const lows = candles.map((c) => c.low);
  const highs = candles.map((c) => c.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const span = max - min || Math.max(max * 0.01, 1e-8);
  const lo = min - span * 0.1;
  const hi = max + span * 0.1;
  const range = hi - lo || 1;
  const yScale = (v: number) => padT + ((hi - v) / range) * plotH;
  const slot = plotW / Math.max(candles.length, 1);
  const bodyW = Math.max(Math.min(slot * 0.55, 9), 1.5);
  const yTicks = [0.15, 0.4, 0.65, 0.9].map((t) => lo + range * (1 - t));
  const mark = markPrice && markPrice > 0 ? markPrice : candles[candles.length - 1]?.close;
  const labelStep = Math.max(1, Math.ceil(candles.length / 5));

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img" aria-label="Perp chart">
        {yTicks.map((v, i) => {
          const y = yScale(v);
          return (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke={chrome.grid} strokeDasharray="3 4" />
              <text x={w - padR + 6} y={y + 3} fill={chrome.axis} fontSize={10}>
                {v >= 1000 ? formatNumber(v, 0) : formatNumber(v, v < 1 ? 4 : 2)}
              </text>
            </g>
          );
        })}
        {candles.map((c, i) => {
          const cx = padL + slot * i + slot / 2;
          const color = c.up ? "#22c55e" : "#ef4444";
          const openY = yScale(c.open);
          const closeY = yScale(c.close);
          const top = Math.min(openY, closeY);
          const bodyH = Math.max(Math.abs(closeY - openY), 1.2);
          return (
            <g key={c.ts}>
              <line x1={cx} x2={cx} y1={yScale(c.high)} y2={yScale(c.low)} stroke={color} strokeWidth={1.2} />
              <rect x={cx - bodyW / 2} y={top} width={bodyW} height={bodyH} fill={color} rx={1} />
            </g>
          );
        })}
        {mark != null ? (
          <g>
            <line
              x1={padL}
              x2={w - padR}
              y1={yScale(mark)}
              y2={yScale(mark)}
              stroke={chrome.mark}
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.7}
            />
            <rect
              x={w - padR + 2}
              y={yScale(mark) - 9}
              width={52}
              height={18}
              rx={9}
              fill={chrome.mark}
            />
            <text
              x={w - padR + 28}
              y={yScale(mark) + 3.5}
              textAnchor="middle"
              fill={dark ? "#000" : "#fff"}
              fontSize={9}
              fontWeight={700}
            >
              {mark >= 1000 ? formatNumber(mark, 0) : formatNumber(mark, 2)}
            </text>
          </g>
        ) : null}
        {candles.map((c, i) => {
          if (i % labelStep !== 0) return null;
          return (
            <text
              key={`x-${c.ts}`}
              x={padL + slot * i + slot / 2}
              y={h - 6}
              textAnchor="middle"
              fill={chrome.axis}
              fontSize={9}
            >
              {c.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
