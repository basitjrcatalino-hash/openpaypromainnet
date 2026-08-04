import { useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import type { ExchangeDepthBook } from "@/lib/exchange-depth";
import { buildDepthSeries, type DepthPoint } from "@/lib/trade-advanced";

const SPANS = [0.25, 0.5, 1, 2, 5] as const;

const W = 320;
const H = 150;

function pathFor(
  points: DepthPoint[],
  minPrice: number,
  maxPrice: number,
  maxCum: number,
  baseline: number,
): string {
  if (!points.length) return "";
  const x = (p: number) => ((p - minPrice) / (maxPrice - minPrice)) * W;
  const y = (c: number) => H - (c / maxCum) * (H - 8);
  const start = `M ${x(points[0].price)} ${H}`;
  const steps = points
    .map((p, i) => {
      const prev = points[i - 1];
      const seg = prev ? `L ${x(p.price)} ${y(prev.cumulative)} ` : "";
      return `${seg}L ${x(p.price)} ${y(p.cumulative)}`;
    })
    .join(" ");
  const last = points[points.length - 1];
  return `${start} L ${x(points[0].price)} ${y(points[0].cumulative)} ${steps} L ${x(last.price)} ${H} L ${x(baseline)} ${H} Z`;
}

/** Interactive cumulative depth chart with crosshair + zoom span. */
export function DepthChart({
  book,
  midOverride,
  baseSymbol,
  className,
}: {
  book?: ExchangeDepthBook;
  midOverride?: number;
  baseSymbol: string;
  className?: string;
}) {
  const [span, setSpan] = useState<number>(1);
  const [hover, setHover] = useState<{ x: number; price: number; bid: number; ask: number } | null>(
    null,
  );
  const hostRef = useRef<HTMLDivElement>(null);

  const series = useMemo(
    () => buildDepthSeries(book, span, midOverride),
    [book, span, midOverride],
  );

  const priceDigits = (series?.mid ?? 0) >= 1000 ? 1 : (series?.mid ?? 0) >= 1 ? 2 : 4;

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = hostRef.current;
    if (!el || !series) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const price = series.minPrice + ratio * (series.maxPrice - series.minPrice);
    const bid = series.bids.filter((p) => p.price >= price).at(-1)?.cumulative ?? 0;
    const ask = series.asks.filter((p) => p.price <= price).at(-1)?.cumulative ?? 0;
    setHover({ x: ratio * 100, price, bid, ask });
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
        <span className="font-semibold text-muted-foreground">Depth · {baseSymbol}</span>
        <div className="flex gap-0.5 rounded-md bg-muted/50 p-0.5">
          {SPANS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpan(s)}
              className={cn(
                "rounded px-1.5 py-0.5 font-bold press",
                span === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              ±{s}%
            </button>
          ))}
        </div>
      </div>

      {!series ? (
        <div className="grid flex-1 place-items-center rounded-lg bg-muted/20 text-[11px] text-muted-foreground">
          Depth unavailable
        </div>
      ) : (
        <div
          ref={hostRef}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-muted/15"
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-full w-full"
            aria-label="Order book depth"
          >
            <path
              d={pathFor(
                [...series.bids].reverse(),
                series.minPrice,
                series.maxPrice,
                series.maxCumulative,
                series.minPrice,
              )}
              fill="#0ecb81"
              fillOpacity={0.18}
              stroke="#0ecb81"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={pathFor(
                series.asks,
                series.minPrice,
                series.maxPrice,
                series.maxCumulative,
                series.maxPrice,
              )}
              fill="#f6465d"
              fillOpacity={0.18}
              stroke="#f6465d"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={W / 2}
              x2={W / 2}
              y1={0}
              y2={H}
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeDasharray="3 3"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {hover ? (
            <>
              <span
                className="pointer-events-none absolute inset-y-0 w-px bg-foreground/40"
                style={{ left: `${hover.x}%` }}
              />
              <div className="pointer-events-none absolute left-1 top-1 rounded-md bg-background/90 px-2 py-1 text-[10px] leading-tight shadow-sm ring-1 ring-border/60">
                <p className="font-semibold tabular-nums">
                  {formatNumber(hover.price, priceDigits)}
                </p>
                <p className="text-[#0ecb81] tabular-nums">
                  bids {formatNumber(hover.bid, 4)}
                </p>
                <p className="text-[#f6465d] tabular-nums">
                  asks {formatNumber(hover.ask, 4)}
                </p>
              </div>
            </>
          ) : null}

          <div className="pointer-events-none absolute inset-x-1 bottom-0.5 flex justify-between text-[9px] text-muted-foreground tabular-nums">
            <span>{formatNumber(series.minPrice, priceDigits)}</span>
            <span>{formatNumber(series.mid, priceDigits)}</span>
            <span>{formatNumber(series.maxPrice, priceDigits)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
