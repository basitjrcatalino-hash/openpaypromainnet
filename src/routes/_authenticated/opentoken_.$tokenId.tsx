/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  Copy,
  ExternalLink,
  Flag,
  MessageCircle,
  Share2,
  ShieldAlert,
  Star,
  TrendingUp,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

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
import { CommentThread, PriceChart, TradePanel } from "@/components/opentoken";

export const Route = createFileRoute("/_authenticated/opentoken_/$tokenId")({
  head: () => ({ meta: [{ title: "Token — OpenToken" }] }),
  component: OpenTokenDetail,
});

const CHART_PERIODS = ["LIVE", "1D", "1W", "1M", "1Y", "ALL"] as const;

function OpenTokenDetail() {
  const { tokenId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const reportFn = useServerFn(reportOpenToken);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [chartPeriod, setChartPeriod] = useState<string>("LIVE");
  const [showBuyPanel, setShowBuyPanel] = useState(false);

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
    queryKey: ["ot-ticks", tokenId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_price_ticks")
        .select("created_at, price, market_cap")
        .eq("token_id", tokenId)
        .order("created_at", { ascending: false })
        .limit(120);
      return data ?? [];
    },
  });

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
      if (favorited) {
        await supabase.from("ot_favorites").delete().eq("token_id", tokenId).eq("user_id", user.id);
      } else {
        await supabase.from("ot_favorites").insert({ token_id: tokenId, user_id: user.id });
      }
      await qc.invalidateQueries({ queryKey: ["ot-fav", tokenId, user.id] });
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
  const gradTarget = Math.max(1, Number(token.graduation_target_pi ?? 1));
  const progress = Math.max(4, Math.min(100, Math.round((reserve / gradTarget) * 100)));

  return (
    <div className="ot-phantom mx-auto max-w-7xl px-4 pb-24 pt-4 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-card/95 px-4 py-2.5 text-center text-xs text-muted-foreground">
        <span>OpenToken launchpad · bonding curve trading</span>
        <Link
          to="/asset/$tokenId"
          params={{ tokenId }}
          className="font-medium text-primary hover:underline"
        >
          Wallet view
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
                  <Link to="/opentoken">
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                </Button>
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {token.logo_url ? (
                    <img src={token.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-linear-to-br from-purple-600 to-purple-900 text-sm font-bold text-foreground">
                      {token.symbol?.slice(0, 2)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-2xl font-bold text-foreground">{token.name}</h1>
                    {token.is_verified && <BadgeCheck className="h-4 w-4 text-green-400" />}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>${token.symbol}</span>
                    {token.category && <span>{token.category}</span>}
                    <span>{timeAgo(token.created_at)}</span>
                    {token.contract_address && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => {
                          void navigator.clipboard.writeText(token.contract_address!);
                          toast.success("Address copied");
                        }}
                      >
                        {shortAddress(token.contract_address)} <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {token.description && (
                    <p className="mt-2 max-w-3xl text-sm text-foreground/80">{token.description}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl border-border bg-muted text-foreground hover:bg-muted"
                  onClick={() => {
                    void navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied");
                  }}
                >
                  <Share2 className="mr-1.5 h-4 w-4" /> Share
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl border-border bg-muted text-foreground hover:bg-muted"
                  onClick={toggleFav}
                >
                  <Star className={cn("mr-1.5 h-4 w-4", favorited && "fill-warning text-warning")} />
                  Favorite
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-muted-foreground hover:text-foreground"
                  onClick={() => setReportOpen(true)}
                >
                  <Flag className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <StatCard
              label="Market cap"
              value={formatOUSD(mcap)}
              sub={`${formatPct(change)} 24hr`}
              positive={change >= 0}
            />
            <StatCard
              label="Price"
              value={formatOUSD(token.price_usd, { price: true })}
            />
            <StatCard label="Vol 24h" value={formatOUSD(vol24, { compact: true })} />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Market cap.</div>
                <div className="text-4xl font-bold text-foreground">{formatOUSD(mcap, { compact: true })}</div>
                <div className={cn("mt-1 text-sm font-medium", change >= 0 ? "text-emerald-500" : "text-red-500")}>
                  {formatOUSD(Math.abs((token.price_usd ?? 0) * change / 100), { compact: true })} ({formatPct(change)}) 24hr
                </div>
              </div>
              <div className="w-full max-w-xs">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span />
                  <span>ATH {formatOUSD(mcap * 2.15, { compact: true })}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-linear-to-r from-emerald-400 to-lime-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <button className="hover:text-foreground">5m</button>
              <button className="hover:text-foreground">1h</button>
              <button className="hover:text-foreground">Trade Display</button>
              <button className="hover:text-foreground">Show All Bubbles</button>
              <button className="text-foreground">Price/MCap</button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <PriceChart ticks={ticks} mode="price" />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {CHART_PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setChartPeriod(p)}
                  className={cn(
                    "rounded-full px-3 py-1.5 transition-colors",
                    chartPeriod === p ? "bg-muted text-foreground" : "hover:text-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">About {token.name}</h3>
              <span className="text-xs text-muted-foreground">{timeAgo(token.created_at)}</span>
            </div>
            {token.description ? (
              <p className="border-l-2 border-emerald-400 pl-3 text-sm leading-6 text-foreground/80">{token.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No description yet.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <MiniMetric label="Vol 24h" value={formatOUSD(vol24, { compact: true })} />
            <MiniMetric label="Price" value={formatOUSD(token.price_usd, { price: true })} />
            <MiniMetric label="5m" value={formatPct(change / 12)} negative={change < 0} />
            <MiniMetric label="1h" value={formatPct(change / 6)} negative={change < 0} />
            <MiniMetric
              label="6h"
              value={formatPct(change / 2)}
              positive={change >= 0}
              negative={change < 0}
            />
          </div>

          <div id="ot-comments-section" className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-base font-semibold text-foreground">Comments</h3>
              </div>
              <span className="text-xs text-muted-foreground">{commentCount ?? 0} messages</span>
            </div>
            <CommentThread tokenId={tokenId} userId={user.id} />
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="hidden rounded-2xl border border-border bg-card p-3 xl:block">
            <TradePanel
              token={token}
              walletId={wallet?.id}
              userId={user.id}
              ousdBalance={Number(wallet?.ousd_balance ?? 0)}
              tokenBalance={holding ?? 0}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-foreground">
                <TrendingUp className="h-4 w-4 text-orange-400" />
                <span>
                  {token.status === "graduated" ? "Graduated to OpenDEX" : "Bonding curve → OpenDEX"}
                </span>
              </div>
              <span className="text-orange-300">{progress}%</span>
            </div>
            <div className="mb-2 h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-orange-400 transition-all"
                style={{ width: `${token.status === "graduated" ? 100 : progress}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {formatNumber(reserve, 2)} / {formatNumber(gradTarget, 2)} OUSD to OpenDEX
              {token.status === "graduated" ? (
                <>
                  {" · "}
                  <Link to="/swap" search={{ token: token.id }} className="text-primary hover:underline">
                    Trade on OpenDEX
                  </Link>
                </>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Volume2 className="h-4 w-4 text-emerald-400" />
              Voice chat
            </div>
            <div className="text-xs text-muted-foreground">Talk live with other {token.name} holders</div>
            <Button className="mt-4 w-full rounded-xl bg-muted text-foreground hover:bg-muted">
              Join voice chat
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Similar coins</div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {similarTokens.length}+
              </span>
            </div>
            <div className="space-y-3">
              {similarTokens.slice(0, 5).map((item: any) => (
                <Link
                  key={item.id}
                  to="/opentoken/$tokenId"
                  params={{ tokenId: item.id }}
                  className="flex items-center gap-3 rounded-xl px-1 py-1.5 transition hover:bg-muted"
                >
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                    {item.logo_url ? (
                      <img src={item.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-linear-to-br from-purple-600 to-purple-900 text-[10px] font-bold text-foreground">
                        {item.symbol?.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{item.name}</div>
                    <div className="text-xs text-muted-foreground">${item.symbol}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-foreground">{formatOUSD(item.market_cap, { compact: true })}</div>
                    <div className="text-muted-foreground">{timeAgo(item.created_at)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 text-sm font-semibold text-foreground">Token details</div>
            <div className="space-y-3 text-sm">
              <DetailRow label="Security">
                <div className="flex items-center gap-1.5">
                  <span className={token.is_verified ? "text-green-400" : "text-yellow-400"}>
                    {token.is_verified ? "Verified" : "Unverified"}
                  </span>
                  {!token.is_verified && <ShieldAlert className="h-3.5 w-3.5 text-yellow-400" />}
                </div>
              </DetailRow>
              <DetailRow label="24h Volume">{formatOUSD(vol24, { compact: true })}</DetailRow>
              <DetailRow label="Market cap">{formatOUSD(mcap, { compact: true })}</DetailRow>
              <DetailRow label="Holders">{formatNumber(token.holder_count ?? 0, 0)}</DetailRow>
              <DetailRow label="Quote">OUSD</DetailRow>
              {token.contract_address && (
                <DetailRow label="Contract address">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                    onClick={() => {
                      void navigator.clipboard.writeText(token.contract_address!);
                      toast.success("Address copied");
                    }}
                  >
                    {shortAddress(token.contract_address)}
                    <Copy className="h-3 w-3" />
                  </button>
                </DetailRow>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                {token.website && (
                  <a
                    href={token.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent"
                  >
                    Website <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {token.twitter && (
                  <span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                    X · {token.twitter}
                  </span>
                )}
                {token.telegram && (
                  <span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                    TG · {token.telegram}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-14 z-50 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-xl xl:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">{formatOUSD(mcap, { compact: true })} market cap</div>
          <Button
            className="rounded-full bg-primary px-8 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90"
            onClick={() => setShowBuyPanel((v) => !v)}
          >
            Buy
          </Button>
        </div>
      </div>

      {showBuyPanel && (
        <div className="fixed inset-0 z-60 flex flex-col justify-end xl:hidden">
          <div className="absolute inset-0 bg-background/60" onClick={() => setShowBuyPanel(false)} />
          <div className="relative z-10 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-card px-4 pb-8 pt-4 md:mx-auto md:max-w-2xl">
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted-foreground/40" />
            <TradePanel
              token={token}
              walletId={wallet?.id}
              userId={user.id}
              ousdBalance={Number(wallet?.ousd_balance ?? 0)}
              tokenBalance={holding ?? 0}
              onClose={() => setShowBuyPanel(false)}
            />
          </div>
        </div>
      )}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="rounded-3xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Report token</DialogTitle>
          </DialogHeader>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you reporting this?"
            className="rounded-xl border-border bg-muted text-foreground"
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full border-border text-foreground/80"
              onClick={() => setReportOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full"
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

function StatCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
      {sub ? (
        <div className={cn("mt-1 text-xs", positive ? "text-green-400" : "text-muted-foreground")}>{sub}</div>
      ) : null}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-sm font-semibold",
          positive ? "text-green-400" : negative ? "text-red-400" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right text-foreground">{children}</div>
    </div>
  );
}
