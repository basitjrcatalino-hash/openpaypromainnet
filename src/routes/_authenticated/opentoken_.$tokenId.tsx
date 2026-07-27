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
  formatPct,
  formatUSD,
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
      fetchActiveWallet<{ id: string; pi_balance: number }>(supabase, user.id, "id, pi_balance"),
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
      <div className="ot-phantom grid min-h-screen place-items-center">
        <p className="text-sm text-zinc-500">Loading token…</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="ot-phantom grid min-h-screen place-items-center text-center">
        <div>
          <p className="text-sm text-zinc-500">Token not found</p>
          <Button asChild className="mt-4 rounded-full bg-purple-600 text-white">
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
    <div className="ot-phantom mx-auto min-h-screen max-w-7xl px-4 pb-24 pt-4 md:px-6">
      <div className="mb-4 rounded-2xl border border-zinc-900 bg-zinc-950/95 px-4 py-2.5 text-center text-xs text-zinc-400">
        Trade faster. Pump is better on mobile.
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-400 hover:text-white">
                  <Link to="/opentoken">
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                </Button>
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                  {token.logo_url ? (
                    <img src={token.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-linear-to-br from-purple-600 to-purple-900 text-sm font-bold text-white">
                      {token.symbol?.slice(0, 2)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-2xl font-bold text-white">{token.name}</h1>
                    {token.is_verified && <BadgeCheck className="h-4 w-4 text-green-400" />}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <span>${token.symbol}</span>
                    {token.category && <span>{token.category}</span>}
                    <span>{timeAgo(token.created_at)}</span>
                    {token.contract_address && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-white"
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
                    <p className="mt-2 max-w-3xl text-sm text-zinc-300">{token.description}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                  onClick={() => {
                    void navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied");
                  }}
                >
                  <Share2 className="mr-1.5 h-4 w-4" /> Share
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                  onClick={toggleFav}
                >
                  <Star className={cn("mr-1.5 h-4 w-4", favorited && "fill-warning text-warning")} />
                  Favorite
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-zinc-400 hover:text-white"
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
              value={formatUSD(mcap)}
              sub={`${formatPct(change)} 24hr`}
              positive={change >= 0}
            />
            <StatCard
              label="Price"
              value={`${formatNumber(token.price_usd, token.price_usd < 0.01 ? 8 : 4)} π`}
            />
            <StatCard label="Vol 24h" value={formatUSD(vol24)} />
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-zinc-500">Market cap.</div>
                <div className="text-4xl font-bold text-white">{formatUSD(mcap, { compact: true })}</div>
                <div className={cn("mt-1 text-sm font-medium", change >= 0 ? "text-green-400" : "text-red-400")}>
                  {formatUSD(Math.abs((token.price_usd ?? 0) * change / 100), { compact: true })} ({formatPct(change)}) 24hr
                </div>
              </div>
              <div className="w-full max-w-xs">
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                  <span />
                  <span>ATH {formatUSD(mcap * 2.15, { compact: true })}</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-linear-to-r from-emerald-400 to-lime-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
              <button className="hover:text-white">5m</button>
              <button className="hover:text-white">1h</button>
              <button className="hover:text-white">Trade Display</button>
              <button className="hover:text-white">Show All Bubbles</button>
              <button className="text-white">Price/MCap</button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/40">
              <PriceChart ticks={ticks} mode="price" />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              {CHART_PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setChartPeriod(p)}
                  className={cn(
                    "rounded-full px-3 py-1.5 transition-colors",
                    chartPeriod === p ? "bg-zinc-800 text-white" : "hover:text-white",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">About {token.name}</h3>
              <span className="text-xs text-zinc-500">{timeAgo(token.created_at)}</span>
            </div>
            {token.description ? (
              <p className="border-l-2 border-emerald-400 pl-3 text-sm leading-6 text-zinc-300">{token.description}</p>
            ) : (
              <p className="text-sm text-zinc-500">No description yet.</p>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-5">
            <MiniMetric label="Vol 24h" value={formatUSD(vol24, { compact: true })} />
            <MiniMetric label="Price" value={formatNumber(token.price_usd, 8)} />
            <MiniMetric label="5m" value={formatPct(change / 12)} negative={change < 0} />
            <MiniMetric label="1h" value={formatPct(change / 6)} negative={change < 0} />
            <MiniMetric
              label="6h"
              value={formatPct(change / 2)}
              positive={change >= 0}
              negative={change < 0}
            />
          </div>

          <div id="ot-comments-section" className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-zinc-400" />
                <h3 className="text-base font-semibold text-white">Comments</h3>
              </div>
              <span className="text-xs text-zinc-500">{commentCount ?? 0} messages</span>
            </div>
            <CommentThread tokenId={tokenId} userId={user.id} />
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-3">
            <TradePanel
              token={token}
              walletId={wallet?.id}
              piBalance={Number(wallet?.pi_balance ?? 0)}
              tokenBalance={holding ?? 0}
            />
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-zinc-200">
                <TrendingUp className="h-4 w-4 text-orange-400" />
                <span>Graduated to PumpSwap</span>
              </div>
              <span className="text-orange-300">100%</span>
            </div>
            <div className="mb-2 h-2 rounded-full bg-zinc-800">
              <div className="h-full w-full rounded-full bg-orange-400" />
            </div>
            <div className="text-xs text-zinc-500">
              {formatNumber(reserve, 2)} / {formatNumber(gradTarget, 2)} burned. How it works
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
              <Volume2 className="h-4 w-4 text-emerald-400" />
              Voice chat
            </div>
            <div className="text-xs text-zinc-500">Talk live with other {token.name} holders</div>
            <Button className="mt-4 w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">
              Join voice chat
            </Button>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Similar coins</div>
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">
                {similarTokens.length}+
              </span>
            </div>
            <div className="space-y-3">
              {similarTokens.slice(0, 5).map((item: any) => (
                <Link
                  key={item.id}
                  to="/opentoken/$tokenId"
                  params={{ tokenId: item.id }}
                  className="flex items-center gap-3 rounded-xl px-1 py-1.5 transition hover:bg-zinc-900"
                >
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-800">
                    {item.logo_url ? (
                      <img src={item.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-linear-to-br from-purple-600 to-purple-900 text-[10px] font-bold text-white">
                        {item.symbol?.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{item.name}</div>
                    <div className="text-xs text-zinc-500">${item.symbol}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-white">{formatUSD(item.market_cap, { compact: true })}</div>
                    <div className="text-zinc-500">{timeAgo(item.created_at)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
            <div className="mb-3 text-sm font-semibold text-white">Token details</div>
            <div className="space-y-3 text-sm">
              <DetailRow label="Security">
                <div className="flex items-center gap-1.5">
                  <span className={token.is_verified ? "text-green-400" : "text-yellow-400"}>
                    {token.is_verified ? "Verified" : "Unverified"}
                  </span>
                  {!token.is_verified && <ShieldAlert className="h-3.5 w-3.5 text-yellow-400" />}
                </div>
              </DetailRow>
              <DetailRow label="24h Volume">{formatUSD(vol24, { compact: true })}</DetailRow>
              <DetailRow label="Market cap">{formatUSD(mcap, { compact: true })}</DetailRow>
              <DetailRow label="Holders">{formatNumber(token.holder_count ?? 0, 0)}</DetailRow>
              <DetailRow label="Network">Pi Network</DetailRow>
              {token.contract_address && (
                <DetailRow label="Contract address">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-mono text-xs text-purple-400 hover:text-purple-300"
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
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1.5 text-xs text-purple-400 hover:bg-zinc-800"
                  >
                    Website <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {token.twitter && (
                  <span className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400">
                    X · {token.twitter}
                  </span>
                )}
                {token.telegram && (
                  <span className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400">
                    TG · {token.telegram}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-14 z-50 border-t border-zinc-900 bg-black/95 px-4 py-3 backdrop-blur-xl xl:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-zinc-500">{formatUSD(mcap, { compact: true })} market cap</div>
          <Button
            className="rounded-full bg-purple-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 hover:bg-purple-500"
            onClick={() => setShowBuyPanel((v) => !v)}
          >
            Buy
          </Button>
        </div>
      </div>

      {showBuyPanel && (
        <div className="fixed inset-0 z-60 flex flex-col justify-end xl:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowBuyPanel(false)} />
          <div className="relative z-10 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-zinc-950 px-4 pb-8 pt-4 md:mx-auto md:max-w-2xl">
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-zinc-700" />
            <TradePanel
              token={token}
              walletId={wallet?.id}
              piBalance={Number(wallet?.pi_balance ?? 0)}
              tokenBalance={holding ?? 0}
              onClose={() => setShowBuyPanel(false)}
            />
          </div>
        </div>
      )}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="rounded-3xl border-zinc-800 bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-white">Report token</DialogTitle>
          </DialogHeader>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you reporting this?"
            className="rounded-xl border-zinc-800 bg-zinc-900 text-white"
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full border-zinc-700 text-zinc-300"
              onClick={() => setReportOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full bg-purple-600 text-white"
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
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {sub ? (
        <div className={cn("mt-1 text-xs", positive ? "text-green-400" : "text-zinc-500")}>{sub}</div>
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
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-3 text-center">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div
        className={cn(
          "mt-1 text-sm font-semibold",
          positive ? "text-green-400" : negative ? "text-red-400" : "text-white",
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
      <span className="text-zinc-400">{label}</span>
      <div className="text-right text-white">{children}</div>
    </div>
  );
}
