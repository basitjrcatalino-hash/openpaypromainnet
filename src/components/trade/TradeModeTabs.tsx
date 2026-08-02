import { cn } from "@/lib/utils";
import type { TradeMode } from "@/lib/exchange-depth";

export function TradeModeTabs({
  mode,
  onChange,
  className,
}: {
  mode: TradeMode;
  onChange: (m: TradeMode) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end gap-5", className)}>
      {(
        [
          ["spot", "Spot"],
          ["futures", "Futures"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "relative pb-2 pt-1 text-[15px] font-semibold tracking-tight press",
            mode === id ? "text-foreground" : "text-muted-foreground/80",
          )}
        >
          {label}
          {mode === id ? (
            <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#ffad0a]" />
          ) : null}
        </button>
      ))}
    </div>
  );
}
