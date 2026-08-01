import { OusdIcon } from "@/components/ousd-icon";
import { MAJOR_TOKENS } from "@/lib/major-tokens";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import type { TransferAsset } from "@/lib/account-transfer";
import type { PortfolioAssetRow } from "@/lib/account-portfolio";

function AssetMark({ asset, className }: { asset: TransferAsset; className?: string }) {
  if (asset === "OUSD") return <OusdIcon className={cn("h-9 w-9", className)} />;
  const id = asset.toLowerCase() as keyof typeof MAJOR_TOKENS;
  const logo = MAJOR_TOKENS[id]?.logoUrl;
  if (logo) {
    return <img src={logo} alt="" className={cn("h-9 w-9 rounded-full object-cover", className)} />;
  }
  return (
    <span
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground",
        className,
      )}
    >
      {asset.slice(0, 3)}
    </span>
  );
}

export function AccountAssetList({
  rows,
  valueFormatter,
  hideBalance,
  amountLabel = "Available",
  emptyText = "No assets in this account yet.",
}: {
  rows: PortfolioAssetRow[];
  valueFormatter: (usd: number) => string;
  hideBalance?: boolean;
  amountLabel?: string;
  emptyText?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Name</span>
        <span>{amountLabel}</span>
      </div>
      {!rows.length ? (
        <p className="rounded-2xl border border-border/50 bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/70">
          {rows.map((row, i) => (
            <div
              key={row.asset}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5",
                i < rows.length - 1 && "border-b border-border/50",
              )}
            >
              <AssetMark asset={row.asset} />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold tracking-tight">{row.asset}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums">
                  {hideBalance ? "••••" : formatNumber(row.balance, row.balance >= 1 ? 4 : 8)}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {hideBalance ? "••••" : valueFormatter(row.valueUsd)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
