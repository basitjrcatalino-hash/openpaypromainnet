import { formatNumber, formatUSD, shortAddress } from "@/lib/wallet-utils";
import { ExternalLink } from "lucide-react";

export function TokenStats({ token }: { token: Record<string, any> }) {
  const explorer = token.contract_address
    ? `https://openledger.app/tx/${token.contract_address}`
    : null;

  const items = [
    { label: "Market cap", value: formatUSD(token.market_cap, { compact: true }) },
    { label: "Volume 24h", value: formatUSD(token.volume_24h, { compact: true }) },
    { label: "Liquidity (π)", value: formatNumber(token.curve_reserve_pi, 2) },
    { label: "Holders", value: formatNumber(token.holder_count ?? 0, 0) },
    { label: "Price", value: `${formatNumber(token.price_usd, 8)} π` },
    { label: "Supply", value: formatNumber(token.total_supply, 0) },
  ];

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <div className="text-sm font-semibold">Analytics</div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((i) => (
          <div key={i.label}>
            <div className="text-[11px] text-muted-foreground">{i.label}</div>
            <div className="text-sm font-semibold tabular-nums">{i.value}</div>
          </div>
        ))}
      </div>
      {token.contract_address && (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs">
          <span className="text-muted-foreground">Contract</span>
          <span className="font-mono">{shortAddress(token.contract_address)}</span>
        </div>
      )}
      {explorer && (
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          OpenLedger explorer <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
