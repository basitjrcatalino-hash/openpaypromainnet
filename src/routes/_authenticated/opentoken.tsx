/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Compass,
  CreditCard,
  Heart,
  Hourglass,
  InfinityIcon,
  Loader2,
  MessageCircle,
  Share2,
  Shield,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";

import { supabase } from "@/integrations/supabase/client";
import { ExploreDock } from "@/components/wallet/ExploreDock";
import { TokenAvatar } from "@/components/wallet/TokenAvatar";
import { TokenPriceRate } from "@/components/wallet/TokenPriceRate";
import { OusdIcon } from "@/components/ousd-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssetBuySheet } from "@/components/wallet/AssetBuySheet";
import {
  PriceChart,
  resolveChartTicks,
  type ChartTick,
} from "@/components/opentoken/PriceChart";
import { useCurrency, formatCurrency, type CurrencyCode } from "@/lib/currency";
import {
  MAJOR_TOKENS,
  MAJOR_TOKEN_IDS,
  fetchMajorMarkets,
  majorMarketById,
  type MajorTokenId,
  type MajorMarketSnapshot,
} from "@/lib/major-tokens";
import {
  LEDGER_MAJOR_SWAP_IDS,
  OUSD_SWAP_ID,
  SOL_SWAP_ID,
  majorIdFromSwapId,
  readMajorBalance,
  walletMajorSelect,
} from "@/lib/ledger-majors";
import { buyMajorWithOusd } from "@/lib/buy-major.functions";
import { applyOpenDexFee } from "@/lib/opendex-fee";
import { executeOpenDexSwap } from "@/lib/opendex.functions";
import { OUSD_LOGO_URL } from "@/lib/token-logos";
import {
  fetchActiveWallet,
  formatOUSD,
  formatPct,
  formatNumber,
} from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/opentoken")({
  head: () => ({ meta: [{ title: "Home — OpenPay Pro" }] }),
  component: OpenTokenHome,
});

type TopTab = "home" | "trade" | "predict" | "explore";

const TOP_TABS: { id: TopTab; label: string; icon?: LucideIcon }[] = [
  { id: "home", label: "Home" },
  { id: "trade", label: "Trade", icon: ArrowLeftRight },
  { id: "predict", label: "Predict", icon: Sparkles },
  { id: "explore", label: "Explore", icon: Compass },
];

type TradeFilter = "featured" | "trending" | "volume";
type ExploreFilter = "tokens" | "perps" | "people";

const PREDICT_UPCOMING = [
  {
    id: "f1-2026",
    title: "Formula 1 2026 Constructors",
    eta: "in 129d",
    accent: "#14b8a6",
  },
  {
    id: "btc-100k",
    title: "BTC above $100k by Q4",
    eta: "in 92d",
    accent: "#f7931a",
  },
  {
    id: "eth-etf",
    title: "ETH ETF weekly inflow",
    eta: "in 6d",
    accent: "#627eea",
  },
] as const;

const PREDICT_WINDOWS = [
  { id: "5m", label: "5min", seconds: 5 * 60 },
  { id: "15m", label: "15min", seconds: 15 * 60 },
  { id: "1h", label: "1h", seconds: 60 * 60 },
] as const;

