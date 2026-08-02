import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import { pairLabel, type TradeMode } from "@/lib/exchange-depth";
import type { PerpMarket } from "@/lib/perp";

function formatVol(v: number): string {
  if (!(v > 0)) return "—";
  if (v >= 1e9) return `${formatNumber(v / 1e9, 2)}B`;
  if (v >= 1e6) return `${formatNumber(v / 1e6, 2)}M`;
  if (v >= 1e3) return `${formatNumber(v / 1e3, 1)}K`;
  return formatNumber(v, 0);
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] leading-none text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-[10px] font-semibold tabular-nums text-foreground",
          valueClass,
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function TradePairHeader({
  market,
  mode,
  price,
  change24h,
  changeAbs,
  onOpenPicker,
  high24h,
  low24h,
  volume24h,
  markPrice,
  indexPrice,
  fundingRate,
  source,
  compact,
}: {
  market: PerpMarket;
  mode: TradeMode;
  price: number;
  change24h: number;
  changeAbs: number;
  onOpenPicker: () => void;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  markPrice?: number;
  indexPrice?: number;
  fundingRate?: number;
  source?: string;
  compact?: boolean;
}) {
  const up = change24h >= 0;
  const digits = price >= 1000 ? 1 : price >= 1 ? 2 : 4;
  const mark = markPrice && markPrice > 0 ? markPrice : price;
  const index = indexPrice && indexPrice > 0 ? indexPrice : undefined;
  const funding =
    fundingRate != null && Number.isFinite(fundingRate)
      ? `${fundingRate >= 0 ? "+" : ""}${formatNumber(fundingRate, 4)}%`
      : "—";

  return (
    <div className={cn("space-y-2 px-3", compact ? "pt-1.5 pb-1" : "pt-3")}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onOpenPicker} className="min-w-0 text-left press">
          <div className="inline-flex items-center gap-1.5">
            <span className={cn("font-bold tracking-tight", compact ? "text-[15px]" : "text-[17px]")}>
              {pairLabel(market, mode)}
            </span>
            <span
              className={cn(
                "rounded-[3px] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                mode === "futures"
                  ? "bg-[#ffad0a]/15 text-[#ffad0a]"
                  : "bg-sky-500/15 text-sky-400",
              )}
            >
              {mode === "futures" ? "Perp" : "Spot"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p
            className={cn(
              "mt-1 font-bold tabular-nums leading-none tracking-tight",
              compact ? "text-[22px]" : "text-[28px]",
              up ? "text-[#0ecb81]" : "text-[#f6465d]",
            )}
          >
            {price > 0 ? formatNumber(price, digits) : "—"}
          </p>
          <p
            className={cn(
              "mt-1 text-[11px] font-semibold tabular-nums",
              up ? "text-[#0ecb81]" : "text-[#f6465d]",
            )}
          >
            {up ? "+" : ""}
            {formatNumber(changeAbs, price >= 100 ? 2 : 4)} ({up ? "+" : ""}
            {formatNumber(change24h, 2)}%)
          </p>
          {source && !compact ? (
            <p className="mt-1 text-[10px] text-muted-foreground">{source}</p>
          ) : null}
        </button>

        <div className="grid shrink-0 grid-cols-2 gap-x-3 gap-y-1.5 text-right">
          <Stat label="24h high" value={high24h && high24h > 0 ? formatNumber(high24h, digits) : "—"} />
          <Stat label="24h low" value={low24h && low24h > 0 ? formatNumber(low24h, digits) : "—"} />
          <Stat label="Mark" value={mark > 0 ? formatNumber(mark, digits) : "—"} />
          <Stat
            label="Index"
            value={index != null ? formatNumber(index, digits) : mark > 0 ? formatNumber(mark, digits) : "—"}
          />
          {mode === "futures" ? (
            <>
              <Stat
                label="Funding"
                value={funding}
                valueClass={
                  fundingRate != null
                    ? fundingRate >= 0
                      ? "text-[#0ecb81]"
                      : "text-[#f6465d]"
                    : undefined
                }
              />
              <Stat label="24h vol" value={formatVol(volume24h ?? 0)} />
            </>
          ) : (
            <Stat label="24h vol" value={formatVol(volume24h ?? 0)} />
          )}
        </div>
      </div>
    </div>
  );
}
