import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import {
  buySellRatio,
  type ExchangeDepthBook,
} from "@/lib/exchange-depth";
import { aggregateLevels, formatTick, precisionOptions } from "@/lib/trade-advanced";

export function OrderBook({
  book,
  baseSymbol,
  midOverride,
  loading,
  change24h,
  onPriceClick,
}: {
  book?: ExchangeDepthBook;
  baseSymbol: string;
  midOverride?: number;
  loading?: boolean;
  change24h?: number;
  /** Click a level to prefill the order form price (OKX behaviour). */
  onPriceClick?: (price: number) => void;
}) {
  const mid = midOverride && midOverride > 0 ? midOverride : book?.mid ?? 0;
  const ticks = useMemo(() => precisionOptions(mid), [mid]);
  const [tickIdx, setTickIdx] = useState(0);
  const tick = ticks[Math.min(tickIdx, ticks.length - 1)] ?? 0;

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

  return (
    <div className="flex h-full min-h-0 flex-col text-[11px]">
      <div className="mb-1 flex items-center justify-between gap-1 px-0.5 text-[10px] text-muted-foreground">
        <span>Price</span>
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
        <span>Qty ({baseSymbol})</span>
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
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          ≈ {mid > 0 ? formatNumber(mid, priceDigits) : "—"}
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

      <div className="mt-2 flex h-1 overflow-hidden rounded-sm bg-muted">
        <div className="bg-[#0ecb81]" style={{ width: `${buyPct}%` }} />
        <div className="bg-[#f6465d]" style={{ width: `${sellPct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold">
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
  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={onClick ? () => onClick(price) : undefined}
      className={cn(
        "relative flex items-center justify-between px-0.5 py-[2px] tabular-nums",
        onClick && "cursor-pointer hover:bg-muted/40",
      )}
    >
      <span
        className="absolute inset-y-0 right-0 rounded-sm opacity-20"
        style={{
          width: `${pct}%`,
          backgroundColor: side === "ask" ? "#f6465d" : "#0ecb81",
        }}
      />
      <span
        className={cn(
          "relative z-[1] font-medium",
          side === "ask" ? "text-[#f6465d]" : "text-[#0ecb81]",
        )}
      >
        {formatNumber(price, priceDigits)}
      </span>
      <span className="relative z-[1] text-muted-foreground">
        {formatNumber(amount, amtDigits)}
      </span>
    </div>
  );
}
