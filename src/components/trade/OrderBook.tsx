import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import {
  buySellRatio,
  type ExchangeDepthBook,
} from "@/lib/exchange-depth";
import { aggregateLevels, formatTick, precisionOptions } from "@/lib/trade-advanced";

function nextFundingCountdown(now = Date.now()): string {
  const d = new Date(now);
  const utcH = d.getUTCHours();
  const nextH = utcH < 8 ? 8 : utcH < 16 ? 16 : 24;
  const target = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + (nextH === 24 ? 1 : 0),
    nextH % 24,
    0,
    0,
    0,
  );
  const ms = Math.max(0, target - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type BookView = "both" | "bids" | "asks";

export function OrderBook({
  book,
  baseSymbol,
  midOverride,
  loading,
  change24h,
  onPriceClick,
  onSizeClick,
  markPrice,
  fundingRate,
  showFunding,
}: {
  book?: ExchangeDepthBook;
  baseSymbol: string;
  midOverride?: number;
  loading?: boolean;
  change24h?: number;
  onPriceClick?: (price: number) => void;
  onSizeClick?: (amount: number) => void;
  markPrice?: number;
  fundingRate?: number;
  showFunding?: boolean;
}) {
  const mid = midOverride && midOverride > 0 ? midOverride : book?.mid ?? 0;
  const ticks = useMemo(() => precisionOptions(mid), [mid]);
  const [tickIdx, setTickIdx] = useState(0);
  const [view, setView] = useState<BookView>("both");
  const [countdown, setCountdown] = useState(() => nextFundingCountdown());
  const tick = ticks[Math.min(tickIdx, ticks.length - 1)] ?? 0;

  useEffect(() => {
    if (!showFunding) return;
    const id = window.setInterval(() => setCountdown(nextFundingCountdown()), 1000);
    return () => window.clearInterval(id);
  }, [showFunding]);

  const rows = view === "both" ? 8 : 17;

  // Cumulative totals run outward from the spread, like OKX / Binance.
  const asks = useMemo(() => {
    const levels = aggregateLevels(book?.asks ?? [], tick, "ask").slice(0, rows);
    let run = 0;
    return levels.map((l) => ({ ...l, total: (run += l.amount) })).reverse();
  }, [book?.asks, tick, rows]);

  const bids = useMemo(() => {
    const levels = aggregateLevels(book?.bids ?? [], tick, "bid").slice(0, rows);
    let run = 0;
    return levels.map((l) => ({ ...l, total: (run += l.amount) }));
  }, [book?.bids, tick, rows]);

  const { buyPct, sellPct } = buySellRatio(book);
  const maxTotal = Math.max(
    0.0001,
    ...asks.map((l) => l.total),
    ...bids.map((l) => l.total),
  );

  const priceDigits = mid >= 1000 ? 1 : mid >= 1 ? 2 : 4;
  const amtDigits = mid >= 100 ? 4 : 2;
  const up = (change24h ?? 0) >= 0;
  const fundingLabel =
    fundingRate != null && Number.isFinite(fundingRate)
      ? `${formatNumber(fundingRate, 5)}%`
      : "—";

  const askRows = asks.map((l) => (
    <DepthRow
      key={`a-${l.price}`}
      side="ask"
      price={l.price}
      amount={l.amount}
      total={l.total}
      maxTotal={maxTotal}
      priceDigits={priceDigits}
      amtDigits={amtDigits}
      onPrice={onPriceClick}
      onSize={onSizeClick}
    />
  ));
  const bidRows = bids.map((l) => (
    <DepthRow
      key={`b-${l.price}`}
      side="bid"
      price={l.price}
      amount={l.amount}
      total={l.total}
      maxTotal={maxTotal}
      priceDigits={priceDigits}
      amtDigits={amtDigits}
      onPrice={onPriceClick}
      onSize={onSizeClick}
    />
  ));

  return (
    <div className="flex h-full min-h-0 flex-col text-[11px]">
      {showFunding ? (
        <div className="mb-1.5 flex items-center justify-between gap-1 px-0.5 text-[9px] text-muted-foreground">
          <span>Funding rate / Countdown</span>
          <span className="font-semibold tabular-nums text-foreground">
            {fundingLabel} / {countdown}
          </span>
        </div>
      ) : null}

      <div className="mb-1 flex items-center gap-1 px-0.5">
        <div className="flex gap-0.5">
          {(
            [
              ["both", "Both"],
              ["bids", "Bids"],
              ["asks", "Asks"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase press",
                view === id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          aria-label="Price grouping"
          value={tickIdx}
          onChange={(e) => setTickIdx(Number(e.target.value))}
          className="ml-auto h-5 rounded border-0 bg-muted/60 px-1 text-[9px] font-semibold text-foreground outline-none"
        >
          {ticks.map((t, i) => (
            <option key={t} value={i}>
              {formatTick(t)}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-1 grid grid-cols-[1fr_1fr_1fr] gap-1 px-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
        <span>Price</span>
        <span className="text-right">Amount ({baseSymbol})</span>
        <span className="text-right">Total</span>
      </div>

      {view !== "bids" ? (
        <div
          className={cn(
            "min-h-0 space-y-0.5 overflow-hidden",
            view === "both" ? "flex-1" : "flex-[3]",
          )}
        >
          {loading && !asks.length ? (
            <div className="space-y-1 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-muted/40" />
              ))}
            </div>
          ) : (
            askRows
          )}
        </div>
      ) : null}

      <div className="sticky top-0 z-1 my-1.5 flex items-end justify-between gap-2 bg-background px-0.5">
        <div>
          <p
            className={cn(
              "flex items-center gap-1 text-base font-bold tabular-nums leading-none",
              up ? "text-[#0ecb81]" : "text-[#f6465d]",
            )}
          >
            {up ? (
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={3} />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" strokeWidth={3} />
            )}
            {mid > 0 ? formatNumber(mid, priceDigits) : "—"}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[10px] font-semibold tabular-nums",
              up ? "text-[#0ecb81]" : "text-[#f6465d]",
            )}
          >
            {(change24h ?? 0) >= 0 ? "+" : ""}
            {formatNumber(change24h ?? 0, 2)}%
          </p>
        </div>
        {markPrice && markPrice > 0 ? (
          <p className="pb-0.5 text-right text-[9px] leading-tight text-muted-foreground">
            Mark
            <br />
            <span className="font-semibold tabular-nums text-foreground">
              {formatNumber(markPrice, priceDigits)}
            </span>
          </p>
        ) : null}
      </div>

      {view !== "asks" ? (
        <div
          className={cn(
            "min-h-0 space-y-0.5 overflow-hidden",
            view === "both" ? "flex-1" : "flex-[3]",
          )}
        >
          {bidRows}
        </div>
      ) : null}

      <div className="mt-2 flex h-1.5 overflow-hidden rounded-sm bg-muted">
        <div className="bg-[#0ecb81]" style={{ width: `${buyPct}%` }} />
        <div className="bg-[#f6465d]" style={{ width: `${sellPct}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] font-semibold">
        <span className="text-[#0ecb81]">B {buyPct}%</span>
        <span className="text-[#f6465d]">{sellPct}% S</span>
      </div>
    </div>
  );
}


function DepthRow({
  side,
  price,
  amount,
  total,
  maxTotal,
  priceDigits,
  amtDigits,
  onPrice,
  onSize,
}: {
  side: "ask" | "bid";
  price: number;
  amount: number;
  total: number;
  maxTotal: number;
  priceDigits: number;
  amtDigits: number;
  onPrice?: (price: number) => void;
  onSize?: (amount: number) => void;
}) {
  const pct = Math.min(100, (total / maxTotal) * 100);
  const color = side === "ask" ? "#f6465d" : "#0ecb81";
  return (
    <div className="relative grid grid-cols-[1fr_1fr_1fr] items-center gap-1 overflow-hidden rounded-sm px-0.5 py-0.5">
      <span
        className="pointer-events-none absolute inset-y-0 right-0 opacity-20"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
      <button
        type="button"
        onClick={() => onPrice?.(price)}
        className="relative text-left font-semibold tabular-nums press"
        style={{ color }}
      >
        {formatNumber(price, priceDigits)}
      </button>
      <button
        type="button"
        onClick={() => onSize?.(amount)}
        className="relative text-right tabular-nums text-foreground/80 press"
      >
        {formatNumber(amount, amtDigits)}
      </button>
      <span className="relative text-right tabular-nums text-muted-foreground">
        {formatNumber(total, amtDigits)}
      </span>
    </div>
  );
}

