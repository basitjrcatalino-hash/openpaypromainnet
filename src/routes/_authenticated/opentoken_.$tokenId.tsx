/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  CandlestickChart,
  Copy,
  ExternalLink,
  Flag,
  LineChart,
  MessageCircle,
  Share2,
  ShieldAlert,
  Star,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { copyText as copyToClipboardRobust } from "@/lib/clipboard";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatNumber,
  formatOUSD,
  formatPct,
  fetchActiveWallet,
  shortAddress,
  timeAgo,
} from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import { reportOpenToken } from "@/lib/opentoken.functions";
import { isOpenTokenGraduated, resolveGraduationTarget } from "@/lib/opentoken/bonding-curve";
import {
  discordHref,
  telegramHref,
  twitterHref,
  websiteHref,
} from "@/lib/opentoken/social";
import {
  CommentThread,
  PhantomSparkline,
  TerminalChart,
  TradePanel,
  type OtTradeRow,
  type PhantomPeriod,
  type TerminalPeriod,
} from "@/components/opentoken";
import { TokenTradeBar, TokenTradeSheet } from "@/components/opentoken/TokenTradeBar";

export const Route = createFileRoute("/_authenticated/opentoken_/$tokenId")({
  head: () => ({ meta: [{ title: "Token — OpenToken" }] }),
  component: OpenTokenDetail,
});

type ChartView = "simple" | "terminal";

