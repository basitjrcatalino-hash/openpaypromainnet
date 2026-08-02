import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Sparkles,
  X,
  ChevronDown,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";

import { TradingViewEmbed } from "@/components/trade/TradingViewEmbed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getAccountBalances } from "@/lib/account-transfer.functions";
import {
  closePerpPosition,
  listPerpPositions,
  openPerpPosition,
} from "@/lib/perp.functions";
import { getPerpLiveQuotes } from "@/lib/perp-market.functions";
import {
  PERP_LEVERAGE_OPTIONS,
  PERP_MARGIN_ASSETS,
  PERP_MARKETS,
  isPerpMarket,
  marketToMajorId,
  unrealizedPnl,
  type PerpMarginAsset,
  type PerpMarket,
  type PerpSide,
} from "@/lib/perp";
import { MAJOR_TOKENS, PERP_CHART_PERIODS, type PerpChartPeriod } from "@/lib/major-tokens";
import {
  PERP_TV,
  periodToTvInterval,
  quoteByMarket,
} from "@/lib/tradingview-perps";
import { formatNumber } from "@/lib/wallet-utils";
import { useChromeForceHidden, useChromeVisible } from "@/hooks/chrome-visible";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  market: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/trade")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Trade — OpenPay Pro" },
      {
        name: "description",
        content:
          "Trade BTC, ETH, SOL, and PI perpetuals with live TradingView charts, news, and exchange mark prices.",
      },
    ],
  }),
  component: TradePage,
});

