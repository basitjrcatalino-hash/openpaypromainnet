import { ChevronsUpDown, Copy, Check, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  balanceLabel: string;
  addressLabel?: string | null;
  hideBalance?: boolean;
  copied?: boolean;
  onCycleCurrency?: () => void;
  onToggleHide?: () => void;
  onCopyAddress?: () => void;
  className?: string;
  /** Phantom-style uppercase micro-label above the balance */
  label?: string;
  /** Compact sizing for the sidebar / drawer */
  size?: "default" | "sidebar";
};

export function WalletBalanceHero({
  balanceLabel,
  addressLabel,
  hideBalance,
  copied,
  onCycleCurrency,
  onToggleHide,
  onCopyAddress,
  className,
  label = "Balance",
  size = "default",
}: Props) {
  const showAddress = Boolean(addressLabel && addressLabel !== "—");
  const sidebar = size === "sidebar";

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        sidebar ? "gap-1.5 py-2" : "gap-2 py-6",
        className,
      )}
    >
      <p className="ph-label">{label}</p>
      <div className="flex max-w-full items-center justify-center gap-1">
        <button
          type="button"
          onClick={onCycleCurrency}
          className={cn(
            "flex min-w-0 items-center justify-center gap-1.5 press",
            sidebar ? "ph-display-sidebar" : "ph-display",
          )}
          aria-label="Change currency"
        >
          <span className="min-w-0 truncate tabular-nums" suppressHydrationWarning>
            {hideBalance ? "••••" : balanceLabel}
          </span>
          <ChevronsUpDown
            className={cn("shrink-0 text-muted-foreground", sidebar ? "h-3.5 w-3.5" : "h-4 w-4")}
            strokeWidth={2}
          />
        </button>
        {onToggleHide ? (
          <button
            type="button"
            onClick={onToggleHide}
            className={cn(
              "shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground press",
              sidebar ? "p-1" : "p-1.5",
            )}
            aria-label={hideBalance ? "Show balance" : "Hide balance"}
          >
            {hideBalance ? (
              <EyeOff className={cn(sidebar ? "h-3.5 w-3.5" : "h-4 w-4")} strokeWidth={2} />
            ) : (
              <Eye className={cn(sidebar ? "h-3.5 w-3.5" : "h-4 w-4")} strokeWidth={2} />
            )}
          </button>
        ) : null}
      </div>
      {showAddress ? (
        <button
          type="button"
          onClick={onCopyAddress}
          className="ph-caption mt-0.5 flex items-center gap-1.5 transition-colors hover:text-foreground press"
          aria-label="Copy wallet address"
        >
          <span className="font-semibold tracking-wide" suppressHydrationWarning>
            {addressLabel}
          </span>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
      ) : null}
    </div>
  );
}
