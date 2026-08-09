import { cn } from "@/lib/utils";
import type { AppMode } from "@/lib/app-mode";

/** OKX-style Exchange / Web3 pill switch. */
export function AppModeSwitch({
  mode,
  onChange,
  className,
}: {
  mode: AppMode;
  onChange: (m: AppMode) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="App mode"
      className={cn("inline-flex rounded-full bg-muted/70 p-1", className)}
    >
      {(
        [
          ["exchange", "Exchange"],
          ["web3", "Web3"],
        ] as const
      ).map(([id, label]) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "rounded-full px-5 py-1.5 text-sm font-bold transition-colors press",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