function OpenTokenHome() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { code: currency } = useCurrency();
  const buyMajorFn = useServerFn(buyMajorWithOusd);
  const swapFn = useServerFn(executeOpenDexSwap);
  const [topTab, setTopTab] = useState<TopTab>("home");
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>("trending");
  const [exploreFilter, setExploreFilter] = useState<ExploreFilter>("tokens");
  const [predictAsset, setPredictAsset] = useState<MajorTokenId>("btc");
  const [predictWindow, setPredictWindow] = useState<(typeof PREDICT_WINDOWS)[number]["id"]>("15m");
  const [predictDetail, setPredictDetail] = useState(false);
  const [predictBuyOpen, setPredictBuyOpen] = useState(false);
  const [payId, setPayId] = useState(SOL_SWAP_ID);
  const [receiveId, setReceiveId] = useState(OUSD_SWAP_ID);
  const [payAmount, setPayAmount] = useState("");
  const [swapBusy, setSwapBusy] = useState(false);

  const { data: isStaff } = useQuery({
    queryKey: ["ot-is-staff", user.id],
    queryFn: async () => {
      const [{ data: a }, { data: m }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "moderator" }),
      ]);
      return !!(a || m);
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () =>
      fetchActiveWallet<Record<string, unknown>>(
        supabase,
        user.id,
        walletMajorSelect("id, name, ousd_balance"),
      ),
  });

  const { data: holdings = [] } = useQuery({
    queryKey: ["ot-home-holdings", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("token_holdings")
        .select("balance, token_id, tokens(*)")
        .eq("wallet_id", String(wallet!.id))
        .gt("balance", 0);
      if (error) throw error;
      return (data ?? []).filter((h: any) => h.tokens && !h.tokens.is_hidden);
    },
  });

  const { data: tokens = [], isLoading: tokensLoading } = useQuery({
    queryKey: ["ot-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("*")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        const { data: fallback } = await supabase
          .from("tokens")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        return fallback ?? [];
      }
      return data ?? [];
    },
  });

  const { data: majorMarkets = [] } = useQuery({
    queryKey: ["major-markets"],
    staleTime: 15_000,
    refetchInterval: topTab === "predict" ? 15_000 : 60_000,
    queryFn: fetchMajorMarkets,
  });

  const filteredTokens = useMemo(() => {
    let list = tokens as any[];
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name?.toLowerCase().includes(qq) ||
          t.symbol?.toLowerCase().includes(qq),
      );
    }
    return list;
  }, [tokens, q]);

  const trending = useMemo(() => {
    return [...filteredTokens].sort((a, b) => {
      const vol = Number(b.volume_24h ?? 0) - Number(a.volume_24h ?? 0);
      if (vol !== 0) return vol;
      return Math.abs(Number(b.change_24h ?? 0)) - Math.abs(Number(a.change_24h ?? 0));
    });
  }, [filteredTokens]);

  const byVolume = useMemo(() => {
    return [...filteredTokens].sort(
      (a, b) => Number(b.volume_24h ?? 0) - Number(a.volume_24h ?? 0),
    );
  }, [filteredTokens]);

  const byMarketCap = useMemo(() => {
    return [...filteredTokens].sort(
      (a, b) => Number(b.market_cap ?? 0) - Number(a.market_cap ?? 0),
    );
  }, [filteredTokens]);

  const tradeList =
    tradeFilter === "featured"
      ? byMarketCap.filter((t) => t.is_verified || t.status === "graduated")
      : tradeFilter === "volume"
        ? byVolume
        : trending;

  const holdingsUsd = useMemo(() => {
    return holdings.reduce((sum: number, h: any) => {
      const bal = Number(h.balance ?? 0);
      const price = Number(h.tokens?.price_usd ?? 0);
      return sum + bal * price;
    }, 0);
  }, [holdings]);

  const ousdBal = Number(wallet?.ousd_balance ?? 0);
  const totalUsd = ousdBal + holdingsUsd;
  const avgChange = useMemo(() => {
    const changes = trending.slice(0, 8).map((t) => Number(t.change_24h ?? 0));
    if (!changes.length) return 0;
    return changes.reduce((a, b) => a + b, 0) / changes.length;
  }, [trending]);

  const predictMarket = majorMarketById(majorMarkets, predictAsset);
  const predictDef = MAJOR_TOKENS[predictAsset];
  const upOdds = clampOdds(50 + Number(predictMarket.change24h ?? 0) * 2.2);
  const downOdds = 100 - upOdds;
  const predictMajorBal = readMajorBalance(wallet ?? null, predictAsset);

  async function refreshPredictBalances() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] }),
      qc.invalidateQueries({ queryKey: ["major-markets"] }),
      qc.invalidateQueries({ queryKey: ["wallets", user.id] }),
      qc.invalidateQueries({ queryKey: ["ledger-entries"] }),
    ]);
  }

  return (
    <div className="ot-phantom relative mx-auto w-full max-w-lg animate-page-in pb-28 md:max-w-2xl">
      {/* Phantom pill header */}
      <div className="ph-header sticky top-0 z-30 -mx-4 px-3 pb-3 pt-2 md:mx-0 md:rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <Link
            to="/dashboard"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground press"
            aria-label="Wallet"
          >
            <CreditCard className="h-4 w-4" />
          </Link>

          {TOP_TABS.map((tab) => {
            const active = topTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setTopTab(tab.id);
                  if (tab.id !== "predict") setPredictDetail(false);
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold press",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
                {tab.label}
              </button>
            );
          })}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link
              to="/opentoken/terminal"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground press"
            >
              Terminal
            </Link>
            <Link
              to="/opentoken/portfolio"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground press"
              aria-label="Portfolio"
            >
              <Wallet className="h-4 w-4" />
            </Link>
            {isStaff && (
              <Link
                to="/opentoken/admin"
                className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground press"
                aria-label="Admin"
              >
                <Shield className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {topTab === "home" && (
        <HomeTab
          currency={currency}
          totalUsd={totalUsd}
          avgChange={avgChange}
          ousdBal={ousdBal}
          walletName={String(wallet?.name ?? "Main Account")}
          holdings={holdings}
          trending={trending}
          majorMarkets={majorMarkets}
          loading={tokensLoading}
          onOpenPredict={() => setTopTab("predict")}
        />
      )}

      {topTab === "trade" && (
        <TradeTab
          currency={currency}
          tradeFilter={tradeFilter}
          setTradeFilter={setTradeFilter}
          payId={payId}
          receiveId={receiveId}
          setPayId={setPayId}
          setReceiveId={setReceiveId}
          payAmount={payAmount}
          setPayAmount={setPayAmount}
          onFlip={() => {
            setPayId(receiveId);
            setReceiveId(payId);
            setPayAmount("");
          }}
          list={tradeList}
          loading={tokensLoading}
          wallet={wallet}
          holdings={holdings}
          majorMarkets={majorMarkets}
          tokens={tokens as any[]}
          swapBusy={swapBusy}
          onSwap={async () => {
            if (!wallet?.id) {
              toast.error("Create a wallet first");
              return;
            }
            const amt = Number(payAmount);
            if (!(amt > 0)) {
              toast.error("Enter a valid amount");
              return;
            }
            if (payId === receiveId) {
              toast.error("Select two different tokens");
              return;
            }
            const fromMeta = resolveTradeAsset(payId, tokens as any[], majorMarkets, wallet, holdings);
            const toMeta = resolveTradeAsset(receiveId, tokens as any[], majorMarkets, wallet, holdings);
            if (!fromMeta || !toMeta) {
              toast.error("Token not found");
              return;
            }
            if (fromMeta.price <= 0 || toMeta.price <= 0) {
              toast.error("Invalid token price");
              return;
            }
            if (amt > fromMeta.balance + 1e-12) {
              toast.error(`Insufficient ${fromMeta.symbol} balance`);
              return;
            }
            const rawOut = (amt * fromMeta.price) / toMeta.price;
            const { net: expectedOut } = applyOpenDexFee(rawOut);
            if (!(expectedOut > 0)) {
              toast.error("Swap amount too small after fee");
              return;
            }
            setSwapBusy(true);
            try {
              const res = await swapFn({
                data: {
                  wallet_id: String(wallet.id),
                  from_id: payId,
                  to_id: receiveId,
                  amount: amt,
                  slippage: 0.5,
                  expected_out: expectedOut,
                },
              });
              notifySuccess(`Swapped ${formatNumber(res.amount_in, 6)} ${res.from_symbol} → ${formatNumber(res.amount_out, 6)} ${res.to_symbol}`, { sound: "swap" });
              setPayAmount("");
              await Promise.all([
                qc.invalidateQueries({ queryKey: ["active-wallet", user.id] }),
                qc.invalidateQueries({ queryKey: ["ot-home-holdings"] }),
                qc.invalidateQueries({ queryKey: ["holdings"] }),
                qc.invalidateQueries({ queryKey: ["recent-txs"] }),
              ]);
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setSwapBusy(false);
            }
          }}
        />
      )}

      {topTab === "predict" &&
        (predictDetail ? (
          <PredictDetail
            asset={predictAsset}
            setAsset={setPredictAsset}
            windowId={predictWindow}
            setWindowId={setPredictWindow}
            market={predictMarket}
            def={predictDef}
            upOdds={upOdds}
            downOdds={downOdds}
            ousdBalance={ousdBal}
            majorBalance={predictMajorBal}
            walletId={wallet?.id ? String(wallet.id) : undefined}
            onBack={() => setPredictDetail(false)}
            onBuyWithMethods={() => setPredictBuyOpen(true)}
            onTrade={async (side, stakeUsd) => {
              if (!wallet?.id) {
                toast.error("Create a wallet first");
                return;
              }
              const price = Number(predictMarket.price ?? 0);
              if (!(price > 0)) throw new Error("Live price unavailable");
              if (side === "up") {
                if (ousdBal + 1e-12 < stakeUsd) {
                  setPredictBuyOpen(true);
                  toast.message("Top up or pay with another method to buy");
                  return;
                }
                const res = await buyMajorFn({
                  data: {
                    wallet_id: String(wallet.id),
                    major_id: predictAsset,
                    usd_amount: stakeUsd,
                  },
                });
                notifySuccess(
                  `Bought ${formatNumber(Number(res.token_amount ?? 0), 6)} ${predictDef.symbol}`,
                  {
                    sound: "receive",
                    description: `Spent ${formatOUSD(stakeUsd)} at live $${formatNumber(price, price < 1 ? 4 : 2)}`,
                  },
                );
              } else {
                const tokenAmt = stakeUsd / price;
                if (predictMajorBal + 1e-12 < tokenAmt) {
                  toast.error(
                    `Need ${formatNumber(tokenAmt, 6)} ${predictDef.symbol} to sell (have ${formatNumber(predictMajorBal, 6)})`,
                  );
                  return;
                }
                const res = await swapFn({
                  data: {
                    wallet_id: String(wallet.id),
                    from_id: LEDGER_MAJOR_SWAP_IDS[predictAsset],
                    to_id: OUSD_SWAP_ID,
                    amount: tokenAmt,
                    slippage: 2,
                  },
                });
                notifySuccess(`Sold ${formatNumber(tokenAmt, 6)} ${predictDef.symbol}`, { sound: "send", description: `Received ${formatOUSD(Number(res.amount_out ?? stakeUsd))} OUSD` });
              }
              await refreshPredictBalances();
            }}
          />
        ) : (
          <PredictTab
            majorMarkets={majorMarkets}
            predictAsset={predictAsset}
            setPredictAsset={setPredictAsset}
            upOdds={upOdds}
            downOdds={downOdds}
            onOpenDetail={() => setPredictDetail(true)}
          />
        ))}

      <AssetBuySheet
        open={predictBuyOpen}
        onClose={() => {
          setPredictBuyOpen(false);
          void refreshPredictBalances();
        }}
        userId={user.id}
        walletId={wallet?.id ? String(wallet.id) : undefined}
        ousdBalance={ousdBal}
        returnPath="/opentoken"
        token={{
          id: predictAsset,
          symbol: predictDef.symbol,
          name: predictDef.name,
          price: Number(predictMarket.price ?? 0),
          logoUrl: predictDef.logoUrl,
          majorId: predictAsset,
        }}
      />

      {topTab === "explore" && (
        <ExploreTab
          currency={currency}
          exploreFilter={exploreFilter}
          setExploreFilter={setExploreFilter}
          trending={trending}
          loading={tokensLoading}
        />
      )}

      <ExploreDock
        query={q}
        onQueryChange={setQ}
        searchOpen={searchOpen}
        onSearchOpenChange={setSearchOpen}
        placeholder="Search OpenPay"
      />
    </div>
  );
}

