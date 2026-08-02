import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AlertTriangle, ExternalLink, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";

import { TradingViewEmbed } from "@/components/trade/TradingViewEmbed";
import { TradeModeTabs } from "@/components/trade/TradeModeTabs";
import { TradePairHeader } from "@/components/trade/TradePairHeader";
import { OrderBook } from "@/components/trade/OrderBook";
import { ExchangeOrderForm } from "@/components/trade/ExchangeOrderForm";
import { TradeBottomDock } from "@/components/trade/TradeBottomDock";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TokenAvatar } from "@/components/wallet/TokenAvatar";
import { getAccountBalances } from "@/lib/account-transfer.functions";
import {
  closePerpPosition,
  listPerpPositions,
  openPerpPosition,
} from "@/lib/perp.functions";
import { getPerpLiveQuotes } from "@/lib/perp-market.functions";
import { getExchangeDepth } from "@/lib/exchange-depth.functions";
import { buyMajorWithOusd } from "@/lib/buy-major.functions";
import {
  BTC_SWAP_ID,
  ETH_SWAP_ID,
  executeOpenDexSwap,
  PI_SWAP_ID,
  SOL_SWAP_ID,
  USDT_SWAP_ID,
  OUSD_SWAP_ID,
  USDC_SWAP_ID,
} from "@/lib/opendex.functions";
import {
  PERP_MARKETS,
  isPerpMarket,
  marketToMajorId,
  type PerpMarginAsset,
  type PerpMarket,
  type PerpSide,
} from "@/lib/perp";
import {
  MAJOR_TOKENS,
  PERP_CHART_PERIODS,
  fetchMajorMarkets,
  majorMarketById,
  type PerpChartPeriod,
} from "@/lib/major-tokens";
import {
  PERP_TV,
  periodToTvInterval,
  quoteByMarket,
} from "@/lib/tradingview-perps";
import {
  pairLabel,
  tvSymbolForMode,
  type TradeMode,
} from "@/lib/exchange-depth";
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

const MAJOR_SWAP: Record<PerpMarket, string> = {
  BTC: BTC_SWAP_ID,
  ETH: ETH_SWAP_ID,
  SOL: SOL_SWAP_ID,
  PI: PI_SWAP_ID,
};

