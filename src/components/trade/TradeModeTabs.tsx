import { cn } from "@/lib/utils";
import type { TradeMode } from "@/lib/exchange-depth";

export function TradeModeTabs({
  mode,
  onChange,
}: {
  mode: TradeMode;
  onChange: (m: TradeMode) => void;
}) {
  return (
    <div className="flex items-end gap-4 border-b border-border/50 px-4">
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
            "relative pb-2.5 pt-3 text-[15px] font-semibold press",
            mode === id ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
          {mode === id ? (
            <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground" />
          ) : null}
        </button>
      ))}
    </div>
  );
}