/* ───────────────────────── HOME ───────────────────────── */

function HomeTab({
  currency,
  totalUsd,
  avgChange,
  ousdBal,
  walletName,
  holdings,
  trending,
  majorMarkets,
  loading,
  onOpenPredict,
}: {
  currency: CurrencyCode;
  totalUsd: number;
  avgChange: number;
  ousdBal: number;
  walletName: string;
  holdings: any[];
  trending: any[];
  majorMarkets: Awaited<ReturnType<typeof fetchMajorMarkets>>;
  loading: boolean;
  onOpenPredict: () => void;
}) {
  const up = avgChange >= 0;
  return (
    <div className="space-y-6 px-1 pt-2">
      <button type="button" className="flex items-center gap-1 text-sm font-semibold text-muted-foreground press">
        {walletName}
        <ChevronDown className="h-4 w-4" />
      </button>

      <div>
        <p className="text-[2.35rem] font-extrabold tracking-tight tabular-nums leading-none">
          {formatCurrency(totalUsd, currency)}
        </p>
        <div className="mt-2">
          <span
            className={cn(
              "inline-flex rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums",
              up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
            )}
          >
            {formatPct(avgChange)}
          </span>
        </div>
      </div>

      {/* Cash / OpenUSD */}
      <Link
        to="/topup"
        search={{
          openpay_charge: undefined,
          openpay_ref: undefined,
          openpay_tx: undefined,
          openpay_return: undefined,
          openpay_cancel: undefined,
          banxa_return: undefined,
          banxa_ext: undefined,
        }}
        className="flex items-center gap-3 rounded-2xl bg-muted/70 px-4 py-3.5 press"
      >
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15">
          <OusdIcon className="h-7 w-7" />
        </div>
        <span className="flex-1 text-[15px] font-semibold">Cash</span>
        <span className="text-[15px] font-bold tabular-nums">{formatOUSD(ousdBal)}</span>
      </Link>

      {/* Tokens */}
      <section>
        <SectionTitle title="Tokens" to="/opentoken/portfolio" />
        <ul className="mt-1">
          {holdings.length === 0 && !loading ? (
            trending.slice(0, 5).map((t) => (
              <TokenListRow key={String(t.id)} token={t} currency={currency} showBalance={false} />
            ))
          ) : (
            holdings.slice(0, 8).map((h: any) => {
              const t = h.tokens;
              const bal = Number(h.balance ?? 0);
              const price = Number(t?.price_usd ?? 0);
              return (
                <li key={String(h.token_id)}>
                  <Link
                    to="/opentoken/$tokenId"
                    params={{ tokenId: t.id }}
                    className="ph-row press"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <TokenAvatar
                        logoUrl={t.logo_url}
                        name={t.name}
                        symbol={t.symbol}
                        verified={Boolean(t.is_verified)}
                      />
                      <div className="min-w-0">
                        <div className="ph-row-title truncate">{t.name}</div>
                        <div className="ph-row-sub tabular-nums">
                          {formatNumber(bal)} {t.symbol}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[15px] font-bold tabular-nums">
                        {formatCurrency(bal * price, currency)}
                      </div>
                      <div
                        className={cn(
                          "text-xs font-bold",
                          Number(t.change_24h ?? 0) >= 0 ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {formatPct(Number(t.change_24h ?? 0))}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })
          )}
          {loading && <TokenSkeleton count={4} />}
        </ul>
      </section>

      {/* Perps-style majors rail */}
      <section>
        <SectionTitle title="Majors" />
        <div className="mt-2 flex gap-2.5 overflow-x-auto pb-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
          {MAJOR_TOKEN_IDS.map((id) => {
            const def = MAJOR_TOKENS[id];
            const m = majorMarketById(majorMarkets, id);
            const ch = Number(m.change24h ?? 0);
            return (
              <Link
                key={id}
                to="/asset/$tokenId"
                params={{ tokenId: id }}
                search={{}}
                className="w-29.5 shrink-0 rounded-2xl bg-muted/70 p-3 press"
              >
                <img src={def.logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                <p className="mt-3 text-sm font-bold">{def.symbol}</p>
                <p
                  className={cn(
                    "mt-0.5 text-xs font-bold tabular-nums",
                    ch >= 0 ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {formatPct(ch)}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Predictions preview */}
      <section>
        <SectionTitle title="Predictions" onClick={onOpenPredict} />
        <div className="mt-2 flex gap-2.5 overflow-x-auto pb-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
          {PREDICT_UPCOMING.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={onOpenPredict}
              className="w-42 shrink-0 rounded-2xl bg-muted/70 p-3 text-left press"
            >
              <div
                className="grid h-8 w-8 place-items-center rounded-lg text-xs font-black text-white"
                style={{ backgroundColor: ev.accent }}
              >
                ◆
              </div>
              <p className="mt-3 line-clamp-2 text-sm font-semibold leading-snug">{ev.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{ev.eta}</p>
            </button>
          ))}
          <button
            type="button"
            onClick={onOpenPredict}
            className="flex w-42 shrink-0 flex-col justify-between rounded-2xl bg-muted/70 p-3 text-left press"
          >
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/20 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="mt-3 text-sm font-semibold leading-snug">Get started with Predictions</p>
          </button>
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────── TRADE ───────────────────────── */

type TradeAssetMeta = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  balance: number;
  logoUrl?: string;
};

function resolveTradeAsset(
  id: string,
  tokens: any[],
  majorMarkets: Awaited<ReturnType<typeof fetchMajorMarkets>>,
  wallet: Record<string, unknown> | null | undefined,
  holdings: any[],
): TradeAssetMeta | null {
  if (id === OUSD_SWAP_ID) {
    return {
      id: OUSD_SWAP_ID,
      symbol: "OUSD",
      name: "OpenPay USD",
      price: 1,
      balance: Number(wallet?.ousd_balance ?? 0),
      logoUrl: OUSD_LOGO_URL,
    };
  }
  const major = majorIdFromSwapId(id);
  if (major) {
    const def = MAJOR_TOKENS[major];
    const m = majorMarketById(majorMarkets, major);
    return {
      id: LEDGER_MAJOR_SWAP_IDS[major],
      symbol: def.symbol,
      name: def.name,
      price: Number(m.price ?? 0),
      balance: readMajorBalance(wallet, major),
      logoUrl: def.logoUrl,
    };
  }
  const tok = tokens.find((t) => t.id === id);
  if (!tok) return null;
  const holding = holdings.find((h: any) => h.token_id === id || h.tokens?.id === id);
  return {
    id: String(tok.id),
    symbol: String(tok.symbol ?? "?"),
    name: String(tok.name ?? tok.symbol ?? "Token"),
    price: Number(tok.price_usd ?? 0),
    balance: Number(holding?.balance ?? 0),
    logoUrl: tok.logo_url ?? undefined,
  };
}

function TradeTab({
  currency,
  tradeFilter,
  setTradeFilter,
  payId,
  receiveId,
  setPayId,
  setReceiveId,
  payAmount,
  setPayAmount,
  onFlip,
  list,
  loading,
  wallet,
  holdings,
  majorMarkets,
  tokens,
  swapBusy,
  onSwap,
}: {
  currency: CurrencyCode;
  tradeFilter: TradeFilter;
  setTradeFilter: (f: TradeFilter) => void;
  payId: string;
  receiveId: string;
  setPayId: (id: string) => void;
  setReceiveId: (id: string) => void;
  payAmount: string;
  setPayAmount: (v: string) => void;
  onFlip: () => void;
  list: any[];
  loading: boolean;
  wallet: Record<string, unknown> | null | undefined;
  holdings: any[];
  majorMarkets: Awaited<ReturnType<typeof fetchMajorMarkets>>;
  tokens: any[];
  swapBusy: boolean;
  onSwap: () => Promise<void>;
}) {
  const filters: { id: TradeFilter; label: string; icon: LucideIcon }[] = [
    { id: "featured", label: "Featured", icon: Sparkles },
    { id: "trending", label: "Trending", icon: ArrowUp },
    { id: "volume", label: "Top Volume", icon: Wallet },
  ];

  const pay = resolveTradeAsset(payId, tokens, majorMarkets, wallet, holdings);
  const receive = resolveTradeAsset(receiveId, tokens, majorMarkets, wallet, holdings);
  const amt = Number(payAmount) || 0;
  const rawOut =
    pay && receive && pay.price > 0 && receive.price > 0 && amt > 0
      ? (amt * pay.price) / receive.price
      : 0;
  const { net: netOut } = applyOpenDexFee(rawOut);
  const canSwap =
    !!wallet?.id &&
    !swapBusy &&
    amt > 0 &&
    payId !== receiveId &&
    !!pay &&
    !!receive &&
    pay.price > 0 &&
    receive.price > 0 &&
    amt <= pay.balance + 1e-12 &&
    netOut > 0;

  function pickReceive(token: any) {
    const id = String(token.id);
    setReceiveId(id);
    if (payId === id) setPayId(OUSD_SWAP_ID);
  }

  return (
    <div className="space-y-5 px-1 pt-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {filters.map((f) => {
          const Icon = f.icon;
          const active = tradeFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setTradeFilter(f.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold press",
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Swap cards */}
      <div className="relative space-y-2">
        <div className="rounded-[1.35rem] bg-muted/80 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">You Pay</p>
            {pay ? (
              <button
                type="button"
                className="text-[11px] font-semibold text-muted-foreground press"
                onClick={() => setPayAmount(String(pay.balance))}
              >
                Bal {formatNumber(pay.balance, pay.balance < 1 ? 6 : 4)}
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={payAmount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, "");
                if ((v.match(/\./g) ?? []).length > 1) return;
                setPayAmount(v);
              }}
              className="h-auto border-0 bg-transparent p-0 text-3xl font-extrabold tabular-nums shadow-none focus-visible:ring-0"
            />
            <Link
              to="/swap"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-background px-3 py-2 text-sm font-bold press"
            >
              <TokenChip symbol={pay?.symbol ?? "SOL"} logoUrl={pay?.logoUrl} />
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          </div>
          <div className="mt-2 flex gap-2">
            {[0.25, 0.5, 1].map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={!pay || pay.balance <= 0}
                onClick={() =>
                  setPayAmount(
                    pct >= 1
                      ? String(pay?.balance ?? 0)
                      : String(Math.floor(((pay?.balance ?? 0) * pct) * 1e8) / 1e8),
                  )
                }
                className="rounded-full bg-background/70 px-2.5 py-1 text-[11px] font-bold text-muted-foreground press disabled:opacity-40"
              >
                {pct >= 1 ? "MAX" : `${pct * 100}%`}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onFlip}
          className="absolute left-1/2 top-[42%] z-10 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg press"
          aria-label="Flip tokens"
        >
          <ArrowLeftRight className="h-4 w-4 rotate-90" />
        </button>

        <div className="rounded-[1.35rem] bg-muted/80 p-4">
          <p className="text-xs font-semibold text-muted-foreground">You Receive</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p
              className={cn(
                "text-3xl font-extrabold tabular-nums",
                netOut > 0 ? "text-foreground" : "text-muted-foreground/80",
              )}
            >
              {netOut > 0 ? formatNumber(netOut, netOut < 1 ? 6 : 4) : "0"}
            </p>
            <Link
              to="/swap"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-background px-3 py-2 text-sm font-bold press"
            >
              <TokenChip symbol={receive?.symbol ?? "OUSD"} logoUrl={receive?.logoUrl} />
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          </div>
          {pay && receive && pay.price > 0 && receive.price > 0 ? (
            <p className="mt-2 text-[11px] font-medium text-muted-foreground">
              1 {pay.symbol} ≈ {formatNumber(pay.price / receive.price, 6)} {receive.symbol}
            </p>
          ) : null}
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        className="h-12 w-full rounded-2xl text-base font-bold"
        disabled={!canSwap}
        onClick={() => void onSwap()}
      >
        {swapBusy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Swapping…
          </>
        ) : !wallet?.id ? (
          "Create a wallet to swap"
        ) : amt <= 0 ? (
          "Enter amount"
        ) : pay && amt > pay.balance + 1e-12 ? (
          `Insufficient ${pay.symbol}`
        ) : (
          "Swap"
        )}
      </Button>

      <div className="flex items-center justify-between px-0.5">
        <div className="flex gap-4">
          <span className="text-lg font-extrabold">Tokens</span>
          <Link to="/opentoken/terminal" className="text-lg font-extrabold text-muted-foreground">
            Terminal
          </Link>
        </div>
        <Button asChild size="sm" variant="ghost" className="rounded-full text-primary">
          <Link to="/swap">OpenDEX</Link>
        </Button>
      </div>

      <ul>
        {loading ? (
          <TokenSkeleton count={8} />
        ) : list.length === 0 ? (
          <li className="py-12 text-center text-sm text-muted-foreground">No tokens yet</li>
        ) : (
          list.slice(0, 40).map((t, i) => (
            <RankedTokenRow
              key={String(t.id)}
              token={t}
              currency={currency}
              rank={i + 1}
              onTrade={() => pickReceive(t)}
            />
          ))
        )}
      </ul>
    </div>
  );
}

/* ───────────────────────── PREDICT ───────────────────────── */

function majorSparkTicks(market: MajorMarketSnapshot | { price: number; change24h: number; sparkline?: number[] }): ChartTick[] {
  const spark = Array.isArray((market as MajorMarketSnapshot).sparkline)
    ? (market as MajorMarketSnapshot).sparkline
    : [];
  if (!spark.length) return [];
  const now = Date.now();
  const n = spark.length;
  return spark.map((p, i) => ({
    created_at: new Date(now - (n - 1 - i) * 60 * 60 * 1000).toISOString(),
    price: Number(p) || 0,
  }));
}

function predictPeriod(windowId: (typeof PREDICT_WINDOWS)[number]["id"]) {
  if (windowId === "5m") return "5M";
  if (windowId === "1h") return "1H";
  return "15M";
}

const PREDICT_STAKES = [10, 25, 50, 100] as const;

function PredictTab({
  majorMarkets,
  predictAsset,
  setPredictAsset,
  upOdds,
  downOdds,
  onOpenDetail,
}: {
  majorMarkets: Awaited<ReturnType<typeof fetchMajorMarkets>>;
  predictAsset: MajorTokenId;
  setPredictAsset: (id: MajorTokenId) => void;
  upOdds: number;
  downOdds: number;
  onOpenDetail: () => void;
}) {
  const def = MAJOR_TOKENS[predictAsset];
  const m = majorMarketById(majorMarkets, predictAsset);
  const ticks = useMemo(() => majorSparkTicks(m), [m]);
  const chartTicks = useMemo(
    () =>
      resolveChartTicks({
        period: "15M",
        ticks,
        price: Number(m.price ?? 0),
        changePct: Number(m.change24h ?? 0),
        tokenKey: predictAsset,
        peg: ["usdc", "usdt", "pyusd", "usdg", "usd1", "cash"].includes(predictAsset),
      }),
    [ticks, m.price, m.change24h, predictAsset],
  );
  const up = Number(m.change24h ?? 0) >= 0;

  return (
    <div className="space-y-7 px-1 pt-2">
      <section>
        <h2 className="text-lg font-extrabold">Upcoming</h2>
        <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {PREDICT_UPCOMING.map((ev) => (
            <div key={ev.id} className="w-37.5 shrink-0 rounded-2xl bg-muted/70 p-3">
              <div
                className="grid h-8 w-8 place-items-center rounded-lg text-[10px] font-black text-white"
                style={{ backgroundColor: ev.accent }}
              >
                ◆
              </div>
              <p className="mt-3 line-clamp-2 text-sm font-semibold leading-snug">{ev.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{ev.eta}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <button type="button" onClick={onOpenDetail} className="flex items-center gap-0.5 press">
          <h2 className="text-lg font-extrabold">Up or Down</h2>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        <button
          type="button"
          onClick={onOpenDetail}
          className="mt-3 w-full rounded-[1.5rem] bg-muted/80 p-4 text-left press"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <img src={def.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
              <div>
                <p className="text-sm font-semibold text-muted-foreground">{def.symbol}</p>
                <p className="text-xl font-extrabold tabular-nums">
                  {formatCurrency(Number(m.price ?? 0), "USD")}
                </p>
              </div>
            </div>
            <CountdownChip seconds={15 * 60} />
          </div>

          <div className="mt-3 -mx-1">
            <PriceChart
              ticks={chartTicks}
              trend={up ? "up" : "down"}
              height={120}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-background/60 px-3 py-3 text-center text-sm font-bold text-emerald-400">
              ▲ Buy · {upOdds}%
            </div>
            <div className="rounded-2xl bg-background/60 px-3 py-3 text-center text-sm font-bold text-red-400">
              ▼ Sell · {downOdds}%
            </div>
          </div>
        </button>
      </section>

      <section>
        <h2 className="text-lg font-extrabold">15 Minute Markets</h2>
        <p className="mt-1 text-xs text-muted-foreground">All majors · live CoinGecko prices</p>
        <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {MAJOR_TOKEN_IDS.map((id) => {
            const d = MAJOR_TOKENS[id];
            const mm = majorMarketById(majorMarkets, id);
            const ch = Number(mm.change24h ?? 0);
            const selected = id === predictAsset;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPredictAsset(id);
                  onOpenDetail();
                }}
                className={cn(
                  "w-30 shrink-0 rounded-2xl p-3 text-left press",
                  selected ? "bg-primary/15 ring-1 ring-primary/40" : "bg-muted/70",
                )}
              >
                <img src={d.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                <p className="mt-3 text-sm font-bold">{d.symbol}</p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {formatCurrency(Number(mm.price ?? 0), "USD")}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-xs font-bold tabular-nums",
                    ch >= 0 ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {formatPct(ch)} · 15m
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PredictDetail({
  asset,
  setAsset,
  windowId,
  setWindowId,
  market,
  def,
  upOdds,
  downOdds,
  ousdBalance,
  majorBalance,
  walletId,
  onBack,
  onBuyWithMethods,
  onTrade,
}: {
  asset: MajorTokenId;
  setAsset: (id: MajorTokenId) => void;
  windowId: (typeof PREDICT_WINDOWS)[number]["id"];
  setWindowId: (id: (typeof PREDICT_WINDOWS)[number]["id"]) => void;
  market: MajorMarketSnapshot;
  def: (typeof MAJOR_TOKENS)[MajorTokenId];
  upOdds: number;
  downOdds: number;
  ousdBalance: number;
  majorBalance: number;
  walletId?: string;
  onBack: () => void;
  onBuyWithMethods: () => void;
  onTrade: (side: "up" | "down", stakeUsd: number) => Promise<void>;
}) {
  const win = PREDICT_WINDOWS.find((w) => w.id === windowId) ?? PREDICT_WINDOWS[0];
  const [stake, setStake] = useState("25");
  const [busy, setBusy] = useState<"up" | "down" | null>(null);
  const stakeUsd = Math.max(0, Number(stake) || 0);
  const price = Number(market.price ?? 0);
  const tokenOut = price > 0 ? stakeUsd / price : 0;
  const majorUsd = majorBalance * price;
  const ticks = useMemo(() => majorSparkTicks(market), [market]);
  const chartTicks = useMemo(
    () =>
      resolveChartTicks({
        period: predictPeriod(windowId),
        ticks,
        price,
        changePct: Number(market.change24h ?? 0),
        tokenKey: asset,
        peg: ["usdc", "usdt", "pyusd", "usdg", "usd1", "cash"].includes(asset),
      }),
    [windowId, ticks, price, market.change24h, asset],
  );
  const target = price * (1 - Number(market.change24h ?? 0) / 400);
  const above = price >= target;
  const deltaPct = target ? ((price - target) / target) * 100 : 0;
  const canBuy = !!walletId && stakeUsd >= 0.01 && ousdBalance + 1e-12 >= stakeUsd;
  const canSell = !!walletId && stakeUsd >= 0.01 && price > 0 && majorBalance + 1e-12 >= tokenOut;

  async function place(side: "up" | "down") {
    if (!(stakeUsd >= 0.01)) {
      toast.error("Enter a stake of at least $0.01");
      return;
    }
    setBusy(side);
    try {
      await onTrade(side, Math.round(stakeUsd * 100) / 100);
    } catch (err) {
      toast.error((err as Error).message || "Trade failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5 px-1 pt-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="text-xs font-semibold text-muted-foreground press">
            ← Up or Down
          </button>
          <div className="mt-2 flex items-center gap-2">
            <img src={def.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            <div className="flex max-w-55 gap-1 overflow-x-auto scrollbar-none">
              {MAJOR_TOKEN_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAsset(id)}
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold press",
                    id === asset ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {MAJOR_TOKENS[id].symbol}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-2xl font-extrabold press"
            onClick={() => {
              const idx = PREDICT_WINDOWS.findIndex((w) => w.id === windowId);
              const next = PREDICT_WINDOWS[(idx + 1) % PREDICT_WINDOWS.length]!;
              setWindowId(next.id);
            }}
          >
            {def.symbol} {win.label}
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </button>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">
            {formatCurrency(price, "USD")}
          </p>
          <p className={cn("mt-1 text-sm font-semibold", above ? "text-emerald-400" : "text-red-400")}>
            {formatPct(deltaPct)} {above ? "above" : "below"} {formatCurrency(target, "USD")} target
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-muted press"
            aria-label="Favorite"
          >
            <Heart className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-muted press"
            aria-label="Share"
            onClick={() => {
              void navigator.clipboard?.writeText(
                `${window.location.origin}/opentoken?predict=${asset}`,
              );
              toast.success("Prediction link copied");
            }}
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative rounded-[1.5rem] bg-muted/40 p-3">
        <PriceChart
          ticks={chartTicks}
          trend={Number(market.change24h ?? 0) >= 0 ? "up" : "down"}
          height={200}
        />
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1 font-semibold tabular-nums">
            Live · Target {formatCurrency(target, "USD")}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold">
            <Hourglass className="h-3.5 w-3.5" />
            <CountdownChip seconds={win.seconds} bare />
          </span>
        </div>
      </div>

      <div className="rounded-2xl bg-card px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-extrabold">Trade size (USD)</p>
          <p className="text-[11px] text-muted-foreground">
            Cash {formatOUSD(ousdBalance)} · {def.symbol} {formatNumber(majorBalance, 6)}
          </p>
        </div>
        <div className="flex gap-2">
          {PREDICT_STAKES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStake(String(n))}
              className={cn(
                "flex-1 rounded-full py-2 text-xs font-bold press",
                Number(stake) === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              ${n}
            </button>
          ))}
        </div>
        <Input
          type="number"
          min="0.01"
          step="any"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          className="h-11 rounded-xl text-base font-semibold tabular-nums"
          placeholder="Custom amount"
        />
        <p className="text-[11px] text-muted-foreground">
          Up buys ≈ {formatNumber(tokenOut, 6)} {def.symbol} with OUSD · Down sells that size for OUSD
          {majorUsd > 0 ? ` · position ≈ ${formatCurrency(majorUsd, "USD")}` : ""}
        </p>
      </div>

      <div>
        <h3 className="text-base font-extrabold">Make a Prediction</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Real ledger trade at live price — Up = buy · Down = sell
        </p>
        <div className="mt-3 space-y-2">
          <PredictOddsRow side="up" stake={stakeUsd || 25} mult={+(100 / Math.max(upOdds, 1)).toFixed(1)} pct={upOdds} />
          <PredictOddsRow
            side="down"
            stake={stakeUsd || 25}
            mult={+(100 / Math.max(downOdds, 1)).toFixed(1)}
            pct={downOdds}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onBuyWithMethods}
        className="flex w-full items-center gap-2 rounded-2xl bg-muted/60 px-3 py-3 text-left press"
      >
        <CreditCard className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Pay with MoonPay / Pi / OpenPay / crypto</span>
        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
      </button>

      <div className="space-y-2">
        <Link
          to="/chat"
          className="flex items-center gap-2 rounded-2xl bg-muted/60 px-3 py-3 press"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-sm font-semibold">OpenPay Live</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="ml-auto text-xs text-muted-foreground">Global room</span>
        </Link>
        <p className="px-1 text-[11px] text-muted-foreground">
          Each OpenToken also has its own community chat — open any token → Live.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 pb-2">
        <Button
          type="button"
          disabled={!!busy || !walletId || stakeUsd < 0.01}
          onClick={() => void place("up")}
          className="h-14 rounded-full border border-emerald-500/30 bg-background text-base font-extrabold text-emerald-400 hover:bg-emerald-500/10"
        >
          {busy === "up" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="mr-1 h-4 w-4" />
          )}
          {canBuy ? `Buy · ${upOdds}%` : ousdBalance < stakeUsd ? "Top up to buy" : `Up · ${upOdds}%`}
        </Button>
        <Button
          type="button"
          disabled={!!busy || !walletId || stakeUsd < 0.01 || !canSell}
          onClick={() => void place("down")}
          className="h-14 rounded-full border border-red-500/30 bg-background text-base font-extrabold text-red-400 hover:bg-red-500/10"
        >
          {busy === "down" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowDown className="mr-1 h-4 w-4" />
          )}
          {canSell ? `Sell · ${downOdds}%` : `Need ${def.symbol}`}
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────── EXPLORE ───────────────────────── */

function ExploreTab({
  currency,
  exploreFilter,
  setExploreFilter,
  trending,
  loading,
}: {
  currency: CurrencyCode;
  exploreFilter: ExploreFilter;
  setExploreFilter: (f: ExploreFilter) => void;
  trending: any[];
  loading: boolean;
}) {
  const filters: { id: ExploreFilter; label: string; icon: LucideIcon; color: string }[] = [
    { id: "tokens", label: "Tokens", icon: Sparkles, color: "text-emerald-400" },
    { id: "perps", label: "Perps", icon: InfinityIcon, color: "text-pink-400" },
    { id: "people", label: "People", icon: Users, color: "text-amber-400" },
  ];

  const headlines = useMemo(() => {
    return trending.slice(0, 6).map((t, i) => ({
      id: String(t.id),
      sources: 40 + ((i * 37) % 220),
      mins: 5 + ((i * 13) % 90),
      title: `${t.name} (${t.symbol}) ${Number(t.change_24h ?? 0) >= 0 ? "surges" : "slides"} as OpenToken volume heats up`,
      tag: t.symbol,
      change: Number(t.change_24h ?? 0),
    }));
  }, [trending]);

  return (
    <div className="space-y-6 px-1 pt-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {filters.map((f) => {
          const Icon = f.icon;
          const active = exploreFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setExploreFilter(f.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold press",
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", !active && f.color)} />
              {f.label}
            </button>
          );
        })}
      </div>

      {exploreFilter === "people" ? (
        <div className="rounded-2xl bg-muted/60 px-4 py-10 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Creators & traders</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Meet creators in OpenPay Live, or open any token&apos;s own community chat.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild className="rounded-full" size="sm">
              <Link to="/chat">OpenPay Live</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <section>
            <SectionTitle title="Trending Tokens" to="/opentoken/terminal" />
            <div className="mt-2 rounded-2xl bg-muted/50 px-1 py-1">
              <ul>
                {loading ? (
                  <TokenSkeleton count={5} />
                ) : (
                  trending.slice(0, 8).map((t, i) => (
                    <RankedTokenRow key={String(t.id)} token={t} currency={currency} rank={i + 1} />
                  ))
                )}
              </ul>
            </div>
          </section>

          <section>
            <SectionTitle title="What's Happening" to="/blog" />
            <ul className="mt-2 space-y-4">
              {headlines.map((h) => (
                <li key={h.id}>
                  <Link to="/opentoken/$tokenId" params={{ tokenId: h.id }} className="block press">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {h.sources} Sources · {h.mins}m
                    </p>
                    <p className="mt-1 text-[15px] font-semibold leading-snug">{h.title}</p>
                    <p className="mt-1 text-xs font-bold text-muted-foreground">
                      {h.tag}{" "}
                      <span className={h.change >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {formatPct(h.change)}
                      </span>
                    </p>
                  </Link>
                </li>
              ))}
              {!loading && headlines.length === 0 ? (
                <li className="py-8 text-center text-sm text-muted-foreground">No market stories yet</li>
              ) : null}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── shared bits ───────────────────────── */

function SectionTitle({
  title,
  to,
  onClick,
}: {
  title: string;
  to?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <h2 className="text-lg font-extrabold">{title}</h2>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </>
  );
  if (to) {
    return (
      <Link to={to} className="inline-flex items-center gap-0.5 press">
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="inline-flex items-center gap-0.5 press">
        {inner}
      </button>
    );
  }
  return <div className="inline-flex items-center gap-0.5">{inner}</div>;
}

function TokenChip({ symbol, logoUrl }: { symbol: string; logoUrl?: string }) {
  const logo =
    logoUrl ||
    (symbol.toUpperCase() === "OUSD"
      ? OUSD_LOGO_URL
      : symbol.toUpperCase() === "SOL"
        ? MAJOR_TOKENS.sol.logoUrl
        : undefined);
  return (
    <>
      {logo ? (
        <img src={logo} alt="" className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/20 text-[9px] font-bold">
          {symbol.slice(0, 2)}
        </span>
      )}
      {symbol}
      <BadgeCheck className="h-3.5 w-3.5 text-primary" />
    </>
  );
}

function TokenListRow({
  token: t,
  currency,
  showBalance,
}: {
  token: any;
  currency: CurrencyCode;
  showBalance?: boolean;
}) {
  return (
    <li className="flex items-stretch gap-1">
      <Link
        to="/opentoken/$tokenId"
        params={{ tokenId: t.id }}
        className="ph-row min-w-0 flex-1 press"
      >
        <div className="flex min-w-0 items-center gap-3">
          <TokenAvatar
            logoUrl={t.logo_url}
            name={t.name}
            symbol={t.symbol}
            verified={Boolean(t.is_verified)}
          />
          <div className="min-w-0">
            <div className="ph-row-title truncate">{t.name}</div>
            <div className="ph-row-sub">
              {t.symbol}
              {showBalance ? "" : ""}
            </div>
          </div>
        </div>
        <TokenPriceRate
          price={Number(t.price_usd ?? 0)}
          change={Number(t.change_24h ?? 0)}
          currency={currency}
        />
      </Link>
      <Link
        to="/opentoken/$tokenId/chat"
        params={{ tokenId: t.id }}
        className="grid w-11 shrink-0 place-items-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground press"
        aria-label={`${t.symbol} community chat`}
        title="Community chat"
      >
        <MessageCircle className="h-4 w-4" />
      </Link>
    </li>
  );
}

function RankedTokenRow({
  token: t,
  currency,
  rank,
  onTrade,
}: {
  token: any;
  currency: CurrencyCode;
  rank: number;
  onTrade?: () => void;
}) {
  const badge =
    rank === 1 ? "bg-amber-400 text-black" : rank === 2 ? "bg-zinc-300 text-black" : rank === 3 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground";
  const mc = Number(t.market_cap ?? 0);
  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={onTrade}
        className="ph-row min-w-0 flex-1 text-left press"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative">
            <TokenAvatar
              logoUrl={t.logo_url}
              name={t.name}
              symbol={t.symbol}
              verified={Boolean(t.is_verified)}
            />
            <span
              className={cn(
                "absolute -bottom-0.5 -left-0.5 grid h-4 w-4 place-items-center rounded-full text-[9px] font-black",
                badge,
              )}
            >
              {rank}
            </span>
          </div>
          <div className="min-w-0">
            <div className="ph-row-title truncate">{t.symbol}</div>
            <div className="ph-row-sub">
              {mc > 0 ? `$${formatCompact(mc)} MC` : t.name}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[15px] font-bold tabular-nums">
            {formatCurrency(Number(t.price_usd ?? 0), currency)}
          </div>
          <div
            className={cn(
              "text-xs font-bold",
              Number(t.change_24h ?? 0) >= 0 ? "text-emerald-400" : "text-red-400",
            )}
          >
            {formatPct(Number(t.change_24h ?? 0))}
          </div>
        </div>
      </button>
      <Link
        to="/opentoken/$tokenId"
        params={{ tokenId: t.id }}
        className="grid w-11 shrink-0 place-items-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground press"
        aria-label={`Open ${t.symbol}`}
        title="Token page"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
      <Link
        to="/opentoken/$tokenId/chat"
        params={{ tokenId: t.id }}
        className="grid w-11 shrink-0 place-items-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground press"
        aria-label={`${t.symbol} community chat`}
        title="Community chat"
      >
        <MessageCircle className="h-4 w-4" />
      </Link>
    </li>
  );
}

function PredictOddsRow({
  side,
  stake,
  mult,
  pct,
}: {
  side: "up" | "down";
  stake: number;
  mult: number;
  pct: number;
}) {
  const up = side === "up";
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-muted/50 px-3 py-3">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-background">
        {up ? <ArrowUp className="h-5 w-5 text-muted-foreground" /> : <ArrowDown className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold capitalize text-muted-foreground">{side}</p>
        <p className="text-sm font-bold tabular-nums">${stake}</p>
      </div>
      <p className="text-sm font-bold tabular-nums">{mult.toFixed(1)}x</p>
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums",
          up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
        )}
      >
        {pct}%
      </span>
    </div>
  );
}

function CountdownChip({ seconds, bare }: { seconds: number; bare?: boolean }) {
  const [left, setLeft] = useState(seconds);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    const tick = () => setLeft(seconds - (Math.floor(Date.now() / 1000) % seconds));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [seconds]);
  const m = Math.floor(left / 60);
  const s = left % 60;
  const label = ready ? `${m}m${String(s).padStart(2, "0")}s` : "—";
  if (bare) return <span className="tabular-nums">{label}</span>;
  return (
    <span className="rounded-full bg-background/70 px-2.5 py-1 text-xs font-bold tabular-nums">
      {label}
    </span>
  );
}

function TokenSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          <div className="h-11 w-11 rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-24 rounded bg-muted" />
            <div className="h-3 w-12 rounded bg-muted" />
          </div>
          <div className="h-3.5 w-14 rounded bg-muted" />
        </li>
      ))}
    </>
  );
}

function clampOdds(n: number) {
  return Math.max(18, Math.min(82, Math.round(n)));
}

function formatCompact(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}