function TradePage() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const chromeVisible = useChromeVisible();
  const setChromeForceHidden = useChromeForceHidden();
  const fetchBalances = useServerFn(getAccountBalances);
  const listPos = useServerFn(listPerpPositions);
  const openPos = useServerFn(openPerpPosition);
  const closePos = useServerFn(closePerpPosition);
  const fetchQuotes = useServerFn(getPerpLiveQuotes);

  const initialMarket: PerpMarket =
    search.market && isPerpMarket(search.market)
      ? (search.market.toUpperCase() as PerpMarket)
      : "BTC";

  const [market, setMarket] = useState<PerpMarket>(initialMarket);
  const [period, setPeriod] = useState<PerpChartPeriod>("LIVE");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetSide, setSheetSide] = useState<PerpSide | null>(null);
  const [leverage, setLeverage] = useState(5);
  const [marginAsset, setMarginAsset] = useState<PerpMarginAsset>("USDT");
  const [margin, setMargin] = useState("");
  const [barMounted, setBarMounted] = useState(false);
  const [tab, setTab] = useState<"chart" | "news" | "alerts">("chart");

  useEffect(() => setBarMounted(true), []);

  useEffect(() => {
    setChromeForceHidden(menuOpen);
    return () => setChromeForceHidden(false);
  }, [menuOpen, setChromeForceHidden]);

  const quotesQ = useQuery({
    queryKey: ["perp-live-quotes"],
    staleTime: 8_000,
    refetchInterval: 12_000,
    queryFn: () => fetchQuotes(),
  });

  const balQ = useQuery({
    queryKey: ["account-balances"],
    queryFn: () => fetchBalances(),
    refetchInterval: 30_000,
  });

  const posQ = useQuery({
    queryKey: ["perp-positions"],
    queryFn: () => listPos(),
    refetchInterval: 20_000,
  });

  const majorId = marketToMajorId(market);
  const def = MAJOR_TOKENS[majorId];
  const tv = PERP_TV[market];
  const quote = quoteByMarket(quotesQ.data, market);
  const price = Number(quote?.markPrice ?? quote?.price ?? 0);
  const change = Number(quote?.change24h ?? 0);
  const changeAbs = Number(quote?.changeAbs ?? 0);
  const up = change >= 0;
  const tvInterval = periodToTvInterval(period);

  const tradingBal = Number(balQ.data?.balances?.trading?.[marginAsset] ?? 0) || 0;
  const openPositions = (posQ.data ?? []).filter((p) => p.status === "open");
  const marketPositions = openPositions.filter((p) => p.market === market);

  const openM = useMutation({
    mutationFn: () =>
      openPos({
        data: {
          market,
          side: sheetSide === "short" ? "short" : "long",
          leverage: sheetSide === null ? 1 : leverage,
          margin_asset: marginAsset,
          margin: Number(margin),
        },
      }),
    onSuccess: () => {
      notifySuccess("Position opened from Trading", { sound: "send" });
      setSheetSide(null);
      setMargin("");
      setMenuOpen(false);
      void qc.invalidateQueries({ queryKey: ["perp-positions"] });
      void qc.invalidateQueries({ queryKey: ["account-balances"] });
      void qc.invalidateQueries({ queryKey: ["perp-live-quotes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeM = useMutation({
    mutationFn: (id: string) => closePos({ data: { id } }),
    onSuccess: () => {
      notifySuccess("Position closed — PnL to Trading", { sound: "receive" });
      void qc.invalidateQueries({ queryKey: ["perp-positions"] });
      void qc.invalidateQueries({ queryKey: ["account-balances"] });
      void qc.invalidateQueries({ queryKey: ["perp-live-quotes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marginNum = Number(margin);
  const marginOk = Number.isFinite(marginNum) && marginNum > 0 && marginNum <= tradingBal + 1e-12;

  function openTrade(side: PerpSide | "buy") {
    if (side === "buy") {
      setSheetSide("long");
      setLeverage(1);
    } else {
      setSheetSide(side);
      if (leverage < 2) setLeverage(5);
    }
    setMenuOpen(false);
  }

  const tradeBar =
    barMounted &&
    createPortal(
      <div
        className={cn(
          "ph-trade-bar border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl",
          "transition-[bottom] duration-300 ease-out",
        )}
        data-chrome={chromeVisible ? "visible" : "hidden"}
      >
        <div className="mx-auto flex max-w-lg items-end justify-between gap-3">
          <div className="min-w-0 pb-1">
            <p className="text-[11px] text-muted-foreground">Mark · {quote?.source ?? "…"}</p>
            <p className="text-sm font-bold tabular-nums">
              {price > 0
                ? `$${formatNumber(price, price >= 1000 ? 0 : price >= 1 ? 2 : 4)}`
                : "—"}
            </p>
          </div>
          {!menuOpen ? (
            <Button
              type="button"
              className="h-12 min-w-[7.5rem] rounded-2xl bg-[#c4b5fd] px-6 text-base font-bold text-black hover:bg-[#b8a6fc]"
              onClick={() => setMenuOpen(true)}
            >
              Trade
            </Button>
          ) : (
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                className="h-11 min-w-[7.5rem] rounded-2xl bg-[#c4b5fd] px-5 text-sm font-bold text-black press"
                onClick={() => openTrade("long")}
              >
                Long
              </button>
              <button
                type="button"
                className="h-11 min-w-[7.5rem] rounded-2xl bg-[#c4b5fd] px-5 text-sm font-bold text-black press"
                onClick={() => openTrade("short")}
              >
                Short
              </button>
              <button
                type="button"
                className="h-11 min-w-[7.5rem] rounded-2xl bg-[#c4b5fd] px-5 text-sm font-bold text-black press"
                onClick={() => openTrade("buy")}
              >
                Buy
              </button>
              <button
                type="button"
                aria-label="Close menu"
                className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground press"
                onClick={() => setMenuOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="ot-phantom mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-background pb-36">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2 text-left press"
        >
          <img src={def.logoUrl} alt="" className="h-8 w-8 rounded-full" />
          <div>
            <div className="inline-flex items-center gap-1 text-base font-bold">
              {def.name}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
            {quotesQ.isLoading && !quote ? (
              <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <>
                <p className="text-3xl font-bold tracking-tight tabular-nums">
                  $
                  {formatNumber(price, price >= 1000 ? 0 : price >= 1 ? 2 : 4)}
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    up ? "text-emerald-500" : "text-red-500",
                  )}
                >
                  {up ? "+" : ""}
                  {formatNumber(changeAbs, price >= 100 ? 2 : 4)} ({up ? "+" : ""}
                  {formatNumber(change, 2)}%)
                </p>
              </>
            )}
          </div>
        </button>
        <a
          href={tv.tvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label="TradingView alerts & full chart"
          title="Open on TradingView"
        >
          <Bell className="h-5 w-5" />
        </a>
      </div>

      <p className="mt-1 px-4 text-[11px] text-muted-foreground">
        {tv.tvSymbol} · live mark from {quote?.source ?? tv.exchangeLabel}
      </p>

      {/* Chart / News / Alerts tabs */}
      <div className="mt-3 flex gap-1 px-4">
        {(
          [
            ["chart", "Chart"],
            ["news", "News"],
            ["alerts", "Alerts"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-bold press",
              tab === id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "chart" ? (
        <>
          <div className="mt-2 px-2">
            <TradingViewEmbed
              key={`${tv.tvSymbol}-${tvInterval}`}
              kind="advanced-chart"
              symbol={tv.tvSymbol}
              interval={tvInterval}
              height={300}
            />
          </div>
          <div className="mt-1 flex gap-1 overflow-x-auto px-4 pb-2 scrollbar-none">
            {PERP_CHART_PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold press",
                  period === p
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p === "LIVE" ? "· LIVE" : p}
              </button>
            ))}
          </div>
          <div className="mt-1 px-4">
            <TradingViewEmbed kind="symbol-info" symbol={tv.tvSymbol} height={120} />
          </div>
        </>
      ) : null}

      {tab === "news" ? (
        <div className="mt-2 px-2">
          <TradingViewEmbed kind="timeline" symbol={tv.tvSymbol} height={460} />
          <a
            href={tv.tvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 px-2 text-xs font-semibold text-primary"
          >
            More on TradingView <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : null}

      {tab === "alerts" ? (
        <div className="mt-2 space-y-3 px-2">
          <TradingViewEmbed kind="technical-analysis" symbol={tv.tvSymbol} height={420} />
          <p className="px-2 text-[11px] leading-relaxed text-muted-foreground">
            Technicals summarize oscillator / MA signals from TradingView. For price alerts, open{" "}
            <a
              href={tv.tvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              {tv.tvSymbol}
            </a>{" "}
            on TradingView and create an alert on the full chart.
          </p>
        </div>
      ) : null}

      {/* Live chat teaser */}
      <Link
        to="/asset/$tokenId/chat"
        params={{ tokenId: market.toLowerCase() }}
        className="mx-4 mt-3 flex items-center justify-between rounded-2xl border border-border/60 bg-card/70 px-3.5 py-3 press"
      >
        <div>
          <p className="text-sm font-bold">Live Chat ›</p>
          <p className="mt-1 text-xs text-muted-foreground">Talk {market} with the room</p>
        </div>
        <span className="text-xs font-semibold text-emerald-500">· online</span>
      </Link>

      {/* Insights + risk */}
      <div className="mx-4 mt-3 rounded-2xl border border-border/60 bg-card/50 px-3.5 py-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Recent {def.name} perpetual activity · Long / Short / Buy use the live{" "}
          <span className="font-semibold text-foreground">{quote?.source ?? "exchange"}</span> mark
          (same markets as{" "}
          <a
            href={tv.tvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary"
          >
            TradingView {market}USDT.P
          </a>
          ). Margin is funded from your{" "}
          <span className="font-semibold text-foreground">Trading</span> account (USDT / OUSD /
          USDC).
        </p>
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3" /> Perps · non-stables only
        </p>
      </div>

      <div className="mx-4 mt-3 flex gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 text-[12px] leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Trade is risky</p>
          <p className="mt-1">
            Perpetual trading involves substantial risk of loss. Leverage can amplify gains and
            losses; you may lose your entire margin. Charts, news, and technicals are for
            information only — not investment advice. Past performance does not guarantee future
            results. Only trade with funds you can afford to lose.
          </p>
        </div>
      </div>

      {/* Positions */}
      <section className="mx-4 mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Open positions</h2>
          <Link
            to="/transfer"
            search={{ from: "funding", to: "trading", asset: "USDT" }}
            className="text-xs font-semibold text-primary"
          >
            Fund Trading
          </Link>
        </div>
        {!marketPositions.length ? (
          <p className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            No open {market} perps. Tap Trade → Long / Short.
          </p>
        ) : (
          marketPositions.map((p) => {
            const pnl = unrealizedPnl({
              side: p.side,
              sizeUsd: p.size_usd,
              entryPrice: p.entry_price,
              markPrice: price,
              margin: p.margin,
            });
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-border/60 bg-card/70 px-3.5 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">
                      <span
                        className={cn(
                          "mr-1.5 rounded-md px-1.5 py-0.5 text-[10px] uppercase",
                          p.side === "long"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-red-500/15 text-red-500",
                        )}
                      >
                        {p.side}
                      </span>
                      {p.market} · {p.leverage}×
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Entry ${formatNumber(p.entry_price, 2)} · Margin {formatNumber(p.margin, 2)}{" "}
                      {p.margin_asset}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        pnl >= 0 ? "text-emerald-500" : "text-red-500",
                      )}
                    >
                      {pnl >= 0 ? "+" : ""}
                      {formatNumber(pnl, 2)}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-1 h-7 rounded-full text-xs"
                      disabled={closeM.isPending}
                      onClick={() => closeM.mutate(p.id)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      <p className="mx-4 mt-4 pb-2 text-center text-[10px] text-muted-foreground">
        Charts &amp; news by{" "}
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
        >
          TradingView
        </a>
      </p>

      {tradeBar}

      {/* Market picker */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Select market</SheetTitle>
          </SheetHeader>
          <div className="mt-3 space-y-1 pb-6">
            {PERP_MARKETS.map((m) => {
              const id = marketToMajorId(m);
              const d = MAJOR_TOKENS[id];
              const s = quoteByMarket(quotesQ.data, m);
              const px = Number(s?.markPrice ?? s?.price ?? 0);
              return (
                <button
                  key={m}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 press hover:bg-muted/50"
                  onClick={() => {
                    setMarket(m);
                    setPickerOpen(false);
                    setTab("chart");
                  }}
                >
                  <img src={d.logoUrl} alt="" className="h-9 w-9 rounded-full" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block font-bold">{d.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {PERP_TV[m].tvSymbol}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    $
                    {formatNumber(px, px >= 1000 ? 0 : px >= 1 ? 2 : 4)}
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Open sheet */}
      <Sheet open={sheetSide != null} onOpenChange={(o) => !o && setSheetSide(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>
              {sheetSide === "short" ? "Short" : leverage <= 1 ? "Buy" : "Long"} {market}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3 space-y-4 pb-8">
            <p className="text-sm text-muted-foreground">
              Entry uses live {quote?.source ?? "exchange"} mark ~$
              {formatNumber(price, price >= 1 ? 2 : 4)}. Margin from your{" "}
              <span className="font-semibold text-foreground">Trading</span> balance. Available{" "}
              {formatNumber(tradingBal, 4)} {marginAsset}.
            </p>

            <div className="flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>
                Trade is risky — leveraged perps can liquidate your margin. Confirm only if you
                accept that risk.
              </span>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                Margin asset
              </p>
              <div className="flex gap-1 rounded-2xl bg-muted/40 p-1">
                {PERP_MARGIN_ASSETS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setMarginAsset(a)}
                    className={cn(
                      "flex-1 rounded-xl py-2 text-xs font-bold",
                      marginAsset === a ? "bg-card shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {sheetSide !== null && leverage > 1 ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  Leverage
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PERP_LEVERAGE_OPTIONS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLeverage(l)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-bold",
                        leverage === l
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {l}×
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Margin</p>
              <div className="flex gap-2">
                <Input
                  value={margin}
                  onChange={(e) => setMargin(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-12 rounded-2xl text-base font-semibold"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl"
                  onClick={() => setMargin(String(Math.floor(tradingBal * 100) / 100))}
                >
                  Max
                </Button>
              </div>
              {marginNum > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Notional ≈{" "}
                  {formatNumber(marginNum * (sheetSide && leverage > 1 ? leverage : 1), 2)} USD ·
                  Entry ~ ${formatNumber(price, 2)}
                </p>
              ) : null}
            </div>

            {tradingBal <= 0 ? (
              <Button asChild variant="outline" className="h-11 w-full rounded-full">
                <Link
                  to="/transfer"
                  search={{ from: "funding", to: "trading", asset: marginAsset }}
                >
                  Transfer {marginAsset} to Trading
                </Link>
              </Button>
            ) : null}

            <Button
              type="button"
              className="h-12 w-full rounded-full text-base font-bold"
              disabled={!marginOk || openM.isPending || !sheetSide || !(price > 0)}
              onClick={() => openM.mutate()}
            >
              {openM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Confirm ${sheetSide === "short" ? "Short" : leverage <= 1 ? "Buy" : "Long"}`
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
