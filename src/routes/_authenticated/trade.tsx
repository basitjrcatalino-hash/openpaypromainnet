import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AlertTriangle, ExternalLink, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";

import { TradingViewEmbed } from "@/components/trade/TradingViewEmbed";
import { TradeModeTabs } from "@/components/trade/TradeModeTabs";
import { TradePairHeader } from "@/components/trade/TradePairHeader";
import { OrderBook } from "@/components/trade/OrderBook";
import { RecentTrades } from "@/components/trade/RecentTrades";
import { TradePairSearch } from "@/components/trade/TradePairSearch";
import { ExchangeOrderForm } from "@/components/trade/ExchangeOrderForm";
import { TradeBottomDock, type DockTab } from "@/components/trade/TradeBottomDock";
import {
  TradeTokenAnalysis,
  TradeTokenInfo,
  TradeTokenNews,
} from "@/components/trade/TradeTokenInfo";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TxConfirmModal } from "@/components/wallet/TxConfirmModal";
import { getAccountBalances } from "@/lib/account-transfer.functions";
import {
  closePerpPosition,
  listPerpPositions,
  openPerpPosition,
} from "@/lib/perp.functions";
import { getPerpLiveQuotes } from "@/lib/perp-market.functions";
import { getExchangeDepth, getRecentTrades } from "@/lib/exchange-depth.functions";
import {
  cancelSpotOrder,
  executeSpotMarketTrade,
  fillSpotLimitOrder,
  listSpotOrders,
  listSpotTradeHistory,
  placeSpotLimitOrder,
  processSpotOrders,
} from "@/lib/spot-orders.functions";
import { limitIsMarketable, type SpotOrder } from "@/lib/spot-orders";
import {
  isPerpMarket,
  marketToMajorId,
  unrealizedPnl,
  type PerpMarginAsset,
  type PerpMarket,
  type PerpPosition,
  type PerpSide,
} from "@/lib/perp";
import {
  PERP_CHART_PERIODS,
  fetchMajorMarkets,
  getMajorToken,
  majorMarketById,
  type PerpChartPeriod,
} from "@/lib/major-tokens";
import {
  PERP_TV,
  periodToTvInterval,
  quoteByMarket,
} from "@/lib/tradingview-perps";
import { cmcInfoForMarket } from "@/lib/coinmarketcap-trade";
import {
  pairLabel,
  tvSymbolForMode,
  type TradeMode,
} from "@/lib/exchange-depth";
import { applyPerpNotionalFee, PERP_TAKER_FEE_BPS, SPOT_TAKER_FEE_BPS } from "@/lib/platform-treasury";
import { formatNumber } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  market: z.string().optional(),
  mode: z.enum(["spot", "futures"]).optional(),
});

export const Route = createFileRoute("/_authenticated/trade")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Trade — OpenPay Pro" },
      {
        name: "description",
        content: "Spot and perpetual futures trading for BTC, ETH, SOL, and PI.",
      },
    ],
  }),
  component: TradePage,
});

type ViewTab = "chart" | "trade" | "info";
type InfoTab = "overview" | "news" | "alerts";
type SpotPay = "USDT" | "OUSD" | "USDC";

function TradePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();

  const fetchBalances = useServerFn(getAccountBalances);
  const listPos = useServerFn(listPerpPositions);
  const openPos = useServerFn(openPerpPosition);
  const closePos = useServerFn(closePerpPosition);
  const fetchQuotes = useServerFn(getPerpLiveQuotes);
  const fetchDepth = useServerFn(getExchangeDepth);
  const fetchTrades = useServerFn(getRecentTrades);
  const spotMarket = useServerFn(executeSpotMarketTrade);
  const placeLimit = useServerFn(placeSpotLimitOrder);
  const fillLimit = useServerFn(fillSpotLimitOrder);
  const cancelLimit = useServerFn(cancelSpotOrder);
  const listOrders = useServerFn(listSpotOrders);
  const processOrders = useServerFn(processSpotOrders);
  const listTradeHist = useServerFn(listSpotTradeHistory);

  const initialMarket: PerpMarket =
    search.market && isPerpMarket(search.market)
      ? (search.market.toUpperCase() as PerpMarket)
      : "BTC";
  const initialMode: TradeMode = search.mode === "spot" ? "spot" : "futures";

  const [mode, setMode] = useState<TradeMode>(initialMode);
  const [market, setMarket] = useState<PerpMarket>(initialMarket);
  /** Futures opens on Chart (OKX-style); Spot on Trade. */
  const [view, setView] = useState<ViewTab>(initialMode === "futures" ? "chart" : "trade");
  const [infoTab, setInfoTab] = useState<InfoTab>("overview");
  const [period, setPeriod] = useState<PerpChartPeriod>("LIVE");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dockTab, setDockTab] = useState<DockTab>("orders");
  const [dockExpanded, setDockExpanded] = useState(false);
  const [bookPane, setBookPane] = useState<"book" | "trades">("book");
  const chartHostRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(320);

  // Shared order form state
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [pct, setPct] = useState(0);

  // Futures
  const [futAction, setFutAction] = useState<"open" | "close">("open");
  const [leverage, setLeverage] = useState(5);
  const [marginAsset, setMarginAsset] = useState<PerpMarginAsset>("USDT");

  // Spot
  const [spotSide, setSpotSide] = useState<"buy" | "sell">("buy");
  const [payAsset, setPayAsset] = useState<SpotPay>("USDT");
  /** Confirm close position (Phantom-style TxConfirmModal). */
  const [closeTarget, setCloseTarget] = useState<PerpPosition | null>(null);

  useEffect(() => {
    const marketMatch =
      (search.market ?? "BTC").toUpperCase() === market &&
      (search.mode ?? "futures") === mode;
    if (marketMatch) return;
    void navigate({
      search: (prev: Record<string, unknown>) => ({ ...prev, market, mode }),
      replace: true,
    });
  }, [market, mode, navigate, search.market, search.mode]);

  useEffect(() => {
    return () => {
      setPickerOpen(false);
      try {
        document.body.style.pointerEvents = "";
        document.body.style.overflow = "";
        document.body.removeAttribute("data-scroll-locked");
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    if (view !== "chart") return;
    const el = chartHostRef.current;
    if (!el) return;
    const measure = () => setChartHeight(Math.max(220, Math.floor(el.clientHeight)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, dockExpanded]);

  const quotesQ = useQuery({
    queryKey: ["perp-live-quotes"],
    staleTime: 8_000,
    refetchInterval: 12_000,
    queryFn: () => fetchQuotes(),
    retry: 2,
  });

  const majorsQ = useQuery({
    queryKey: ["major-markets"],
    staleTime: 30_000,
    refetchInterval: 45_000,
    queryFn: () => fetchMajorMarkets(),
  });

  const balQ = useQuery({
    queryKey: ["account-balances"],
    queryFn: () => fetchBalances(),
    refetchInterval: 20_000,
  });

  const posQ = useQuery({
    queryKey: ["perp-positions"],
    queryFn: (): Promise<PerpPosition[]> => listPos(),
    refetchInterval: 15_000,
  });

  const majorId = marketToMajorId(market);
  const quote = quoteByMarket(quotesQ.data, market);
  const majorSnap = majorMarketById(majorsQ.data, majorId);
  const price = Number(
    quote?.markPrice && quote.markPrice > 0
      ? quote.markPrice
      : quote?.price && quote.price > 0
        ? quote.price
        : majorSnap.price > 0
          ? majorSnap.price
          : 0,
  );
  const change = Number(
    quote != null && Number.isFinite(quote.change24h)
      ? quote.change24h
      : (majorSnap.change24h ?? 0),
  );
  const changeAbs = Number(
    quote?.changeAbs != null && Number.isFinite(quote.changeAbs)
      ? quote.changeAbs
      : price > 0
        ? price * (change / 100)
        : 0,
  );

  const depthQ = useQuery({
    queryKey: ["exchange-depth", market, mode, Math.round(price)],
    staleTime: 4_000,
    refetchInterval: 6_000,
    queryFn: () =>
      fetchDepth({
        data: { market, mode, mark: price > 0 ? price : undefined },
      }),
  });

  const recentQ = useQuery({
    queryKey: ["recent-trades", market, mode],
    staleTime: 4_000,
    refetchInterval: 8_000,
    queryFn: () => fetchTrades({ data: { market, mode } }),
  });

  const openOrdersQ = useQuery({
    queryKey: ["spot-orders-open", market],
    staleTime: 5_000,
    refetchInterval: 10_000,
    enabled: mode === "spot",
    queryFn: (): Promise<SpotOrder[]> => listOrders({ data: { market, status: "open" } }),
  });

  const orderHistQ = useQuery({
    queryKey: ["spot-orders-history", market],
    staleTime: 15_000,
    enabled: mode === "spot" && dockExpanded && dockTab === "orderHistory",
    queryFn: (): Promise<SpotOrder[]> => listOrders({ data: { market, status: "history" } }),
  });

  const tradeHistQ = useQuery({
    queryKey: ["spot-trade-history", market],
    staleTime: 15_000,
    enabled: dockExpanded && dockTab === "tradeHistory",
    queryFn: () => listTradeHist({ data: { market } }),
  });

  // Poll resting limits for fill
  useEffect(() => {
    if (mode !== "spot") return;
    const tick = () => {
      void processOrders({ data: { market } })
        .then((r) => {
          if (r.filled > 0) {
            void qc.invalidateQueries({ queryKey: ["spot-orders-open"] });
            void qc.invalidateQueries({ queryKey: ["spot-orders-history"] });
            void qc.invalidateQueries({ queryKey: ["account-balances"] });
            void qc.invalidateQueries({ queryKey: ["spot-trade-history"] });
          }
        })
        .catch(() => {
          /* migration may be pending — ignore */
        });
    };
    tick();
    const id = window.setInterval(tick, 12_000);
    return () => window.clearInterval(id);
  }, [mode, market, processOrders, qc]);

  const tvSymbol = tvSymbolForMode(market, mode);
  const tvInterval = periodToTvInterval(period);
  const walletId = balQ.data?.walletId ?? null;

  const tradingBal = Number(balQ.data?.balances?.trading?.[marginAsset] ?? 0) || 0;
  const spotQuote = Number(balQ.data?.balances?.spot?.[payAsset] ?? 0) || 0;
  const spotBase = Number(balQ.data?.balances?.spot?.[market] ?? 0) || 0;
  const fundingQuote = Number(balQ.data?.balances?.funding?.[payAsset] ?? 0) || 0;
  const fundingBase = Number(balQ.data?.balances?.funding?.[market] ?? 0) || 0;

  // Prefer a pay asset that already has Spot balance
  useEffect(() => {
    if (mode !== "spot" || !balQ.data?.balances?.spot) return;
    const spot = balQ.data.balances.spot;
    const current = Number(spot[payAsset] ?? 0) || 0;
    if (current > 0) return;
    const preferred = (["USDT", "OUSD", "USDC"] as const).find(
      (a) => (Number(spot[a] ?? 0) || 0) > 0,
    );
    if (preferred && preferred !== payAsset) setPayAsset(preferred);
  }, [mode, balQ.data?.balances?.spot, payAsset]);

  const positions: PerpPosition[] = Array.isArray(posQ.data) ? posQ.data : [];
  const openPositions = positions.filter((p: PerpPosition) => p.status === "open");
  const marketPositions = openPositions.filter((p: PerpPosition) => p.market === market);
  const hasLong = marketPositions.some((p: PerpPosition) => p.side === "long");
  const hasShort = marketPositions.some((p: PerpPosition) => p.side === "short");

  function applyPct(p: number) {
    setPct(p);
    if (mode === "futures") {
      // Reserve platform fee on notional so 100% doesn't overdraw Trading
      const feeRate = PERP_TAKER_FEE_BPS / 10_000;
      const maxMargin = tradingBal / (1 + leverage * feeRate);
      const m = (maxMargin * p) / 100;
      setAmount(m > 0 ? String(Math.floor(m * 1e4) / 1e4) : "");
      return;
    }
    if (spotSide === "buy") {
      const maxBase = price > 0 ? spotQuote / price : 0;
      const m = (maxBase * p) / 100;
      setAmount(m > 0 ? String(Math.floor(m * 1e6) / 1e6) : "");
    } else {
      const m = (spotBase * p) / 100;
      setAmount(m > 0 ? String(Math.floor(m * 1e6) / 1e6) : "");
    }
  }

  const openM = useMutation({
    mutationFn: (side: PerpSide) =>
      openPos({
        data: {
          market,
          side,
          leverage,
          margin_asset: marginAsset,
          margin: Number(amount),
        },
      }),
    onSuccess: () => {
      notifySuccess("Position opened from Trading", { sound: "send" });
      setAmount("");
      setPct(0);
      void qc.invalidateQueries({ queryKey: ["perp-positions"] });
      void qc.invalidateQueries({ queryKey: ["account-balances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeM = useMutation({
    mutationFn: (id: string) => closePos({ data: { id } }),
    onSuccess: () => {
      notifySuccess("Position closed — PnL to Trading", { sound: "receive" });
      setCloseTarget(null);
      void qc.invalidateQueries({ queryKey: ["perp-positions"] });
      void qc.invalidateQueries({ queryKey: ["account-balances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const spotM = useMutation({
    mutationFn: async () => {
      if (!walletId) throw new Error("No wallet");
      const qty = Number(amount);
      if (!(qty > 0)) throw new Error("Enter an amount");
      const px =
        orderType === "limit" && Number(limitPrice) > 0 ? Number(limitPrice) : price;
      if (!(px > 0)) throw new Error("No market price");

      if (orderType === "limit") {
        const order = await placeLimit({
          data: {
            market,
            side: spotSide,
            price: px,
            amount: qty,
            pay_asset: payAsset,
          },
        });
        // Try immediate fill when mark is already through the limit
        if (limitIsMarketable(spotSide, px, price)) {
          try {
            const filled = await fillLimit({ data: { id: order.id } });
            return { kind: "limit" as const, order: filled };
          } catch {
            return { kind: "limit" as const, order };
          }
        }
        return { kind: "limit" as const, order };
      }

      const res = await spotMarket({
        data: {
          wallet_id: walletId,
          market,
          side: spotSide,
          amount: qty,
          price: px,
          pay_asset: payAsset,
        },
      });
      return { kind: "market" as const, res };
    },
    onSuccess: (result) => {
      if (result.kind === "limit") {
        if (result.order.status === "filled") {
          notifySuccess("Limit filled", { sound: "receive" });
        } else {
          notifySuccess("Limit order placed", { sound: "send" });
          setDockTab("orders");
          setDockExpanded(true);
        }
      } else {
        notifySuccess(spotSide === "buy" ? "Spot buy filled" : "Spot sell filled", {
          sound: spotSide === "buy" ? "receive" : "send",
        });
      }
      setAmount("");
      setPct(0);
      void qc.invalidateQueries({ queryKey: ["account-balances"] });
      void qc.invalidateQueries({ queryKey: ["major-markets"] });
      void qc.invalidateQueries({ queryKey: ["spot-orders-open"] });
      void qc.invalidateQueries({ queryKey: ["spot-orders-history"] });
      void qc.invalidateQueries({ queryKey: ["spot-trade-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelM = useMutation({
    mutationFn: (id: string) => cancelLimit({ data: { id } }),
    onSuccess: () => {
      notifySuccess("Order cancelled");
      void qc.invalidateQueries({ queryKey: ["spot-orders-open"] });
      void qc.invalidateQueries({ queryKey: ["spot-orders-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function requestClosePosition(id: string) {
    const pos =
      marketPositions.find((p: PerpPosition) => p.id === id) ??
      openPositions.find((p: PerpPosition) => p.id === id) ??
      null;
    if (!pos) {
      toast.error("Position not found");
      return;
    }
    setCloseTarget(pos);
  }

  function onFuturesSubmit(side: PerpSide) {
    if (futAction === "close") {
      const pos = marketPositions.find((p: PerpPosition) => p.side === side);
      if (!pos) {
        toast.error(`No open ${side} to close`);
        return;
      }
      setCloseTarget(pos);
      return;
    }
    openM.mutate(side);
  }

  const closePreview = (() => {
    if (!closeTarget) return null;
    const mark = price > 0 ? price : closeTarget.entry_price;
    const pnl = unrealizedPnl({
      side: closeTarget.side,
      sizeUsd: closeTarget.size_usd,
      entryPrice: closeTarget.entry_price,
      markPrice: mark,
      margin: closeTarget.margin,
    });
    const feeInfo = applyPerpNotionalFee(closeTarget.margin, closeTarget.leverage);
    const gross = Math.max(0, closeTarget.margin + pnl);
    const fee = Math.min(feeInfo.fee, gross);
    const receive = Math.max(0, gross - fee);
    const major = getMajorToken(closeTarget.market.toLowerCase());
    return { mark, pnl, fee, receive, logoUrl: major?.logoUrl };
  })();

  const formBusy = openM.isPending || closeM.isPending || spotM.isPending;

  const mid = depthQ.data?.mid && depthQ.data.mid > 0 ? depthQ.data.mid : price;

  return (
    <div className="ot-phantom flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-border/40 px-2 pt-[max(0.35rem,env(safe-area-inset-top))]">
        <Link
          to="/dashboard"
          aria-label="Close trade"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground press hover:bg-muted/50 hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </Link>
        <TradeModeTabs
          className="min-w-0 flex-1 border-0"
          mode={mode}
          onChange={(m) => {
            setMode(m);
            setAmount("");
            setPct(0);
            setView(m === "futures" ? "chart" : "trade");
            setDockExpanded(false);
          }}
        />
        <Link
          to="/asset/$tokenId/chat"
          params={{ tokenId: market.toLowerCase() }}
          aria-label="Live chat"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground press hover:bg-muted/50 hover:text-[#ffad0a]"
        >
          <MessageCircle className="h-4 w-4" />
        </Link>
      </header>

      <TradePairHeader
        compact
        market={market}
        mode={mode}
        price={price}
        change24h={change}
        changeAbs={changeAbs}
        onOpenPicker={() => setPickerOpen(true)}
        high24h={quote?.high24h}
        low24h={quote?.low24h}
        volume24h={quote?.volume24h ?? majorSnap.volume24h}
        markPrice={quote?.markPrice ?? price}
        indexPrice={quote?.indexPrice}
        fundingRate={mode === "futures" ? quote?.fundingRate : undefined}
        source={quote?.source}
      />

      <div className="flex shrink-0 gap-4 overflow-x-auto border-b border-border/40 px-3 scrollbar-none">
        {(
          [
            ["chart", "Chart"],
            ["trade", "Trade"],
            ["info", "Info"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setView(id);
              if (id === "trade") setDockExpanded(false);
            }}
            className={cn(
              "relative shrink-0 pb-2 pt-1 text-[13px] font-semibold press",
              view === id ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
            {view === id ? (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {view === "chart" ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/30 px-2 py-1 scrollbar-none">
              {PERP_CHART_PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "shrink-0 px-2.5 py-1 text-[11px] font-semibold press",
                    period === p
                      ? "rounded bg-muted/70 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p === "LIVE" ? "1m" : p}
                </button>
              ))}
            </div>
            <div ref={chartHostRef} className="min-h-0 flex-1">
              <TradingViewEmbed
                key={`${tvSymbol}-${tvInterval}`}
                kind="advanced-chart"
                symbol={tvSymbol}
                interval={tvInterval}
                height={chartHeight}
                className="rounded-none"
              />
            </div>
          </div>
        ) : null}

        {view === "trade" ? (
          <div className="grid h-full min-h-0 grid-cols-[1.08fr_0.92fr] gap-2 overflow-y-auto overscroll-contain px-2 py-2">
            <div className="min-w-0 pb-2">
              {mode === "futures" ? (
                <ExchangeOrderForm
                  mode="futures"
                  market={market}
                  markPrice={price}
                  orderType={orderType}
                  onOrderType={setOrderType}
                  limitPrice={limitPrice}
                  onLimitPrice={setLimitPrice}
                  amount={amount}
                  onAmount={setAmount}
                  pct={pct}
                  onPct={applyPct}
                  busy={formBusy}
                  action={futAction}
                  onAction={setFutAction}
                  leverage={leverage}
                  onLeverage={setLeverage}
                  marginAsset={marginAsset}
                  onMarginAsset={setMarginAsset}
                  available={tradingBal}
                  hasLong={hasLong}
                  hasShort={hasShort}
                  onSubmitLong={() => onFuturesSubmit("long")}
                  onSubmitShort={() => onFuturesSubmit("short")}
                />
              ) : (
                <ExchangeOrderForm
                  mode="spot"
                  market={market}
                  markPrice={price}
                  orderType={orderType}
                  onOrderType={setOrderType}
                  limitPrice={limitPrice}
                  onLimitPrice={setLimitPrice}
                  amount={amount}
                  onAmount={setAmount}
                  pct={pct}
                  onPct={applyPct}
                  busy={formBusy}
                  side={spotSide}
                  onSide={(s) => {
                    setSpotSide(s);
                    setAmount("");
                    setPct(0);
                  }}
                  payAsset={payAsset}
                  onPayAsset={setPayAsset}
                  availableQuote={spotQuote}
                  availableBase={spotBase}
                  fundingQuote={fundingQuote}
                  fundingBase={fundingBase}
                  onSubmit={() => spotM.mutate()}
                />
              )}
            </div>
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border/40 bg-card/30">
              <div className="flex shrink-0 gap-3 border-b border-border/40 px-2 py-1.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setBookPane("book")}
                  className={cn(
                    "press",
                    bookPane === "book" ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  Order book
                </button>
                <button
                  type="button"
                  onClick={() => setBookPane("trades")}
                  className={cn(
                    "press",
                    bookPane === "trades" ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  Recent
                </button>
              </div>
              <div className="min-h-64 flex-1 overflow-hidden p-1.5">
                {bookPane === "book" ? (
                  <OrderBook
                    book={depthQ.data}
                    baseSymbol={market}
                    midOverride={mid}
                    loading={depthQ.isLoading}
                    change24h={change}
                  />
                ) : (
                  <RecentTrades trades={recentQ.data} loading={recentQ.isLoading} />
                )}
              </div>
            </div>
          </div>
        ) : null}

        {view === "info" ? (
          <div className="h-full space-y-3 overflow-y-auto overscroll-contain px-3 py-3 pb-6">
            <div className="flex gap-4 border-b border-border/40">
              {(
                [
                  ["overview", "Overview"],
                  ["news", "News"],
                  ["alerts", "Analysis"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInfoTab(id)}
                  className={cn(
                    "relative pb-2 text-[12px] font-semibold press",
                    infoTab === id ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                  {infoTab === id ? (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#ffad0a]" />
                  ) : null}
                </button>
              ))}
            </div>
            {infoTab === "overview" ? (
              <div className="space-y-3">
                <TradeTokenInfo
                  market={market}
                  mode={mode}
                  price={price}
                  change24h={change}
                  mark={majorSnap}
                />
                {mode === "futures" ? (
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/50 bg-card/40 p-3 text-[11px]">
                    <div>
                      <p className="text-muted-foreground">Contract</p>
                      <p className="mt-0.5 font-semibold">{pairLabel(market, mode)} Perp</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Quote</p>
                      <p className="mt-0.5 font-semibold">USDT</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Mark</p>
                      <p className="mt-0.5 font-semibold tabular-nums">
                        {price > 0 ? formatNumber(price, price >= 1000 ? 1 : 2) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Funding</p>
                      <p className="mt-0.5 font-semibold tabular-nums">
                        {quote?.fundingRate != null
                          ? `${quote.fundingRate >= 0 ? "+" : ""}${formatNumber(quote.fundingRate, 4)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Spot {pairLabel(market, "spot")} uses Spot account balances. Transfer Funding →
                    Spot, then Buy/Sell at live mark.
                  </p>
                )}
                {mode === "futures" ? (
                  <div className="flex gap-2 rounded-lg border border-[#ffad0a]/25 bg-[#ffad0a]/8 px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ffad0a]" />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-foreground">Trade is risky.</span>{" "}
                      Perpetuals can liquidate your margin. Charts and depth are informational —
                      not advice.
                    </p>
                  </div>
                ) : null}
                <Link
                  to="/asset/$tokenId/chat"
                  params={{ tokenId: market.toLowerCase() }}
                  className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2.5 press"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <MessageCircle className="h-4 w-4 text-[#ffad0a]" />
                    Live Chat · {market}
                  </span>
                  <span className="text-[11px] font-semibold text-[#0ecb81]">Online</span>
                </Link>
              </div>
            ) : null}
            {infoTab === "news" ? (
              <TradeTokenNews
                market={market}
                mode={mode}
                price={price}
                change24h={change}
                mark={majorSnap}
              />
            ) : null}
            {infoTab === "alerts" ? (
              <div className="space-y-3">
                <TradeTokenAnalysis
                  market={market}
                  mode={mode}
                  price={price}
                  change24h={change}
                  mark={majorSnap}
                />
                <TradingViewEmbed kind="technical-analysis" symbol={tvSymbol} height={400} />
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={cmcInfoForMarket(market).url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#3861FB]"
              >
                Open on CoinMarketCap <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={PERP_TV[market].tvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
              >
                TradingView <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="pb-2 text-center text-[10px] text-muted-foreground">
              Token info via CoinMarketCap · Charts by TradingView
              {depthQ.data?.source ? ` · Depth ${depthQ.data.source}` : null}
            </p>
          </div>
        ) : null}
      </div>

      <TradeBottomDock
        mode={mode}
        market={market}
        tab={dockTab}
        onTab={setDockTab}
        positions={mode === "futures" ? marketPositions : []}
        markPrice={price}
        onClosePosition={requestClosePosition}
        closingId={closeM.isPending ? closeM.variables : null}
        onGoTrade={view !== "trade" ? () => setView("trade") : undefined}
        expanded={dockExpanded}
        onExpanded={setDockExpanded}
        openOrders={openOrdersQ.data ?? []}
        orderHistory={orderHistQ.data ?? []}
        tradeHistory={tradeHistQ.data ?? []}
        assets={[
          { symbol: "USDT (Spot)", amount: Number(balQ.data?.balances?.spot?.USDT ?? 0) },
          { symbol: "OUSD (Spot)", amount: Number(balQ.data?.balances?.spot?.OUSD ?? 0) },
          { symbol: "USDC (Spot)", amount: Number(balQ.data?.balances?.spot?.USDC ?? 0) },
          { symbol: `${market} (Spot)`, amount: spotBase },
          {
            symbol: `${marginAsset} (Futures)`,
            amount: tradingBal,
          },
        ].filter((a) => a.amount > 0 || a.symbol.includes("OUSD") || a.symbol.includes("USDT"))}
        onCancelOrder={(id) => cancelM.mutate(id)}
        cancellingId={cancelM.isPending ? cancelM.variables : null}
      />

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Select market</SheetTitle>
          </SheetHeader>
          <div className="mt-3 pb-4">
            <TradePairSearch
              mode={mode}
              market={market}
              quotes={quotesQ.data}
              majors={majorsQ.data}
              onSelect={(m) => {
                setMarket(m);
                setPickerOpen(false);
                setAmount("");
                setPct(0);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <TxConfirmModal
        open={Boolean(closeTarget)}
        onOpenChange={(open) => {
          if (!open && !closeM.isPending) setCloseTarget(null);
        }}
        title="Confirm close"
        description={
          closeTarget
            ? `${closeTarget.market}USDT · ${closeTarget.side.toUpperCase()} ${closeTarget.leverage}×`
            : undefined
        }
        icon={
          closePreview?.logoUrl ? (
            <img
              src={closePreview.logoUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover ring-4 ring-card"
            />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-full bg-muted text-lg font-bold ring-4 ring-card">
              {closeTarget?.market?.slice(0, 1) ?? "?"}
            </div>
          )
        }
        amount={
          closePreview ? (
            <span className={closePreview.pnl >= 0 ? "text-emerald-500" : "text-rose-500"}>
              {closePreview.pnl >= 0 ? "+" : ""}
              {formatNumber(closePreview.pnl, 4)} {closeTarget?.margin_asset}
            </span>
          ) : undefined
        }
        subtitle={closePreview ? "Est. unrealized PnL at mark" : undefined}
        rows={
          closeTarget && closePreview
            ? [
                { label: "Side", value: closeTarget.side.toUpperCase() },
                { label: "Leverage", value: `${closeTarget.leverage}×` },
                {
                  label: "Entry",
                  value: formatNumber(closeTarget.entry_price, closeTarget.entry_price >= 1000 ? 1 : 2),
                  mono: true,
                },
                {
                  label: "Mark",
                  value: formatNumber(closePreview.mark, closePreview.mark >= 1000 ? 1 : 2),
                  mono: true,
                },
                {
                  label: "Margin",
                  value: `${formatNumber(closeTarget.margin, 4)} ${closeTarget.margin_asset}`,
                  mono: true,
                },
                {
                  label: `Fee (${PERP_TAKER_FEE_BPS / 100}% taker)`,
                  value: `${formatNumber(closePreview.fee, 4)} ${closeTarget.margin_asset}`,
                  mono: true,
                },
                {
                  label: "You receive ≈",
                  value: `${formatNumber(closePreview.receive, 4)} ${closeTarget.margin_asset}`,
                  mono: true,
                },
              ]
            : []
        }
        notice={
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Closing returns margin ± PnL to Trading after the platform fee. Mark may move before
            confirm.
          </p>
        }
        confirmLabel={closeM.isPending ? "Closing…" : "Confirm close"}
        busy={closeM.isPending}
        variant={closePreview && closePreview.pnl < 0 ? "destructive" : "success"}
        onConfirm={() => {
          if (!closeTarget) return;
          closeM.mutate(closeTarget.id);
        }}
      />
    </div>
  );
}
