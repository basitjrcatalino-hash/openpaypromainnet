import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { getTokenMarketInsights } from "@/lib/token-insights.functions";
import { useChromeVisible } from "@/hooks/chrome-visible";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/wallet-utils";

export type TokenMarketInsightsProps = {
  tokenKey: string;
  name: string;
  symbol: string;
  network: string;
  category?: string | null;
  priceUsd: number;
  change24h: number;
  marketCap?: number | null;
  volume24h?: number | null;
  description?: string | null;
  /** OpenToken live chat route when available */
  chatTokenId?: string | null;
  chatPreview?: string | null;
  chatHereCount?: number;
};

function relativeAgo(iso: string | undefined): string {
  if (!iso) return "Just now";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return "Just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function MetricRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-3 text-[15px]",
        !last && "border-b border-white/5",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function pctClass(n: number) {
  return n >= 0
    ? "text-emerald-500 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400";
}

/**
 * Phantom-style market metrics, AI insight blurb, Related News, Related Lists.
 */
export function TokenMarketInsights(props: TokenMarketInsightsProps) {
  const fetchInsights = useServerFn(getTokenMarketInsights);

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "token-market-insights",
      props.tokenKey,
      Math.round(props.priceUsd * 100),
      Math.round(props.change24h * 100),
    ],
    staleTime: 5 * 60_000,
    queryFn: () =>
      fetchInsights({
        data: {
          tokenKey: props.tokenKey,
          name: props.name,
          symbol: props.symbol,
          network: props.network,
          category: props.category ?? null,
          priceUsd: props.priceUsd,
          change24h: props.change24h,
          marketCap: props.marketCap ?? null,
          volume24h: props.volume24h ?? null,
          description: props.description ?? null,
        },
      }),
  });

  const summary = data?.summary;
  const news = data?.news ?? [];
  const lists = data?.lists ?? [];

  const metrics = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (props.volume24h != null && props.volume24h > 0) {
      rows.push({ label: "24h Volume", value: formatUSD(props.volume24h) });
    }
    if (props.marketCap != null && props.marketCap > 0) {
      rows.push({ label: "Market cap", value: formatUSD(props.marketCap) });
    }
    rows.push({ label: "Network", value: props.network });
    if (props.category) {
      rows.push({ label: "Category", value: props.category });
    }
    return rows;
  }, [props.volume24h, props.marketCap, props.network, props.category]);

  return (
    <div className="space-y-7">
      {/* Live Chat teaser — Phantom */}
      {props.chatTokenId && (
        <section>
          <Link
            to="/opentoken/$tokenId/chat"
            params={{ tokenId: props.chatTokenId }}
            className="flex items-center gap-1.5 text-[17px] font-bold text-foreground"
          >
            Live Chat
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            {(props.chatHereCount ?? 0) > 0 && (
              <span className="ml-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {props.chatHereCount} here
              </span>
            )}
          </Link>
          {props.chatPreview && (
            <div className="mt-3 rounded-2xl bg-muted/60 px-3.5 py-3 text-sm leading-snug text-foreground/90">
              {props.chatPreview}
            </div>
          )}
        </section>
      )}

      {/* AI market insight — Phantom "Generated from market insights" */}
      <section>
        {isLoading && !summary ? (
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-muted/70" />
            <div className="h-4 w-[92%] animate-pulse rounded bg-muted/70" />
            <div className="h-4 w-[70%] animate-pulse rounded bg-muted/70" />
          </div>
        ) : (
          <>
            <p className="text-[15px] leading-relaxed text-foreground/90">
              {summary ??
                (isError
                  ? `${props.name} market insight is temporarily unavailable.`
                  : null)}
            </p>
            {summary && (
              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{relativeAgo(data?.generatedAt)}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  Generated from market insights
                  <Sparkles className="h-3 w-3 text-violet-400" />
                </span>
              </div>
            )}
          </>
        )}
      </section>

      {/* Key metrics — Phantom info sheet style */}
      {metrics.length > 0 && (
        <section>
          <div className="divide-y-0">
            {metrics.map((m, i) => (
              <MetricRow
                key={m.label}
                label={m.label}
                value={m.value}
                last={i === metrics.length - 1}
              />
            ))}
          </div>
        </section>
      )}

      {/* Related News */}
      {(news.length > 0 || isLoading) && (
        <section>
          <h2 className="mb-4 text-xl font-bold tracking-tight text-foreground">
            Related News
          </h2>
          {isLoading && news.length === 0 ? (
            <div className="space-y-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-28 animate-pulse rounded bg-muted/70" />
                  <div className="h-4 w-full animate-pulse rounded bg-muted/70" />
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-5">
              {news.map((item) => (
                <li key={item.headline}>
                  <div className="mb-1 text-[13px] text-muted-foreground">
                    {item.sources} Source{item.sources === 1 ? "" : "s"} ·{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        item.sentiment === "Bullish" &&
                          "text-emerald-500 dark:text-emerald-400",
                        item.sentiment === "Bearish" &&
                          "text-red-500 dark:text-red-400",
                        item.sentiment === "Neutral" && "text-foreground/80",
                      )}
                    >
                      {item.sentiment}
                    </span>
                  </div>
                  <p className="text-[15px] font-semibold leading-snug text-foreground">
                    {item.headline}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Related Lists */}
      {(lists.length > 0 || isLoading) && (
        <section>
          <h2 className="mb-3 text-xl font-bold tracking-tight text-foreground">
            Related Lists
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {(lists.length
              ? lists
              : [
                  { name: "Featured", changePct: 0 },
                  { name: "Top Volume", changePct: 0 },
                  { name: "Trending", changePct: 0 },
                  { name: "Top Losers", changePct: 0 },
                ]
            ).map((list) => (
              <div
                key={list.name}
                className="flex items-center justify-between gap-2 rounded-full bg-muted/70 px-3.5 py-2.5"
              >
                <span className="truncate text-sm font-medium text-foreground">
                  {list.name}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    lists.length ? pctClass(list.changePct) : "text-muted-foreground",
                  )}
                >
                  {list.changePct > 0 ? "+" : ""}
                  {list.changePct.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Phantom lavender Trade CTA bar — market cap + Trade. */
export function PhantomAssetTradeBar({
  marketCapLabel,
  onTrade,
}: {
  marketCapLabel: string;
  onTrade: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const chromeVisible = useChromeVisible();
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "ph-trade-bar border-t border-border/50 bg-background/95 px-4 py-3 backdrop-blur-xl",
        "transition-[transform,bottom] duration-300 ease-out",
        chromeVisible ? "translate-y-0" : "translate-y-full",
      )}
      data-chrome={chromeVisible ? "visible" : "hidden"}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <div className="min-w-0 flex-1 text-sm font-medium text-foreground">
          {marketCapLabel}
        </div>
        <button
          type="button"
          onClick={onTrade}
          className="h-11 min-w-30 rounded-full bg-[#ABA3FF] px-8 text-[15px] font-bold text-black transition hover:bg-[#B8B0FF] active:bg-[#9D94F5] press"
        >
          Trade
        </button>
      </div>
    </div>,
    document.body,
  );
}
