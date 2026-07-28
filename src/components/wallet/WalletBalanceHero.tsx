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
};

export function WalletBalanceHero({
  balanceLabel,
  addressLabel,
  hideBalance,
  copied,
  onCycleCurrency,
  onCopyAddress,
  className,
}: Props) {
  const showAddress = Boolean(addressLabel && addressLabel !== "—");

  return (
    <div className={cn("flex flex-col items-center gap-2.5 py-7 text-center", className)}>
      <button
        type="button"
        onClick={onCycleCurrency}
        className="ph-display flex items-center gap-2 press"
        aria-label="Change currency"
      >
        <span suppressHydrationWarning>{hideBalance ? "••••" : balanceLabel}</span>
        <ChevronsUpDown className="h-4.5 w-4.5 text-muted-foreground" strokeWidth={1.75} />
      </button>
      {showAddress ? (
        <button
          type="button"
          onClick={onCopyAddress}
          className="ph-caption flex items-center gap-1.5 transition-colors hover:text-foreground press"
          aria-label="Copy wallet address"
        >
          <span className="font-medium tracking-wide" suppressHydrationWarning>
            {addressLabel}
          </span>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
        </button>
      ) : null}
    </div>
  );
}
