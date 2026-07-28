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
  return (
    <div className={cn("flex flex-col items-center gap-2.5 py-7 text-center", className)}>
      <button
        type="button"
        onClick={onCycleCurrency}
        className="ph-display flex items-center gap-2 press"
        aria-label="Change currency"
      >
        {hideBalance ? "••••" : balanceLabel}
        <ChevronsUpDown className="h-[1.125rem] w-[1.125rem] text-muted-foreground" strokeWidth={1.75} />
      </button>
      {addressLabel ? (
        <button
          type="button"
          onClick={onCopyAddress}
          className="ph-caption flex items-center gap-1.5 transition-colors hover:text-foreground press"
          aria-label="Copy wallet address"
        >
          <span className="font-medium tracking-wide">{addressLabel}</span>
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