const PAY_SWAP: Record<SpotPay, string> = {
  USDT: USDT_SWAP_ID,
  OUSD: OUSD_SWAP_ID,
  USDC: USDC_SWAP_ID,
};

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
  const buyMajor = useServerFn(buyMajorWithOusd);
  const dexSwap = useServerFn(executeOpenDexSwap);

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
  const [dockTab, setDockTab] = useState<"orders" | "positions">("positions");

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

  useEffect(() => {
    if (search.market === market && search.mode === mode) return;
    void navigate({
      search: (prev) => ({ ...prev, market, mode }),
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
    queryFn: () => listPos(),
    refetchInterval: 15_000,
  });

  const majorId = marketToMajorId(market);
  const def = MAJOR_TOKENS[majorId];
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
    enabled: price > 0 || true,
    queryFn: () =>
      fetchDepth({
        data: { market, mode, mark: price > 0 ? price : undefined },
      }),
  });

  const tvSymbol = tvSymbolForMode(market, mode);
  const tvInterval = periodToTvInterval(period);
  const walletId = balQ.data?.walletId ?? null;

  const tradingBal = Number(balQ.data?.balances?.trading?.[marginAsset] ?? 0) || 0;
  const fundingQuote = Number(balQ.data?.balances?.funding?.[payAsset] ?? 0) || 0;
  const fundingBase = Number(balQ.data?.balances?.funding?.[market] ?? 0) || 0;

  const openPositions = (posQ.data ?? []).filter((p) => p.status === "open");
  const marketPositions = openPositions.filter((p) => p.market === market);
  const hasLong = marketPositions.some((p) => p.side === "long");
  const hasShort = marketPositions.some((p) => p.side === "short");

  function applyPct(p: number) {
    setPct(p);
    if (mode === "futures") {
      const m = (tradingBal * p) / 100;
      setAmount(m > 0 ? String(Math.floor(m * 1e4) / 1e4) : "");
      return;
    }
    if (spotSide === "buy") {
      const maxBase = price > 0 ? fundingQuote / price : 0;
      const m = (maxBase * p) / 100;
      setAmount(m > 0 ? String(Math.floor(m * 1e6) / 1e6) : "");
    } else {
      const m = (fundingBase * p) / 100;
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

      if (spotSide === "buy") {
        const usd = Math.round(qty * px * 1e8) / 1e8;
        return buyMajor({
          data: {
            wallet_id: walletId,
            major_id: majorId,
            usd_amount: usd,
            pay_asset: payAsset,
          },
        });
      }

      return dexSwap({
        data: {
          wallet_id: walletId,
          from_id: MAJOR_SWAP[market],
          to_id: PAY_SWAP[payAsset],
          amount: qty,
          slippage: 1,
        },
      });
    },
    onSuccess: () => {
      notifySuccess(spotSide === "buy" ? "Spot buy filled" : "Spot sell filled", {
        sound: spotSide === "buy" ? "receive" : "send",
      });
      setAmount("");
      setPct(0);
      void qc.invalidateQueries({ queryKey: ["account-balances"] });
      void qc.invalidateQueries({ queryKey: ["major-markets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onFuturesSubmit(side: PerpSide) {
    if (futAction === "close") {
      const pos = marketPositions.find((p) => p.side === side);
      if (!pos) {
        toast.error(`No open ${side} to close`);
        return;
      }
      closeM.mutate(pos.id);
      return;
    }
    openM.mutate(side);
  }

  const formBusy = openM.isPending || closeM.isPending || spotM.isPending;

  const mid = depthQ.data?.mid && depthQ.data.mid > 0 ? depthQ.data.mid : price;

  return (
    <div className="ot-phantom mx-auto flex w-full max-w-lg flex-col bg-background pb-[calc(var(--ph-tabbar-content,3.75rem)+2rem)]">
      <TradeModeTabs
        mode={mode}
        onChange={(m) => {
          setMode(m);
          setAmount("");
          setPct(0);
          setView(m === "futures" ? "chart" : "trade");
        }}
      />

      <TradePairHeader
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

      <div className="mt-1 flex gap-4 overflow-x-auto border-b border-border/40 px-4 scrollbar-none">
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
            onClick={() => setView(id)}
            className={cn(
              "relative shrink-0 pb-2.5 pt-1 text-[13px] font-semibold press",
              view === id ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
            {view === id ? (
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-foreground" />
            ) : null}
          </button>
        ))}
      </div>

      {view === "chart" ? (
        <div className="mt-0">
          <div className="flex gap-1 overflow-x-auto border-b border-border/30 px-3 py-1.5 scrollbar-none">
            {PERP_CHART_PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  "shrink-0 px-2.5 py-1 text-[11px] font-semibold press",
                  period === p
                    ? "rounded text-foreground bg-muted/70"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p === "LIVE" ? "1m" : p}
              </button>
            ))}
          </div>
          <TradingViewEmbed
            key={`${tvSymbol}-${tvInterval}`}
            kind="advanced-chart"
            symbol={tvSymbol}
            interval={tvInterval}
            height={320}
            className="rounded-none"
          />
          <p className="mt-2 px-4 text-[11px] text-muted-foreground">
            News &amp; analysis live on the{" "}
            <button
              type="button"
              className="font-semibold text-foreground underline-offset-2 press hover:underline"
              onClick={() => {
                setView("info");
                setInfoTab("news");
              }}
            >
              Info
            </button>{" "}
            tab.
          </p>
        </div>
      ) : null}

      {view === "trade" ? (
        <div className="mt-3 grid grid-cols-[1.15fr_0.95fr] gap-2 px-3">
          <div className="min-w-0">
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
                availableQuote={fundingQuote}
                availableBase={fundingBase}
                onSubmit={() => spotM.mutate()}
              />
            )}
          </div>
          <div className="min-h-[22rem] min-w-0 rounded-xl border border-border/40 bg-card/40 p-2">
            <OrderBook
              book={depthQ.data}
              baseSymbol={market}
              midOverride={mid}
              loading={depthQ.isLoading}
              change24h={change}
            />
          </div>
        </div>
      ) : null}

      {view === "info" ? (
        <div className="mt-3 space-y-3 px-3">
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
                  <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#ffad0a]" />
                ) : null}
              </button>
            ))}
          </div>
          {infoTab === "overview" ? (
            <div className="space-y-3">
              <TradingViewEmbed kind="symbol-info" symbol={tvSymbol} height={200} />
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
                <div>
                  <p className="text-muted-foreground">24h high</p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {quote?.high24h ? formatNumber(quote.high24h, price >= 1000 ? 1 : 2) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">24h low</p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {quote?.low24h ? formatNumber(quote.low24h, price >= 1000 ? 1 : 2) : "—"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {infoTab === "news" ? (
            <TradingViewEmbed kind="timeline" symbol={tvSymbol} height={440} />
          ) : null}
          {infoTab === "alerts" ? (
            <TradingViewEmbed kind="technical-analysis" symbol={tvSymbol} height={420} />
          ) : null}
          <a
            href={PERP_TV[market].tvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
          >
            Open on TradingView <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : null}

      <Link
        to="/asset/$tokenId/chat"
        params={{ tokenId: market.toLowerCase() }}
        className="mx-4 mt-3 flex items-center justify-between border-y border-border/40 bg-transparent px-1 py-3 press"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[#ffad0a]" />
          <div>
            <p className="text-sm font-semibold">Live Chat</p>
            <p className="text-[11px] text-muted-foreground">{market} perpetual room</p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-[#0ecb81]">Online</span>
      </Link>

      {mode === "futures" ? (
        <div className="mx-4 mt-2 flex gap-2 rounded-lg border border-[#ffad0a]/25 bg-[#ffad0a]/8 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ffad0a]" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Trade is risky.</span> Perpetuals can
            liquidate your margin. Charts and depth are informational — not advice.
          </p>
        </div>
      ) : (
        <p className="mx-4 mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Spot {pairLabel(market, "spot")} uses Funding balances. Buy/Sell settles via OpenDEX at live mark.
        </p>
      )}

      <div className="mt-2">
        <TradeBottomDock
          mode={mode}
          tab={dockTab}
          onTab={setDockTab}
          positions={mode === "futures" ? marketPositions : []}
          markPrice={price}
          onClosePosition={(id) => closeM.mutate(id)}
          closingId={closeM.isPending ? closeM.variables : null}
          onGoTrade={view !== "trade" ? () => setView("trade") : undefined}
        />
      </div>

      <p className="mx-4 mt-2 pb-2 text-center text-[10px] text-muted-foreground">
        Charts by{" "}
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
        >
          TradingView
        </a>
        {depthQ.data?.source ? ` · Depth ${depthQ.data.source}` : null}
      </p>

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
              const snap = majorMarketById(majorsQ.data, id);
              const px = Number(
                s?.markPrice && s.markPrice > 0
                  ? s.markPrice
                  : s?.price && s.price > 0
                    ? s.price
                    : snap.price > 0
                      ? snap.price
                      : 0,
              );
              return (
                <button
                  key={m}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 press hover:bg-muted/50"
                  onClick={() => {
                    setMarket(m);
                    setPickerOpen(false);
                    setAmount("");
                    setPct(0);
                  }}
                >
                  <TokenAvatar
                    logoUrl={d.logoUrl}
                    name={d.name}
                    symbol={d.symbol}
                    verified
                  />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block font-bold">{pairLabel(m, mode)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {mode === "futures" ? PERP_TV[m].tvSymbol : tvSymbolForMode(m, "spot")}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    ${formatNumber(px, px >= 1000 ? 0 : px >= 1 ? 2 : 4)}
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
