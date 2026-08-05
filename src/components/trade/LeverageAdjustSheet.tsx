import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import { PERP_LEVERAGE_OPTIONS } from "@/lib/perp";
import { liquidationPrice } from "@/lib/trade-advanced";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const PRESETS = PERP_LEVERAGE_OPTIONS.filter((n) => n >= 1);

/** OKX-style dual long/short leverage adjuster. */
export function LeverageAdjustSheet({
  open,
  onOpenChange,
  longLev,
  shortLev,
  onLongLev,
  onShortLev,
  entryPrice,
  available,
  baseSymbol,
  quoteSymbol = "USDT",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  longLev: number;
  shortLev: number;
  onLongLev: (n: number) => void;
  onShortLev: (n: number) => void;
  entryPrice: number;
  available: number;
  baseSymbol: string;
  quoteSymbol?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl border-border/50 px-4 pb-8 pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <SheetHeader className="mb-4 text-left">
          <SheetTitle className="text-base font-bold">Adjust leverage</SheetTitle>
        </SheetHeader>

        <LeverageBlock
          label="Long"
          accent="long"
          value={longLev}
          onChange={onLongLev}
          entryPrice={entryPrice}
          available={available}
          baseSymbol={baseSymbol}
          quoteSymbol={quoteSymbol}
        />
        <div className="my-5 border-t border-border/40" />
        <LeverageBlock
          label="Short"
          accent="short"
          value={shortLev}
          onChange={onShortLev}
          entryPrice={entryPrice}
          available={available}
          baseSymbol={baseSymbol}
          quoteSymbol={quoteSymbol}
        />

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-[#c8f542] text-sm font-bold text-black press"
        >
          Confirm
        </button>
      </SheetContent>
    </Sheet>
  );
}

function LeverageBlock({
  label,
  accent,
  value,
  onChange,
  entryPrice,
  available,
  baseSymbol,
  quoteSymbol,
}: {
  label: string;
  accent: "long" | "short";
  value: number;
  onChange: (n: number) => void;
  entryPrice: number;
  available: number;
  baseSymbol: string;
  quoteSymbol: string;
}) {
  const maxNotional = available * value;
  const maxSize = entryPrice > 0 ? maxNotional / entryPrice : 0;
  const liq = liquidationPrice(accent === "long" ? "long" : "short", entryPrice, value);
  const digits = entryPrice >= 1000 ? 1 : entryPrice >= 1 ? 2 : 4;
  const color = accent === "long" ? "text-[#0ecb81]" : "text-[#f6465d]";

  function step(dir: -1 | 1) {
    const idx = PRESETS.indexOf(value as (typeof PRESETS)[number]);
    const next =
      idx >= 0
        ? PRESETS[Math.max(0, Math.min(PRESETS.length - 1, idx + dir))]
        : Math.max(1, Math.min(20, value + dir));
    if (next != null) onChange(next);
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => step(-1)}
          className="grid h-9 w-9 place-items-center rounded-full bg-muted/70 text-foreground press"
          aria-label={`Decrease ${label} leverage`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <p className={cn("min-w-20 text-center text-3xl font-bold tabular-nums", color)}>
          {formatNumber(value, 2)}x
        </p>
        <button
          type="button"
          onClick={() => step(1)}
          className="grid h-9 w-9 place-items-center rounded-full bg-muted/70 text-foreground press"
          aria-label={`Increase ${label} leverage`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-full bg-muted/50 p-1 scrollbar-none">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "min-w-10 flex-1 rounded-full px-2 py-1.5 text-[11px] font-bold press",
              value === p
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p}x
          </button>
        ))}
      </div>
      <div className="space-y-1 text-[11px] text-muted-foreground">
        <p>
          Max position size at adjusted leverage:{" "}
          <span className="font-semibold text-foreground">
            {formatNumber(maxSize, 4)} {baseSymbol}
          </span>
        </p>
        <p>
          Margin required:{" "}
          <span className="font-semibold text-foreground">
            {formatNumber(available, 4)} {quoteSymbol}
          </span>
        </p>
        <p>
          Estimated liquidation price:{" "}
          <span className="font-semibold text-foreground">
            {liq > 0 ? formatNumber(liq, digits) : "—"}
          </span>
        </p>
      </div>
    </div>
  );
}
