import { ExternalLink } from "lucide-react";
import type { PerpMarket } from "@/lib/perp";
import type { MajorMarketSnapshot } from "@/lib/major-tokens";
import {
  cmcInfoForMarket,
  formatCompactUsd,
  formatSupply,
} from "@/lib/coinmarketcap-trade";
import { formatNumber, formatPct } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

type Props = {
  market: PerpMarket;
  mode: "spot" | "futures";
  price: number;
  change24h: number;
  mark?: MajorMarketSnapshot;
  className?: string;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/** CoinMarketCap-style token info for Spot / Perpetual Trade Info. */
export function TradeTokenInfo({ market, mode, price, change24h, mark, className }: Props) {
  const cmc = cmcInfoForMarket(market);
  const up = change24h >= 0;
  const px = price > 0 ? price : mark?.price ?? 0;
  const digits = px >= 1000 ? 1 : px >= 1 ? 2 : px >= 0.1 ? 4 : 6;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-card/40 px-3 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
              #{cmc.rank}
            </span>
            <h3 className="truncate text-sm font-bold text-foreground">
              {cmc.name}{" "}
              <span className="font-semibold text-muted-foreground">{cmc.symbol}</span>
            </h3>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {mode === "futures" ? "Perpetual" : "Spot"} · CoinMarketCap
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-bold tabular-nums text-foreground">
            {px > 0 ? `$${formatNumber(px, digits)}` : "—"}
          </p>
          <p
            className={cn(
              "text-[12px] font-semibold tabular-nums",
              up ? "text-[#0ecb81]" : "text-[#f6465d]",
            )}
          >
            {formatPct(change24h)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/50 bg-card/40 p-3 text-[11px]">
        <Stat label="Market cap" value={formatCompactUsd(mark?.marketCap ?? 0)} />
        <Stat label="Volume (24h)" value={formatCompactUsd(mark?.volume24h ?? 0)} />
        <Stat
          label="Circulating supply"
          value={formatSupply(mark?.circulatingSupply ?? 0, cmc.symbol)}
        />
        <Stat
          label="Max supply"
          value={
            cmc.maxSupply != null
              ? formatSupply(cmc.maxSupply, cmc.symbol)
              : formatSupply(mark?.totalSupply ?? 0, cmc.symbol) + " (total)"
          }
        />
        <Stat
          label="All-time high"
          value={mark?.ath ? `$${formatNumber(mark.ath, mark.ath >= 1000 ? 0 : 2)}` : "—"}
        />
        <Stat
          label="All-time low"
          value={mark?.atl ? `$${formatNumber(mark.atl, mark.atl >= 1 ? 2 : 4)}` : "—"}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {cmc.tags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-muted/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="rounded-xl border border-border/50 bg-card/30 px-3 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          About {cmc.name}
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/90">{cmc.about}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={cmc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#3861FB] px-3 text-xs font-bold text-white press hover:bg-[#3861FB]/90"
        >
          CoinMarketCap <ExternalLink className="h-3 w-3" />
        </a>
        {cmc.website ? (
          <a
            href={cmc.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-border/60 px-3 text-xs font-semibold text-foreground press"
          >
            Website
          </a>
        ) : null}
        {cmc.explorer ? (
          <a
            href={cmc.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-border/60 px-3 text-xs font-semibold text-foreground press"
          >
            Explorer
          </a>
        ) : null}
      </div>
    </div>
  );
}
