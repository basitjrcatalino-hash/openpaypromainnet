import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { getTokenMarketInsights } from "@/lib/token-insights.functions";
import type {
  TokenInsightList,
  TokenInsightNews,
} from "@/lib/token-insights.functions";
import { useChromeVisible } from "@/hooks/chrome-visible";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/wallet-utils";

/** Official OKX mark — five squares in an X */
function OkxLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <title>OKX</title>
      <rect x="0" y="0" width="14" height="14" rx="1.5" />
      <rect x="34" y="0" width="14" height="14" rx="1.5" />
      <rect x="17" y="17" width="14" height="14" rx="1.5" />
      <rect x="0" y="34" width="14" height="14" rx="1.5" />
      <rect x="34" y="34" width="14" height="14" rx="1.5" />
    </svg>
  );
}

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
  /** Live Chat route — `/asset/$tokenId/chat` for any asset (majors, OUSD, OpenToken) */
  chatTokenId?: string | null;
  chatPreview?: string | null;
  chatHereCount?: number;
  /** Hide Live Chat teaser (e.g. Trade Info already has its own chat link) */
  hideChat?: boolean;
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

  const priceUsd = Number.isFinite(props.priceUsd) ? props.priceUsd : 0;
  const change24h = Number.isFinite(props.change24h) ? props.change24h : 0;
  const marketCap =
    props.marketCap != null && Number.isFinite(props.marketCap) ? props.marketCap : null;
  const volume24h =
    props.volume24h != null && Number.isFinite(props.volume24h) ? props.volume24h : null;
  const description = (props.description ?? "").trim().slice(0, 600) || null;

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "token-market-insights",
      props.tokenKey,
      Math.round(priceUsd * 100),
      Math.round(change24h * 100),
    ],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: () =>
      fetchInsights({
        data: {
          tokenKey: props.tokenKey.slice(0, 80),
          name: props.name.slice(0, 80) || props.symbol,
          symbol: props.symbol.slice(0, 24) || "TOKEN",
          network: props.network.slice(0, 40) || "Unknown",
          category: props.category?.slice(0, 40) ?? null,
          priceUsd,
          change24h,
          marketCap,
          volume24h,
          description,
        },
      }),
  });

  const summary = data?.summary;
  const news: TokenInsightNews[] = Array.isArray(data?.news) ? data.news : [];
  const lists: TokenInsightList[] = Array.isArray(data?.lists) ? data.lists : [];

  const metrics = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (volume24h != null && volume24h > 0) {
      rows.push({ label: "24h Volume", value: formatUSD(volume24h) });
    }
    if (marketCap != null && marketCap > 0) {
      rows.push({ label: "Market cap", value: formatUSD(marketCap) });
    }
    rows.push({ label: "Network", value: props.network });
    if (props.category) {
      rows.push({ label: "Category", value: props.category });
    }
    return rows;
  }, [volume24h, marketCap, props.network, props.category]);

  return (
    <div className="space-y-7">
      {/* Live Chat teaser — Phantom */}
      {!props.hideChat && props.chatTokenId && (
        <section>
          <Link
            to="/asset/$tokenId/chat"
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
                  <OkxLogo className="h-3.5 w-3.5 shrink-0 text-foreground" />
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
              {news.map((item: TokenInsightNews, idx) => (
                <li key={`${item.headline}-${idx}`}>
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
            ).map((list: TokenInsightList) => (
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
