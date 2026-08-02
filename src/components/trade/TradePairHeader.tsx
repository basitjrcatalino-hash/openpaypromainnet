import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import { pairLabel, type TradeMode } from "@/lib/exchange-depth";
import type { PerpMarket } from "@/lib/perp";

export function TradePairHeader({
  market,
  mode,
  price,
  change24h,
  changeAbs,
  onOpenPicker,
  high24h,
  low24h,
}: {
  market: PerpMarket;
  mode: TradeMode;
  price: number;
  change24h: number;
  changeAbs: number;
  onOpenPicker: () => void;
  high24h?: number;
  low24h?: number;
}) {
  const up = change24h >= 0;
  const digits = price >= 1000 ? 1 : price >= 1 ? 2 : 4;

  return (
    <div className="space-y-2 px-4 pt-3">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onOpenPicker} className="min-w-0 text-left press">
          <div className="inline-flex items-center gap-1.5">
            <span className="text-lg font-bold tracking-tight">{pairLabel(market, mode)}</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                mode === "futures"
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-sky-500/15 text-sky-400",
              )}
            >
              {mode === "futures" ? "Perp" : "Spot"}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <p
            className={cn(
              "mt-1 text-2xl font-bold tabular-nums leading-none",
              up ? "text-emerald-400" : "text-rose-400",
            )}
          >
            {price > 0 ? formatNumber(price, digits) : "—"}
          </p>
          <p
            className={cn(
              "mt-1 text-xs font-semibold tabular-nums",
              up ? "text-emerald-400" : "text-rose-400",
            )}
          >
            {up ? "+" : ""}
            {formatNumber(changeAbs, price >= 100 ? 2 : 4)} ({up ? "+" : ""}
            {formatNumber(change24h, 2)}%)
          </p>
        </button>

        <div className="shrink-0 space-y-1 text-right text-[11px] text-muted-foreground">
          {high24h != null && high24h > 0 ? (
            <p>
              24h high{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {formatNumber(high24h, digits)}
              </span>
            </p>
          ) : null}
          {low24h != null && low24h > 0 ? (
            <p>
              24h low{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {formatNumber(low24h, digits)}
              </span>
            </p>
          ) : null}
          <p className="text-[10px]">Mark {price > 0 ? formatNumber(price, digits) : "—"}</p>
        </div>
      </div>
    </div>
  );
}
