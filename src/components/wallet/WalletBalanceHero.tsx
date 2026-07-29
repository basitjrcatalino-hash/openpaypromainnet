import { ChevronsUpDown, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  balanceLabel: string;
  addressLabel?: string | null;
  hideBalance?: boolean;
  copied?: boolean;
  onCycleCurrency?: () => void;
  onCopyAddress?: () => void;
  className?: string;
  /** Phantom-style uppercase micro-label above the balance */
  label?: string;
};

export function WalletBalanceHero({
  balanceLabel,
  addressLabel,
  hideBalance,
  copied,
  onCycleCurrency,
  onCopyAddress,
  className,
  label = "Balance",
}: Props) {
  const showAddress = Boolean(addressLabel && addressLabel !== "—");

  return (
    <div className={cn("flex flex-col items-center gap-2 py-6 text-center", className)}>
      <p className="ph-label">{label}</p>
      <button
        type="button"
        onClick={onCycleCurrency}
        className="ph-display flex items-center gap-2 press"
        aria-label="Change currency"
      >
        <span suppressHydrationWarning>{hideBalance ? "••••" : balanceLabel}</span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
      </button>
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
