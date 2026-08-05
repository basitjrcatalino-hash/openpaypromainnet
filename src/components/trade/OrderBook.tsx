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

export function OrderBook({
  book,
  baseSymbol,
  midOverride,
  loading,
  change24h,
  onPriceClick,
  fundingRate,
  showFunding,
}: {
  book?: ExchangeDepthBook;
  baseSymbol: string;
  midOverride?: number;
  loading?: boolean;
  change24h?: number;
  onPriceClick?: (price: number) => void;
  fundingRate?: number;
  showFunding?: boolean;
}) {
  const mid = midOverride && midOverride > 0 ? midOverride : book?.mid ?? 0;
  const ticks = useMemo(() => precisionOptions(mid), [mid]);
  const [tickIdx, setTickIdx] = useState(0);
  const [countdown, setCountdown] = useState(() => nextFundingCountdown());
  const tick = ticks[Math.min(tickIdx, ticks.length - 1)] ?? 0;

  useEffect(() => {
    if (!showFunding) return;
    const id = window.setInterval(() => setCountdown(nextFundingCountdown()), 1000);
    return () => window.clearInterval(id);
  }, [showFunding]);

  const asks = useMemo(
    () => aggregateLevels(book?.asks ?? [], tick, "ask").slice(0, 8).reverse(),
    [book?.asks, tick],
  );
  const bids = useMemo(
    () => aggregateLevels(book?.bids ?? [], tick, "bid").slice(0, 8),
    [book?.bids, tick],
  );
  const { buyPct, sellPct } = buySellRatio(book);
  const maxAmt = Math.max(
    0.0001,
    ...asks.map((l) => l.amount),
    ...bids.map((l) => l.amount),
  );

  const priceDigits = mid >= 1000 ? 1 : mid >= 1 ? 2 : 4;
  const amtDigits = mid >= 100 ? 4 : 2;
  const up = (change24h ?? 0) >= 0;
  const fundingLabel =
    fundingRate != null && Number.isFinite(fundingRate)
      ? `${formatNumber(fundingRate, 5)}%`
      : "—";

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

      <div className="mb-1 flex items-center justify-between gap-1 px-0.5 text-[10px] text-muted-foreground">
        <span>Price (₮)</span>
        <span>Amount ({baseSymbol})</span>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
        {loading && !asks.length ? (
          <div className="space-y-1 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-muted/40" />
            ))}
          </div>
        ) : (
          asks.map((l) => (
            <DepthRow
              key={`a-${l.price}`}
              side="ask"
              price={l.price}
              amount={l.amount}
              maxAmt={maxAmt}
              priceDigits={priceDigits}
              amtDigits={amtDigits}
              onClick={onPriceClick}
            />
          ))
        )}
      </div>

      <div className="my-1.5 px-0.5">
        <p
          className={cn(
            "text-base font-bold tabular-nums leading-none",
            up ? "text-[#0ecb81]" : "text-[#f6465d]",
          )}
        >
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

      <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
        {bids.map((l) => (
          <DepthRow
            key={`b-${l.price}`}
            side="bid"
            price={l.price}
            amount={l.amount}
            maxAmt={maxAmt}
            priceDigits={priceDigits}
            amtDigits={amtDigits}
            onClick={onPriceClick}
          />
        ))}
      </div>

      <div className="mt-2 flex h-1.5 overflow-hidden rounded-sm bg-muted">
        <div className="bg-[#0ecb81]" style={{ width: `${buyPct}%` }} />
        <div className="bg-[#f6465d]" style={{ width: `${sellPct}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] font-semibold">
        <span className="text-[#0ecb81]">B {buyPct}%</span>
        <select
          aria-label="Price precision"
          value={tickIdx}
          onChange={(e) => setTickIdx(Number(e.target.value))}
          className="h-5 rounded border-0 bg-muted/60 px-1 text-[9px] font-semibold text-foreground outline-none"
        >
          {ticks.map((t, i) => (
            <option key={t} value={i}>
              {formatTick(t)}
            </option>
          ))}
        </select>
        <span className="text-[#f6465d]">{sellPct}% S</span>
      </div>
    </div>
  );
}

function DepthRow({
  side,
  price,
  amount,
  maxAmt,
  priceDigits,
  amtDigits,
  onClick,
}: {
  side: "ask" | "bid";
  price: number;
  amount: number;
  maxAmt: number;
  priceDigits: number;
  amtDigits: number;
  onClick?: (price: number) => void;
}) {
  const pct = Math.min(100, (amount / maxAmt) * 100);
  const color = side === "ask" ? "#f6465d" : "#0ecb81";
  return (
    <button
      type="button"
      onClick={() => onClick?.(price)}
      className="relative flex w-full items-center justify-between overflow-hidden rounded-sm px-0.5 py-0.5 text-left press"
    >
      <span
        className="pointer-events-none absolute inset-y-0 right-0 opacity-20"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
      <span className="relative font-semibold tabular-nums" style={{ color }}>
        {formatNumber(price, priceDigits)}
      </span>
      <span className="relative tabular-nums text-muted-foreground">
        {formatNumber(amount, amtDigits)}
      </span>
    </button>
  );
}
