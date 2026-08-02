import { ExternalLink } from "lucide-react";
import type { PerpMarket } from "@/lib/perp";
import type { MajorMarketSnapshot } from "@/lib/major-tokens";
import { getMajorToken } from "@/lib/major-tokens";
import {
  cmcInfoForMarket,
  formatCompactUsd,
  formatSupply,
} from "@/lib/coinmarketcap-trade";
import { TokenMarketInsights } from "@/components/wallet/TokenMarketInsights";
import { formatNumber, formatPct } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

type BaseProps = {
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

function HeaderCard({
  market,
  mode,
  price,
  change24h,
  mark,
}: Omit<BaseProps, "className">) {
  const cmc = cmcInfoForMarket(market);
  const up = change24h >= 0;
  const px = price > 0 ? price : mark?.price ?? 0;
  const digits = px >= 1000 ? 1 : px >= 1 ? 2 : px >= 0.1 ? 4 : 6;

  return (
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
  );
}

/** CoinMarketCap-style Overview for Spot / Perpetual Trade Info. */
export function TradeTokenInfo(props: BaseProps) {
  const { market, mode, mark, className } = props;
  const cmc = cmcInfoForMarket(market);

  return (
    <div className={cn("space-y-3", className)}>
      <HeaderCard {...props} />

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

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/50 bg-card/30 p-3 text-[11px]">
        {cmc.overviewFacts.map((f) => (
          <div key={f.label}>
            <p className="text-muted-foreground">{f.label}</p>
            <p className="mt-0.5 font-semibold text-foreground">{f.value}</p>
          </div>
        ))}
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
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Source:{" "}
          <a
            href={cmc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#3861FB] underline-offset-2 hover:underline"
          >
            coinmarketcap.com/currencies/{cmc.slug}/
          </a>
        </p>
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
        {cmc.whitepaper ? (
          <a
            href={cmc.whitepaper}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-border/60 px-3 text-xs font-semibold text-foreground press"
          >
            Whitepaper
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Spot + Perpetual Trade Info News — same Related News / insights as the
 * token asset page (TokenMarketInsights).
 */
export function TradeTokenNews({
  market,
  mode,
  price,
  change24h,
  mark,
  className,
}: BaseProps) {
  const cmc = cmcInfoForMarket(market);
  const major = getMajorToken(market.toLowerCase());
  const px = price > 0 ? price : mark?.price ?? 0;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground">
          {cmc.name} · {mode === "futures" ? "Perpetual" : "Spot"} token news
        </p>
        <a
          href={cmc.newsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3861FB] press"
        >
          CMC <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <TokenMarketInsights
        tokenKey={`trade-${mode}-${market.toLowerCase()}`}
        name={major?.name ?? cmc.name}
        symbol={major?.symbol ?? cmc.symbol}
        network={major?.network ?? cmc.name}
        category={major?.category ?? cmc.tags[0] ?? "Layer 1"}
        priceUsd={px}
        change24h={change24h}
        marketCap={mark?.marketCap ?? null}
        volume24h={mark?.volume24h ?? null}
        description={major?.about ?? cmc.about}
        hideChat
      />
    </div>
  );
}

/** CoinMarketCap-style Analysis for Spot / Perpetual Trade Info. */
export function TradeTokenAnalysis({
  market,
  mode,
  price,
  change24h,
  mark,
  className,
}: BaseProps) {
  const cmc = cmcInfoForMarket(market);
  const note = mode === "futures" ? cmc.analysis.perpNote : cmc.analysis.spotNote;

  return (
    <div className={cn("space-y-3", className)}>
      <HeaderCard market={market} mode={mode} price={price} change24h={change24h} mark={mark} />

      <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Market analysis · {cmc.symbol}
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/90">
          {cmc.analysis.summary}
        </p>
      </div>

      <div className="space-y-2">
        {cmc.analysis.points.map((p) => (
          <div
            key={p.title}
            className="rounded-xl border border-border/50 bg-card/30 px-3 py-3"
          >
            <p className="text-[12px] font-semibold text-foreground">{p.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {p.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {mode === "futures" ? "Perpetual" : "Spot"} note
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/90">{note}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/50 bg-card/40 p-3 text-[11px]">
        <Stat label="Market cap" value={formatCompactUsd(mark?.marketCap ?? 0)} />
        <Stat label="Volume (24h)" value={formatCompactUsd(mark?.volume24h ?? 0)} />
        <Stat
          label="ATH"
          value={mark?.ath ? `$${formatNumber(mark.ath, mark.ath >= 1000 ? 0 : 2)}` : "—"}
        />
        <Stat
          label="ATL"
          value={mark?.atl ? `$${formatNumber(mark.atl, mark.atl >= 1 ? 2 : 4)}` : "—"}
        />
      </div>

      <a
        href={cmc.analysisUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-[#3861FB] px-3 text-xs font-bold text-white press hover:bg-[#3861FB]/90"
      >
        Full analysis on CoinMarketCap <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