function OpenTokenDetail() {
  const { tokenId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const reportFn = useServerFn(reportOpenToken);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [chartPeriod, setChartPeriod] = useState<PhantomPeriod | TerminalPeriod>("1D");
  const [chartView, setChartView] = useState<ChartView>(() => {
    try {
      return localStorage.getItem("ot-chart-view") === "terminal" ? "terminal" : "simple";
    } catch {
      return "simple";
    }
  });
  const [showBuyPanel, setShowBuyPanel] = useState(false);
  const [socialTab, setSocialTab] = useState<"live" | "comments">("live");

  const { data: token, isLoading } = useQuery({
    queryKey: ["ot-token", tokenId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("*")
        .eq("id", tokenId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () =>
      fetchActiveWallet<{ id: string; ousd_balance: number }>(supabase, user.id, "id, ousd_balance"),
  });

  const { data: holding } = useQuery({
    queryKey: ["ot-holding", tokenId, wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("token_holdings")
        .select("balance")
        .eq("token_id", tokenId)
        .eq("wallet_id", wallet!.id)
        .maybeSingle();
      return Number(data?.balance ?? 0);
    },
  });

  const { data: ticks = [] } = useQuery({
    queryKey: ["ot-ticks", tokenId, chartPeriod],
    queryFn: async () => {
      const limit =
        chartPeriod === "5M" || chartPeriod === "15M"
          ? 60
          : chartPeriod === "1H"
            ? 48
            : chartPeriod === "1D"
              ? 96
              : 180;
      const { data } = await supabase
        .from("ot_price_ticks")
        .select("created_at, price, market_cap")
        .eq("token_id", tokenId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return data ?? [];
    },
  });

  const { data: trades = [] } = useQuery({
    queryKey: ["ot-trades", tokenId],
    queryFn: async (): Promise<OtTradeRow[]> => {
      const { data } = await supabase
        .from("ot_trades")
        .select("id, side, pi_amount, token_amount, price, created_at, tx_ref, user_id")
        .eq("token_id", tokenId)
        .order("created_at", { ascending: false })
        .limit(40);
      return (data ?? []) as OtTradeRow[];
    },
  });

  const { data: creatorWallet } = useQuery({
    queryKey: ["ot-creator-wallet", token?.creator_id],
    enabled: !!token?.creator_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("address, name")
        .eq("user_id", token!.creator_id!)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: creatorProfile } = useQuery({
    queryKey: ["ot-creator-profile", token?.creator_id],
    enabled: !!token?.creator_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("id", token!.creator_id!)
        .maybeSingle();
      return data;
    },
  });

  function setView(next: ChartView) {
    setChartView(next);
    try {
      localStorage.setItem("ot-chart-view", next);
    } catch {
      /* ignore */
    }
    if (next === "terminal" && (chartPeriod === "YTD" || chartPeriod === "ALL")) {
      setChartPeriod("1D");
    }
    if (next === "simple" && (chartPeriod === "5M" || chartPeriod === "15M")) {
      setChartPeriod("1D");
    }
  }

  const { data: favorited } = useQuery({
    queryKey: ["ot-fav", tokenId, user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_favorites")
        .select("token_id")
        .eq("token_id", tokenId)
        .eq("user_id", user.id)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: commentCount } = useQuery({
    queryKey: ["ot-comment-count", tokenId],
    queryFn: async () => {
      const { count } = await supabase
        .from("ot_comments")
        .select("id", { count: "exact", head: true })
        .eq("token_id", tokenId);
      return count ?? 0;
    },
  });

  const { data: similarTokens = [] } = useQuery({
    queryKey: ["ot-similar", tokenId, token?.category],
    enabled: !!token,
    queryFn: async () => {
      let query = supabase
        .from("tokens")
        .select("id, name, symbol, logo_url, market_cap, created_at, category")
        .neq("id", tokenId)
        .order("market_cap", { ascending: false })
        .limit(6);
      if (token?.category) query = query.eq("category", token.category);
      const { data } = await query;
      return data ?? [];
    },
  });

  async function toggleFav() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      if (favorited) {
        await supabase.from("ot_favorites").delete().eq("token_id", tokenId).eq("user_id", user.id);
        await db
          .from("watchlist_items")
          .delete()
          .eq("user_id", user.id)
          .eq("asset_key", `token:${tokenId}`);
      } else {
        await supabase.from("ot_favorites").insert({ token_id: tokenId, user_id: user.id });
        await db.from("watchlist_items").upsert({
          user_id: user.id,
          asset_key: `token:${tokenId}`,
        });
      }
      await qc.invalidateQueries({ queryKey: ["ot-fav", tokenId, user.id] });
      await qc.invalidateQueries({ queryKey: ["watchlist", user.id] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function submitReport() {
    try {
      await reportFn({ data: { token_id: tokenId, reason: reason.trim() } });
      toast.success("Report submitted");
      setReportOpen(false);
      setReason("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (isLoading) {
    return (
      <div className="ot-phantom grid min-h-[50vh] place-items-center">
        <p className="text-sm text-muted-foreground">Loading token…</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="ot-phantom grid min-h-[50vh] place-items-center text-center">
        <div>
          <p className="text-sm text-muted-foreground">Token not found</p>
          <Button asChild className="mt-4 rounded-full">
            <Link to="/opentoken">Back to OpenToken</Link>
          </Button>
        </div>
      </div>
    );
  }

  const change = Number(token.change_24h ?? 0);
  const mcap = Number(token.market_cap ?? 0);
  const vol24 = Number(token.volume_24h ?? 0);
  const reserve = Number(token.curve_reserve_pi ?? 0);
  const gradTarget = resolveGraduationTarget(token.graduation_target_pi);
  const progress = Math.max(0, Math.min(100, Math.round((reserve / gradTarget) * 100)));
  const fullyGraduated = isOpenTokenGraduated(token);
  const up = change >= 0;
  const price = Number(token.price_usd ?? 0);
  const devAddress = creatorWallet?.address ?? null;
  const creatorLabel =
    creatorProfile?.username ||
    creatorProfile?.display_name ||
    (token.creator_id ? shortAddress(token.creator_id, 4, 4) : "Unknown");

  return (
    <div className="ot-phantom mx-auto max-w-7xl animate-page-in pb-32 pt-1 md:px-2 lg:pb-8">
      {/* Top bar */}
      <div className="mb-4 flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Link to="/opentoken">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-bold">{token.name}</div>
          <div className="text-[11px] text-muted-foreground">${token.symbol}</div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted press"
            onClick={() => {
              void copyToClipboardRobust(window.location.href);
              toast.success("Link copied");
            }}
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted press"
            onClick={toggleFav}
            aria-label="Favorite"
          >
            <Star className={cn("h-4 w-4", favorited && "fill-amber-400 text-amber-400")} />
          </button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted press"
            onClick={() => setReportOpen(true)}
            aria-label="Report"
          >
            <Flag className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {/* Hero */}
          <div className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 overflow-hidden rounded-full bg-muted shadow-lg">
              {token.logo_url ? (
                <img src={token.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-primary/20 text-lg font-bold text-primary">
                  {token.symbol?.slice(0, 2)}
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-xl font-bold">{token.name}</h1>
              {token.is_verified && <BadgeCheck className="h-4 w-4 text-primary" />}
            </div>
            <div className="mt-3 text-4xl font-bold tabular-nums tracking-tight">
              {formatOUSD(price, { price: true, suffix: false })}
              <span className="ml-1.5 text-base font-medium text-muted-foreground">OUSD</span>
            </div>
            <div
              className={cn(
                "mt-2 text-sm font-semibold tabular-nums",
                up ? "text-emerald-400" : "text-red-400",
              )}
            >
              {formatPct(change)} · 24h
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              {token.category && (
                <span className="rounded-full bg-primary/15 px-2.5 py-1 font-semibold text-primary">
                  {token.category}
                </span>
              )}
              <span>{timeAgo(token.created_at)}</span>
              <Link
                to="/asset/$tokenId"
                params={{ tokenId }}
                className="inline-flex items-center gap-1 font-semibold text-primary"
              >
                <Wallet className="h-3.5 w-3.5" />
                Wallet view
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <StatPill label="Market cap" value={formatOUSD(mcap, { compact: true })} />
            <StatPill label="Vol 24h" value={formatOUSD(vol24, { compact: true })} />
            <StatPill label="Holders" value={formatNumber(token.holder_count ?? 0, 0)} />
          </div>

          {/* Chart — Simple sparkline or Terminal (Phantom-style) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="text-sm font-semibold text-muted-foreground">Chart</div>
              <div className="flex rounded-xl bg-muted/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setView("simple")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold press",
                    chartView === "simple"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <LineChart className="h-3.5 w-3.5" />
                  Simple
                </button>
                <button
                  type="button"
                  onClick={() => setView("terminal")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold press",
                    chartView === "terminal"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <CandlestickChart className="h-3.5 w-3.5" />
                  Terminal
                </button>
              </div>
            </div>

            {chartView === "simple" ? (
              <>
                <div className="rounded-3xl bg-card p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[11px] text-muted-foreground">Market cap</div>
                      <div className="text-2xl font-bold tabular-nums">
                        {formatOUSD(mcap, { compact: true })}
                      </div>
                    </div>
                    <div className="min-w-28 flex-1">
                      <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                        <span>Curve</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${fullyGraduated ? 100 : progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <PhantomSparkline
                  period={chartPeriod}
                  onPeriodChange={(p) => setChartPeriod(p)}
                  ticks={ticks}
                  price={price}
                  changePct={change}
                  tokenKey={tokenId}
                  peg={String(token.symbol ?? "").toUpperCase() === "OUSD"}
                />
              </>
            ) : (
              <TerminalChart
                period={chartPeriod}
                onPeriodChange={(p) => setChartPeriod(p)}
                ticks={ticks}
                trades={trades}
                myUserId={user.id}
                price={price}
                mcap={mcap}
                changePct={change}
                symbol={token.symbol}
                tokenKey={tokenId}
                peg={String(token.symbol ?? "").toUpperCase() === "OUSD"}
              />
            )}
          </section>

          {/* About */}
          <section className="rounded-3xl bg-card p-4">
            <h3 className="mb-2 text-sm font-bold">About {token.name}</h3>
            {token.description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{token.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No description yet.</p>
            )}
            {token.contract_address && (
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs text-primary"
                onClick={() => {
                  void copyToClipboardRobust(token.contract_address!);
                  toast.success("Address copied");
                }}
              >
                {shortAddress(token.contract_address)} <Copy className="h-3 w-3" />
              </button>
            )}
          </section>

          {/* Live chat + comments — Phantom-style live overlay */}
          <section id="ot-comments-section" className="rounded-3xl bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-full bg-muted/60 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setSocialTab("live");
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold press",
                    socialTab === "live"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSocialTab("comments");
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold press",
                    socialTab === "comments"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Comments
                </button>
              </div>
              {socialTab === "comments" ? (
                <span className="text-xs text-muted-foreground">{commentCount ?? 0}</span>
              ) : (
                <span className="text-[10px] font-medium text-emerald-500">Community pump</span>
              )}
            </div>
            {socialTab === "live" ? (
              <div className="space-y-3">
                <Link
                  to="/opentoken/$tokenId/chat"
                  params={{ tokenId }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-muted/50 px-3 py-3 text-left press hover:bg-muted"
                >
                  <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-muted">
                    {token.logo_url ? (
                      <img src={token.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold">{token.symbol.slice(0, 2)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{token.name} live chat</div>
                    <div className="text-xs text-muted-foreground">
                      Dedicated chat · GIFs, memes &amp; Trade
                    </div>
                  </div>
                  <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                    Open
                  </span>
                </Link>
              </div>
            ) : (
              <CommentThread tokenId={tokenId} userId={user.id} />
            )}
          </section>
        </div>

        {/* Sidebar — desktop/tablet trade panel (replaces floating Buy bar) */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="hidden rounded-3xl bg-card p-4 lg:block">
            <TradePanel
              token={token}
              walletId={wallet?.id}
              userId={user.id}
              ousdBalance={Number(wallet?.ousd_balance ?? 0)}
              tokenBalance={holding ?? 0}
              returnPath={`/opentoken/${tokenId}`}
            />
          </div>

          <div className="rounded-3xl bg-card p-4">
            <div className="mb-3 text-sm font-bold">Token info</div>
            <div className="space-y-3 text-sm">
              <DetailRow label="Name">{token.name}</DetailRow>
              <DetailRow label="Symbol">${token.symbol}</DetailRow>
              <DetailRow label="Status">
                <span className="font-semibold capitalize">
                  {fullyGraduated ? "graduated" : token.status === "halted" ? "halted" : "curve"}
                </span>
              </DetailRow>
              <DetailRow label="Supply">
                {formatNumber(Number(token.total_supply ?? 0), 0)}
              </DetailRow>
              <DetailRow label="Decimals">{String(token.decimals ?? 9)}</DetailRow>
              <DetailRow label="Creator">
                {token.creator_id ? (
                  <Link
                    to="/opentoken/creator/$userId"
                    params={{ userId: token.creator_id }}
                    className="font-semibold text-primary"
                  >
                    @{creatorLabel.replace(/^@/, "")}
                  </Link>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow label="Dev wallet">
                {devAddress ? (
                  <button
                    type="button"
                    className="inline-flex max-w-full items-center gap-1.5 font-mono text-xs text-primary"
                    onClick={() => {
                      void copyToClipboardRobust(devAddress);
                      toast.success("Dev wallet copied");
                    }}
                  >
                    <span className="truncate">{shortAddress(devAddress, 8, 8)}</span>
                    <Copy className="h-3 w-3 shrink-0" />
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </DetailRow>
              {token.contract_address ? (
                <DetailRow label="Contract">
                  <button
                    type="button"
                    className="inline-flex max-w-full items-center gap-1.5 font-mono text-xs text-primary"
                    onClick={() => {
                      void copyToClipboardRobust(token.contract_address!);
                      toast.success("Contract copied");
                    }}
                  >
                    <span className="truncate">{shortAddress(token.contract_address, 8, 8)}</span>
                    <Copy className="h-3 w-3 shrink-0" />
                  </button>
                </DetailRow>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl bg-card p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <TrendingUp className="h-4 w-4 text-primary" />
                {fullyGraduated ? "Graduated" : "Bonding curve"}
              </div>
              <span className="font-semibold text-primary">{progress}%</span>
            </div>
            <div className="mb-2 h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${fullyGraduated ? 100 : progress}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {formatNumber(reserve, 0)} / {formatNumber(gradTarget, 0)} OUSD to OpenDEX
              {fullyGraduated ? (
                <>
                  {" · "}
                  <Link to="/swap" search={{ token: token.id }} className="font-semibold text-primary">
                    Trade on OpenDEX
                  </Link>
                </>
              ) : (
                <> · Buy & sell on OpenToken until 100,000 OUSD</>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-card p-4">
            <div className="mb-3 text-sm font-bold">Token details</div>
            <div className="space-y-3 text-sm">
              <DetailRow label="Security">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-semibold",
                    token.is_verified ? "text-emerald-400" : "text-amber-400",
                  )}
                >
                  {token.is_verified ? "Verified" : "Unverified"}
                  {!token.is_verified && <ShieldAlert className="h-3.5 w-3.5" />}
                </span>
              </DetailRow>
              <DetailRow label="Quote">OUSD</DetailRow>
              <DetailRow label="Your balance">
                {formatNumber(holding ?? 0, 4)} ${token.symbol}
              </DetailRow>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  {
                    key: "website",
                    label: "Website",
                    href: websiteHref(token.website),
                  },
                  {
                    key: "x",
                    label: "X",
                    href: twitterHref(token.twitter),
                  },
                  {
                    key: "telegram",
                    label: "Telegram",
                    href: telegramHref(token.telegram),
                  },
                  {
                    key: "discord",
                    label: "Discord",
                    href: discordHref(token.discord),
                  },
                ]
                  .filter((s) => s.href)
                  .map((s) => (
                    <a
                      key={s.key}
                      href={s.href!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-primary press"
                    >
                      {s.label} <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
              </div>
            </div>
          </div>

          {similarTokens.length > 0 && (
            <div className="rounded-3xl bg-card p-4">
              <div className="mb-3 text-sm font-bold">Similar coins</div>
              <ul className="space-y-1">
                {similarTokens.slice(0, 5).map((item: any) => (
                  <li key={item.id}>
                    <Link
                      to="/opentoken/$tokenId"
                      params={{ tokenId: item.id }}
                      className="flex items-center gap-3 rounded-2xl px-1 py-2 press hover:bg-muted/60"
                    >
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                        {item.logo_url ? (
                          <img src={item.logo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-primary/20 text-[10px] font-bold text-primary">
                            {item.symbol?.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{item.name}</div>
                        <div className="text-xs text-muted-foreground">${item.symbol}</div>
                      </div>
                      <div className="text-right text-xs font-semibold tabular-nums">
                        {formatOUSD(item.market_cap, { compact: true })}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Mobile trade bar + sheet (portaled — never floats mid-page) */}
      <TokenTradeBar
        price={price}
        change={change}
        onBuy={() => setShowBuyPanel(true)}
      />
      <TokenTradeSheet open={showBuyPanel} onClose={() => setShowBuyPanel(false)}>
        <TradePanel
          token={token}
          walletId={wallet?.id}
          userId={user.id}
          ousdBalance={Number(wallet?.ousd_balance ?? 0)}
          tokenBalance={holding ?? 0}
          onClose={() => setShowBuyPanel(false)}
          returnPath={`/opentoken/${tokenId}`}
        />
      </TokenTradeSheet>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="rounded-3xl border-border bg-card">
          <DialogHeader>
            <DialogTitle>Report token</DialogTitle>
          </DialogHeader>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you reporting this?"
            className="h-11 rounded-2xl border-0 bg-muted"
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-full bg-primary text-primary-foreground"
              disabled={reason.trim().length < 3}
              onClick={submitReport}
            >
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card px-3 py-3 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right font-medium">{children}</div>
    </div>
  );
}
