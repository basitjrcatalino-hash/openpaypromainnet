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
    <div className={cn("flex flex-col items-center gap-3 py-6 text-center", className)}>
      <button
        type="button"
        onClick={onCycleCurrency}
        className="flex items-center gap-2 text-[2.75rem] font-bold leading-none tracking-tight tabular-nums press"
        aria-label="Change currency"
      >
        {hideBalance ? "••••" : balanceLabel}
        <ChevronsUpDown className="h-5 w-5 text-muted-foreground" />
      </button>
      {addressLabel ? (
        <button
          type="button"
          onClick={onCopyAddress}
          className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground press"
          aria-label="Copy wallet address"
        >
          <span>{addressLabel}</span>
          {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
        </button>
      ) : null}
    </div>
  );
}
