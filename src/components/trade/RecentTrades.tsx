import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import type { RecentTrade } from "@/lib/exchange-depth";

function fmtTime(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

export function RecentTrades({
  trades,
  loading,
}: {
  trades?: RecentTrade[];
  loading?: boolean;
}) {
  const rows = trades ?? [];
  const priceDigits = rows[0]?.price && rows[0].price >= 1000 ? 1 : rows[0]?.price && rows[0].price >= 1 ? 2 : 4;

  return (
    <div className="flex h-full min-h-0 flex-col text-[10px]">
      <div className="mb-1 flex justify-between px-0.5 text-muted-foreground">
        <span>Price</span>
        <span>Amount</span>
        <span>Time</span>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain">
        {loading && !rows.length ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-3.5 animate-pulse rounded bg-muted/40" />
          ))
        ) : !rows.length ? (
          <p className="py-4 text-center text-muted-foreground">No trades</p>
        ) : (
          rows.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-1 tabular-nums"
            >
              <span
                className={cn(
                  "min-w-0 flex-1 font-medium",
                  t.side === "buy" ? "text-[#0ecb81]" : "text-[#f6465d]",
                )}
              >
                {formatNumber(t.price, priceDigits)}
              </span>
              <span className="min-w-0 flex-1 text-right text-muted-foreground">
                {formatNumber(t.amount, t.amount >= 1 ? 3 : 4)}
              </span>
              <span className="w-[4.25rem] shrink-0 text-right text-muted-foreground">
                {fmtTime(t.time)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
