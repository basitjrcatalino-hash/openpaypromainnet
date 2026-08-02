import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import {
  buySellRatio,
  type ExchangeDepthBook,
} from "@/lib/exchange-depth";

export function OrderBook({
  book,
  baseSymbol,
  midOverride,
  loading,
}: {
  book?: ExchangeDepthBook;
  baseSymbol: string;
  midOverride?: number;
  loading?: boolean;
}) {
  const mid = midOverride && midOverride > 0 ? midOverride : book?.mid ?? 0;
  const asks = [...(book?.asks ?? [])].slice(0, 8).reverse();
  const bids = (book?.bids ?? []).slice(0, 8);
  const { buyPct, sellPct } = buySellRatio(book);
  const maxAmt = Math.max(
    0.0001,
    ...asks.map((l) => l.amount),
    ...bids.map((l) => l.amount),
  );

  const priceDigits = mid >= 1000 ? 1 : mid >= 1 ? 2 : 4;
  const amtDigits = mid >= 100 ? 4 : 2;

  return (
    <div className="flex h-full min-h-0 flex-col text-[11px]">
      <div className="mb-1 flex items-center justify-between px-0.5 text-[10px] text-muted-foreground">
        <span>Price (USDT)</span>
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
            />
          ))
        )}
      </div>

      <div className="my-1.5 px-0.5">
        <p
          className={cn(
            "text-base font-bold tabular-nums leading-none",
            "text-foreground",
          )}
        >
          {mid > 0 ? formatNumber(mid, priceDigits) : "—"}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {book?.source ?? "…"}
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
          />
        ))}
      </div>

      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="bg-emerald-500" style={{ width: `${buyPct}%` }} />
        <div className="bg-rose-500" style={{ width: `${sellPct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold">
        <span className="text-emerald-500">B {buyPct}%</span>
        <span className="text-rose-500">{sellPct}% S</span>
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
}: {
  side: "ask" | "bid";
  price: number;
  amount: number;
  maxAmt: number;
  priceDigits: number;
  amtDigits: number;
}) {
  const pct = Math.min(100, (amount / maxAmt) * 100);
  return (
    <div className="relative flex items-center justify-between px-0.5 py-[2px] tabular-nums">
      <span
        className="absolute inset-y-0 right-0 rounded-sm opacity-25"
        style={{
          width: `${pct}%`,
          backgroundColor: side === "ask" ? "rgb(244 63 94)" : "rgb(16 185 129)",
        }}
      />
      <span
        className={cn(
          "relative z-[1] font-medium",
          side === "ask" ? "text-rose-400" : "text-emerald-400",
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
