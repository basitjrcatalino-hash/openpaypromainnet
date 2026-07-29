/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  ChevronDown,
  Loader2,
  Search,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatNumber, formatOUSD, fetchActiveWallet, shortAddress, timeAgo } from "@/lib/wallet-utils";
import { buyOpenToken, sellOpenToken } from "@/lib/opentoken.functions";
import {
  curveFromTokenRow,
  isOpenTokenGraduated,
  quoteBuy,
  quoteSell,
  OPENTOKEN_TRADE_FEE_BPS,
} from "@/lib/opentoken/bonding-curve";
import { TerminalChart, type TerminalPeriod } from "@/components/opentoken";
import type { OtTradeRow } from "@/components/opentoken";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/opentoken_/terminal")({
  head: () => ({ meta: [{ title: "Terminal — OpenPay Pro" }] }),
  component: TerminalPage,
});

type TokenRow = {
  id: string;
  name: string;
  symbol: string;
  price_usd: number;
  market_cap: number;
  volume_24h: number;
  change_24h: number;
  logo_url: string | null;
  is_verified: boolean;
  status: string;
  holder_count: number;
  total_supply: number;
  curve_supply_sold: number;
  curve_reserve_pi: number;
  curve_virtual_pi: number;
  curve_virtual_tokens: number;
  graduation_target_pi: number;
  created_at: string;
  category: string | null;
};

type SortKey = "market_cap" | "volume_24h" | "change_24h" | "price_usd" | "created_at";
type TradeSide = "buy" | "sell";

function TerminalPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const buyFn = useServerFn(buyOpenToken);
  const sellFn = useServerFn(sellOpenToken);

  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("market_cap");
  const [sortAsc, setSortAsc] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<TerminalPeriod>("15M");
  const [tradeSide, setTradeSide] = useState<TradeSide>("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [tradeTab, setTradeTab] = useState<"trades" | "positions" | "holders">("trades");
  const [tokenSheetOpen, setTokenSheetOpen] = useState(false);
  const [tradeSheetOpen, setTradeSheetOpen] = useState(false);

  // Fetch all tokens
  const { data: tokens = [], isLoading: tokensLoading } = useQuery({
    queryKey: ["terminal-tokens"],
    staleTime: 15_000,
    queryFn: async (): Promise<TokenRow[]> => {
      const { data } = await supabase
        .from("tokens")
        .select("id, name, symbol, price_usd, market_cap, volume_24h, change_24h, logo_url, is_verified, status, holder_count, total_supply, curve_supply_sold, curve_reserve_pi, curve_virtual_pi, curve_virtual_tokens, graduation_target_pi, created_at, category")
        .eq("is_hidden", false)
        .order("market_cap", { ascending: false })
        .limit(200);
      return (data ?? []) as TokenRow[];
    },
  });

  // Auto-select first token
  useEffect(() => {
    if (!selectedTokenId && tokens.length > 0) {
      setSelectedTokenId(tokens[0].id);
    }
  }, [tokens, selectedTokenId]);

  const selectedToken = useMemo(
    () => tokens.find((t) => t.id === selectedTokenId) ?? null,
    [tokens, selectedTokenId],
  );

  // Active wallet
  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () => fetchActiveWallet<{ id: string; ousd_balance: number }>(supabase, user.id, "id, ousd_balance"),
  });

  // User holding of selected token
  const { data: holding = 0 } = useQuery({
    queryKey: ["ot-holding", selectedTokenId, wallet?.id],
    enabled: !!wallet?.id && !!selectedTokenId,
    queryFn: async () => {
      const { data } = await supabase
        .from("token_holdings")
        .select("balance")
        .eq("token_id", selectedTokenId!)
        .eq("wallet_id", wallet!.id)
        .maybeSingle();
      return Number(data?.balance ?? 0);
    },
  });

  // Chart ticks
  const { data: ticks = [] } = useQuery({
    queryKey: ["ot-ticks", selectedTokenId, chartPeriod],
    enabled: !!selectedTokenId,
    queryFn: async () => {
      const limit = chartPeriod === "5M" || chartPeriod === "15M" ? 60 : chartPeriod === "1H" ? 48 : 96;
      const { data } = await supabase
        .from("ot_price_ticks")
        .select("created_at, price, market_cap")
        .eq("token_id", selectedTokenId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      return data ?? [];
    },
  });

  // Recent trades for selected token
  const { data: trades = [] } = useQuery({
    queryKey: ["ot-trades", selectedTokenId],
    enabled: !!selectedTokenId,
    queryFn: async (): Promise<OtTradeRow[]> => {
      const { data } = await supabase
        .from("ot_trades")
        .select("id, side, pi_amount, token_amount, price, created_at, tx_ref, user_id")
        .eq("token_id", selectedTokenId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as OtTradeRow[];
    },
  });

  // Top holders for selected token
  const { data: holders = [] } = useQuery({
    queryKey: ["ot-holders", selectedTokenId],
    enabled: !!selectedTokenId && tradeTab === "holders",
    queryFn: async () => {
      const { data } = await supabase
        .from("token_holdings")
        .select("balance, wallet_id, wallets:wallet_id(address, name, user_id)")
        .eq("token_id", selectedTokenId!)
        .gt("balance", 0)
        .order("balance", { ascending: false })
        .limit(25);
      return (data ?? []) as Array<{
        balance: number;
        wallet_id: string;
        wallets: { address: string; name: string; user_id: string } | null;
      }>;
    },
  });

  // User positions (all tokens user holds)
  const { data: positions = [] } = useQuery({
    queryKey: ["ot-positions", wallet?.id],
    enabled: !!wallet?.id && tradeTab === "positions",
    queryFn: async () => {
      const { data } = await supabase
        .from("token_holdings")
        .select("balance, token_id, tokens:token_id(id, name, symbol, price_usd, logo_url)")
        .eq("wallet_id", wallet!.id)
        .gt("balance", 0);
      return (data ?? []) as Array<{
        balance: number;
        token_id: string;
        tokens: { id: string; name: string; symbol: string; price_usd: number; logo_url: string | null } | null;
      }>;
    },
  });

  // Sort & filter tokens
  const sortedTokens = useMemo(() => {
    let list = [...tokens];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (sortKey === "created_at") {
        return sortAsc
          ? new Date(av as string).getTime() - new Date(bv as string).getTime()
          : new Date(bv as string).getTime() - new Date(av as string).getTime();
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [tokens, searchQuery, sortKey, sortAsc]);

  // Trade execution
  const ousdBalance = Number(wallet?.ousd_balance ?? 0);
  const tradeAmtNum = Number(tradeAmount) || 0;

  const quote = useMemo(() => {
    if (!selectedToken || tradeAmtNum <= 0) return null;
    try {
      const curve = curveFromTokenRow(selectedToken as any);
      if (tradeSide === "buy") {
        return quoteBuy(curve, tradeAmtNum);
      }
      return quoteSell(curve, tradeAmtNum);
    } catch {
      return null;
    }
  }, [selectedToken, tradeAmtNum, tradeSide]);

  async function executeTrade() {
    if (!selectedToken || !wallet?.id || tradeAmtNum <= 0) return;
    setBusy(true);
    try {
      if (tradeSide === "buy") {
        if (tradeAmtNum > ousdBalance) {
          toast.error("Insufficient OUSD balance");
          return;
        }
        const res = await buyFn({
          data: { token_id: selectedToken.id, wallet_id: wallet.id, pi_amount: tradeAmtNum },
        });
        toast.success(`Bought ${formatNumber(res.token_amount, 4)} $${selectedToken.symbol}`);
      } else {
        if (tradeAmtNum > holding) {
          toast.error("Insufficient token balance");
          return;
        }
        const res = await sellFn({
          data: { token_id: selectedToken.id, wallet_id: wallet.id, token_amount: tradeAmtNum },
        });
        toast.success(`Sold for ${formatNumber(res.pi_amount, 4)} OUSD`);
      }
      setTradeAmount("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["active-wallet", user.id] }),
        qc.invalidateQueries({ queryKey: ["ot-holding", selectedTokenId] }),
        qc.invalidateQueries({ queryKey: ["ot-trades", selectedTokenId] }),
        qc.invalidateQueries({ queryKey: ["terminal-tokens"] }),
        qc.invalidateQueries({ queryKey: ["ot-positions"] }),
      ]);
    } catch (err) {
      toast.error((err as Error).message || "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-card/90 px-2 py-2 backdrop-blur-sm sm:gap-3 sm:px-3">
        <Link
          to="/opentoken"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Link to="/opentoken" className="hidden shrink-0 text-sm font-bold text-primary sm:inline">
          OpenPay Pro
        </Link>
        <span className="hidden text-xs text-muted-foreground md:inline">Terminal</span>

        {selectedToken ? (
          <button
            type="button"
            onClick={() => setTokenSheetOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-muted/40 md:pointer-events-none md:hover:bg-transparent"
          >
            {selectedToken.logo_url ? (
              <img src={selectedToken.logo_url} alt="" className="h-7 w-7 shrink-0 rounded-full sm:h-6 sm:w-6" />
            ) : (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary sm:h-6 sm:w-6">
                {selectedToken.symbol.slice(0, 2)}
              </span>
            )}
            <span className="truncate text-sm font-bold">{selectedToken.symbol}</span>
            {selectedToken.is_verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground md:hidden" />
            <div className="ml-auto hidden items-center gap-3 overflow-x-auto text-xs lg:flex">
              <span className="whitespace-nowrap">
                Price: <span className="font-semibold tabular-nums">${formatNumber(selectedToken.price_usd, 6)}</span>
              </span>
              <span className="whitespace-nowrap">
                MCap: <span className="font-semibold tabular-nums">${formatNumber(selectedToken.market_cap, 0, { compact: true })}</span>
              </span>
              <span className="whitespace-nowrap">
                24h Vol: <span className="font-semibold tabular-nums">${formatNumber(selectedToken.volume_24h, 0, { compact: true })}</span>
              </span>
              <span className={cn("whitespace-nowrap font-semibold", selectedToken.change_24h >= 0 ? "text-emerald-400" : "text-red-400")}>
                {selectedToken.change_24h >= 0 ? "+" : ""}
                {formatNumber(selectedToken.change_24h, 2)}%
              </span>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setTokenSheetOpen(true)}
            className="flex flex-1 items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground md:hidden"
          >
            Select token <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span>OUSD: {formatNumber(ousdBalance, 2)}</span>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 rounded-lg px-3 text-xs font-semibold lg:hidden"
          onClick={() => setTradeSheetOpen(true)}
        >
          Trade
        </Button>
      </header>

      {/* Mobile stats strip */}
      {selectedToken && (
        <div className="flex shrink-0 gap-3 overflow-x-auto border-b border-border/40 bg-card/50 px-3 py-1.5 text-[11px] lg:hidden">
          <span className="whitespace-nowrap tabular-nums">
            ${formatNumber(selectedToken.price_usd, 6)}
          </span>
          <span className="whitespace-nowrap text-muted-foreground">
            MCap ${formatNumber(selectedToken.market_cap, 0, { compact: true })}
          </span>
          <span className="whitespace-nowrap text-muted-foreground">
            Vol ${formatNumber(selectedToken.volume_24h, 0, { compact: true })}
          </span>
          <span className={cn("whitespace-nowrap font-semibold", selectedToken.change_24h >= 0 ? "text-emerald-400" : "text-red-400")}>
            {selectedToken.change_24h >= 0 ? "+" : ""}
            {formatNumber(selectedToken.change_24h, 2)}%
          </span>
        </div>
      )}

      {/* Main grid */}
      <div className="flex min-h-0 flex-1">
        {/* Left sidebar - Token list (tablet+) */}
        <aside className="hidden w-52 shrink-0 flex-col border-r border-border/50 bg-card/50 md:flex lg:w-60">
          <TokenListPanel
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sortKey={sortKey}
            handleSort={handleSort}
            tokensLoading={tokensLoading}
            sortedTokens={sortedTokens}
            selectedTokenId={selectedTokenId}
            onSelect={(id) => setSelectedTokenId(id)}
          />
        </aside>

        {/* Center - Chart + Trades */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-[220px] flex-1 border-b border-border/40 sm:min-h-[280px]">
            {selectedToken ? (
              <div className="flex h-full flex-col p-0.5 sm:p-1">
                <TerminalChart
                  ticks={ticks}
                  trades={trades}
                  period={chartPeriod}
                  onPeriodChange={setChartPeriod}
                  price={selectedToken.price_usd}
                  mcap={selectedToken.market_cap}
                  changePct={selectedToken.change_24h}
                  symbol={selectedToken.symbol}
                  tokenKey={selectedToken.id}
                  myUserId={user.id}
                />
              </div>
            ) : (
              <div className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">
                Select a token to view chart
              </div>
            )}
          </div>

          {/* Bottom panel */}
          <div className="flex h-40 shrink-0 flex-col overflow-hidden sm:h-48 lg:h-56">
            <div className="flex shrink-0 items-center gap-0 overflow-x-auto border-b border-border/40">
              {(["trades", "positions", "holders"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTradeTab(tab)}
                  className={cn(
                    "shrink-0 border-b-2 px-3 py-2 text-xs font-medium capitalize transition-colors sm:px-4",
                    tradeTab === tab
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab}
                  {tab === "holders" && selectedToken ? ` (${selectedToken.holder_count})` : ""}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto text-xs">
              {tradeTab === "trades" && (
                <table className="w-full min-w-[480px]">
                  <thead className="sticky top-0 bg-card/90 backdrop-blur-sm">
                    <tr className="text-[10px] uppercase text-muted-foreground">
                      <th className="px-2 py-1.5 text-left font-medium sm:px-3">Time</th>
                      <th className="px-2 py-1.5 text-left font-medium sm:px-3">Type</th>
                      <th className="px-2 py-1.5 text-right font-medium sm:px-3">Price</th>
                      <th className="px-2 py-1.5 text-right font-medium sm:px-3">Amount</th>
                      <th className="hidden px-2 py-1.5 text-right font-medium sm:table-cell sm:px-3">Value $</th>
                      <th className="hidden px-2 py-1.5 text-right font-medium md:table-cell md:px-3">Wallet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No trades yet</td></tr>
                    ) : (
                      trades.map((t) => (
                        <tr key={t.id} className="border-b border-border/20 hover:bg-muted/30">
                          <td className="px-2 py-1.5 tabular-nums text-muted-foreground sm:px-3">{timeAgo(t.created_at)}</td>
                          <td className={cn("px-2 py-1.5 font-semibold sm:px-3", t.side === "buy" ? "text-emerald-400" : "text-red-400")}>
                            {t.side === "buy" ? "Buy" : "Sell"}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums sm:px-3">${formatNumber(t.price, 6)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums sm:px-3">{formatNumber(t.token_amount, 2)}</td>
                          <td className="hidden px-2 py-1.5 text-right tabular-nums sm:table-cell sm:px-3">${formatNumber(t.pi_amount, 2)}</td>
                          <td className="hidden px-2 py-1.5 text-right font-mono text-muted-foreground md:table-cell md:px-3">{shortAddress(t.user_id, 4, 4)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              {tradeTab === "positions" && (
                <table className="w-full">
                  <thead className="sticky top-0 bg-card/90 backdrop-blur-sm">
                    <tr className="text-[10px] uppercase text-muted-foreground">
                      <th className="px-3 py-1.5 text-left font-medium">Token</th>
                      <th className="px-3 py-1.5 text-right font-medium">Amount</th>
                      <th className="px-3 py-1.5 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.length === 0 ? (
                      <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No positions yet</td></tr>
                    ) : (
                      positions.map((p) => (
                        <tr
                          key={p.token_id}
                          className={cn("cursor-pointer border-b border-border/20 hover:bg-muted/30", p.token_id === selectedTokenId && "bg-primary/5")}
                          onClick={() => setSelectedTokenId(p.token_id)}
                        >
                          <td className="px-3 py-1.5">
                            <span className="flex items-center gap-2">
                              {p.tokens?.logo_url ? (
                                <img src={p.tokens.logo_url} alt="" className="h-4 w-4 rounded-full" />
                              ) : null}
                              <span className="font-medium">{p.tokens?.symbol ?? "?"}</span>
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(p.balance, 4)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            ${formatNumber(p.balance * (p.tokens?.price_usd ?? 0), 2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              {tradeTab === "holders" && (
                <table className="w-full min-w-[320px]">
                  <thead className="sticky top-0 bg-card/90 backdrop-blur-sm">
                    <tr className="text-[10px] uppercase text-muted-foreground">
                      <th className="px-3 py-1.5 text-left font-medium">#</th>
                      <th className="px-3 py-1.5 text-left font-medium">Wallet</th>
                      <th className="px-3 py-1.5 text-right font-medium">Balance</th>
                      <th className="px-3 py-1.5 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holders.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No holders</td></tr>
                    ) : (
                      holders.map((h, i) => (
                        <tr key={h.wallet_id} className="border-b border-border/20 hover:bg-muted/30">
                          <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-1.5 font-mono">{shortAddress(h.wallets?.address ?? h.wallet_id, 6, 4)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(h.balance, 2)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                            {selectedToken ? formatNumber((h.balance / selectedToken.total_supply) * 100, 2) : "0"}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar - Trade panel (desktop) */}
        <aside className="hidden w-64 shrink-0 flex-col border-l border-border/50 bg-card/50 lg:flex xl:w-72">
          <TradePanel
            selectedToken={selectedToken}
            tradeSide={tradeSide}
            setTradeSide={setTradeSide}
            tradeAmount={tradeAmount}
            setTradeAmount={setTradeAmount}
            quote={quote}
            tradeAmtNum={tradeAmtNum}
            ousdBalance={ousdBalance}
            holding={holding}
            busy={busy}
            onExecute={executeTrade}
          />
        </aside>
      </div>

      {/* Mobile token picker sheet */}
      <Sheet open={tokenSheetOpen} onOpenChange={setTokenSheetOpen}>
        <SheetContent side="bottom" className="flex h-[85dvh] flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border/40 px-4 py-3 text-left">
            <SheetTitle className="text-base">Select token</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1">
            <TokenListPanel
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              sortKey={sortKey}
              handleSort={handleSort}
              tokensLoading={tokensLoading}
              sortedTokens={sortedTokens}
              selectedTokenId={selectedTokenId}
              onSelect={(id) => {
                setSelectedTokenId(id);
                setTokenSheetOpen(false);
              }}
              className="h-full"
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile trade sheet */}
      <Sheet open={tradeSheetOpen} onOpenChange={setTradeSheetOpen}>
        <SheetContent side="bottom" className="flex h-[80dvh] flex-col gap-0 p-0 sm:h-auto sm:max-h-[85dvh]">
          <SheetHeader className="border-b border-border/40 px-4 py-3 text-left">
            <SheetTitle className="text-base">
              {selectedToken ? `Trade $${selectedToken.symbol}` : "Trade"}
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <TradePanel
              selectedToken={selectedToken}
              tradeSide={tradeSide}
              setTradeSide={setTradeSide}
              tradeAmount={tradeAmount}
              setTradeAmount={setTradeAmount}
              quote={quote}
              tradeAmtNum={tradeAmtNum}
              ousdBalance={ousdBalance}
              holding={holding}
              busy={busy}
              onExecute={async () => {
                await executeTrade();
                setTradeSheetOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TokenListPanel({
  searchQuery,
  setSearchQuery,
  sortKey,
  handleSort,
  tokensLoading,
  sortedTokens,
  selectedTokenId,
  onSelect,
  className,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  sortKey: SortKey;
  handleSort: (key: SortKey) => void;
  tokensLoading: boolean;
  sortedTokens: TokenRow[];
  selectedTokenId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="border-b border-border/40 px-2 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="h-8 w-full rounded-md border-0 bg-muted/60 pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/40 sm:h-7"
          />
        </div>
      </div>
      <div className="flex items-center gap-1 border-b border-border/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <button type="button" onClick={() => handleSort("market_cap")} className={cn("flex-1 truncate text-left hover:text-foreground", sortKey === "market_cap" && "text-foreground")}>
          Token
        </button>
        <button type="button" onClick={() => handleSort("price_usd")} className={cn("w-14 text-right hover:text-foreground", sortKey === "price_usd" && "text-foreground")}>
          Price
        </button>
        <button type="button" onClick={() => handleSort("change_24h")} className={cn("w-12 text-right hover:text-foreground", sortKey === "change_24h" && "text-foreground")}>
          24h %
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {tokensLoading ? (
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-2 sm:py-1.5">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="ml-auto h-3 w-10" />
            </div>
          ))
        ) : (
          sortedTokens.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-2 text-left text-xs transition-colors sm:py-1.5",
                t.id === selectedTokenId
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {t.logo_url ? (
                <img src={t.logo_url} alt="" className="h-6 w-6 shrink-0 rounded-full sm:h-5 sm:w-5" />
              ) : (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/20 text-[8px] font-bold text-primary sm:h-5 sm:w-5">
                  {t.symbol.slice(0, 2)}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate font-medium">{t.symbol}</span>
              <span className="shrink-0 tabular-nums">${formatNumber(t.price_usd, t.price_usd < 0.01 ? 6 : 4)}</span>
              <span className={cn("w-11 shrink-0 text-right tabular-nums", t.change_24h >= 0 ? "text-emerald-400" : "text-red-400")}>
                {t.change_24h >= 0 ? "+" : ""}{formatNumber(t.change_24h, 1)}%
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function TradePanel({
  selectedToken,
  tradeSide,
  setTradeSide,
  tradeAmount,
  setTradeAmount,
  quote,
  tradeAmtNum,
  ousdBalance,
  holding,
  busy,
  onExecute,
}: {
  selectedToken: TokenRow | null;
  tradeSide: TradeSide;
  setTradeSide: (s: TradeSide) => void;
  tradeAmount: string;
  setTradeAmount: (v: string) => void;
  quote: ReturnType<typeof quoteBuy> | ReturnType<typeof quoteSell> | null;
  tradeAmtNum: number;
  ousdBalance: number;
  holding: number;
  busy: boolean;
  onExecute: () => void | Promise<void>;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b border-border/40">
        <button
          type="button"
          onClick={() => setTradeSide("buy")}
          className={cn(
            "flex-1 py-2.5 text-center text-sm font-semibold transition-colors",
            tradeSide === "buy"
              ? "border-b-2 border-emerald-400 text-emerald-400"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => setTradeSide("sell")}
          className={cn(
            "flex-1 py-2.5 text-center text-sm font-semibold transition-colors",
            tradeSide === "sell"
              ? "border-b-2 border-red-400 text-red-400"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Sell
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {selectedToken ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                {tradeSide === "buy" ? "Amount (OUSD)" : `Amount ($${selectedToken.symbol})`}
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                placeholder="0"
                className="h-11 w-full rounded-lg border border-border/60 bg-muted/40 px-3 text-sm tabular-nums outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 sm:h-10"
              />
              <div className="mt-1.5 flex gap-1.5">
                {(tradeSide === "buy" ? [10, 25, 50, 100] : [25, 50, 75, 100]).map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      if (tradeSide === "buy") {
                        setTradeAmount(String(pct));
                      } else {
                        setTradeAmount(String(Number(((holding * pct) / 100).toFixed(4))));
                      }
                    }}
                    className="flex-1 rounded-md bg-muted/60 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {tradeSide === "buy" ? `${pct}` : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {quote && tradeAmtNum > 0 && (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">You get</span>
                  <span className="font-semibold tabular-nums">
                    {tradeSide === "buy"
                      ? `${formatNumber((quote as any).tokenOut ?? 0, 4)} $${selectedToken.symbol}`
                      : `${formatNumber((quote as any).piOut ?? 0, 4)} OUSD`}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground">Fee ({OPENTOKEN_TRADE_FEE_BPS / 100}%)</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatNumber((quote.fee ?? 0), 4)} OUSD
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">OUSD Balance</span>
                <span className="tabular-nums">{formatNumber(ousdBalance, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Holdings</span>
                <span className="tabular-nums">{formatNumber(holding, 4)} ${selectedToken.symbol}</span>
              </div>
            </div>

            <Button
              type="button"
              disabled={busy || tradeAmtNum <= 0}
              onClick={() => void onExecute()}
              className={cn(
                "h-11 w-full rounded-lg text-sm font-semibold sm:h-10",
                tradeSide === "buy"
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-red-500 text-white hover:bg-red-600",
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : tradeSide === "buy" ? (
                "Buy"
              ) : (
                "Sell"
              )}
            </Button>

            <div className="space-y-2 border-t border-border/40 pt-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Token Info
              </h4>
              <div className="space-y-1.5 text-xs">
                <InfoRow label="Market Cap" value={`$${formatNumber(selectedToken.market_cap, 0, { compact: true })}`} />
                <InfoRow label="24h Volume" value={`$${formatNumber(selectedToken.volume_24h, 0, { compact: true })}`} />
                <InfoRow label="Holders" value={String(selectedToken.holder_count)} />
                <InfoRow label="Supply" value={formatNumber(selectedToken.total_supply, 0, { compact: true })} />
                <InfoRow label="Status" value={selectedToken.status} />
                <InfoRow label="Created" value={timeAgo(selectedToken.created_at)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">
            Select a token to trade
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize tabular-nums">{value}</span>
    </div>
  );
}
