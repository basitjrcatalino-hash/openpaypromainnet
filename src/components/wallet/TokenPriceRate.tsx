import { formatTokenPrice, getDisplayCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { formatPct } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

type TokenPriceRateProps = {
  price: number;
  change: number;
  currency?: CurrencyCode;
  className?: string;
};

/** Phantom home-row: unit price + red/green 24h rate on one line. */
export function TokenPriceRate({
  price,
  change,
  currency,
  className,
}: TokenPriceRateProps) {
  const code = currency ?? getDisplayCurrencyCode();
  const up = change >= 0;
  return (
    <div
      className={cn(
        "flex shrink-0 items-baseline justify-end gap-1.5 tabular-nums tracking-tight",
        className,
      )}
    >
      <span className="text-[15px] font-bold text-foreground">
        {formatTokenPrice(price, code)}
      </span>
      <span
        className={cn(
          "text-[12px] font-bold",
          up ? "text-success" : "text-destructive",
        )}
      >
        {formatPct(change)}
      </span>
    </div>
  );
}
