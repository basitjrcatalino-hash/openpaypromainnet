import { formatTokenPrice, type CurrencyCode } from "@/lib/currency";
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
  currency = "USD",
  className,
}: TokenPriceRateProps) {
  const up = change >= 0;
  return (
    <div
      className={cn(
        "flex shrink-0 items-baseline justify-end gap-2 tabular-nums",
        className,
      )}
    >
      <span className="text-[15px] font-semibold text-foreground">
        {formatTokenPrice(price, currency)}
      </span>
      <span
        className={cn(
          "text-[13px] font-semibold",
          up ? "text-success" : "text-destructive",
        )}
      >
        {formatPct(change)}
      </span>
    </div>
  );
}
