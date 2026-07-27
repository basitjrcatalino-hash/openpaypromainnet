import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  Copy,
  Flag,
  Share2,
  Star,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber, formatPct, formatUSD, fetchActiveWallet, shortAddress, timeAgo } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import { reportOpenToken } from "@/lib/opentoken.functions";
import {
  CommentThread,
  CurveProgress,
  GraduationBadge,
  PriceChart,
  TokenStats,
  TradePanel,
  TradesTable,
} from "@/components/opentoken";

export const Route = createFileRoute("/_authenticated/opentoken/$tokenId")({
  head: () => ({ meta: [{ title: "Token — OpenToken" }] }),
  component: OpenTokenDetail,
});

function OpenTokenDetail() {
  const { tokenId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const reportFn = useServerFn(reportOpenToken);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [chartMode, setChartMode] = useState<"price" | "mcap">("price");

  const { data: token, isLoading } = useQuery({
    queryKey: ["ot-token", tokenId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tokens").select("*").eq("id", tokenId).maybeSingle();
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

  const { data: trades = [] } = useQuery({
    queryKey: ["ot-trades", tokenId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_trades")
        .select("id, side, pi_amount, token_amount, price, created_at, tx_ref, user_id")
        .eq("token_id", tokenId)
        .order("created_at", { ascending: false })
        .limit(40);
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const profiles: Record<string, any> = {};
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", ids);
        for (const p of ps ?? []) profiles[p.id] = p;
      }
      return rows.map((r) => ({ ...r, profiles: profiles[r.user_id] }));
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

  const { data: creator } = useQuery({
    queryKey: ["ot-creator", token?.creator_id],
    enabled: !!token?.creator_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("id", token!.creator_id!)
        .maybeSingle();
      return data;
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
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading token…</div>;
  }
  if (!token) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted-foreground">Token not found</p>
        <Button asChild className="mt-4 rounded-full">
          <Link to="/opentoken">Back to OpenToken</Link>
        </Button>
      </div>
    );
  }

  const change = Number(token.change_24h ?? 0);

  return (
    <div className="animate-page-in space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link to="/opentoken">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-gradient-primary text-sm font-bold text-primary-foreground">
            {token.logo_url ? (
              <img src={token.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              token.symbol.slice(0, 3)
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold md:text-2xl">{token.name}</h1>
              {token.is_verified && <BadgeCheck className="h-5 w-5 text-primary" />}
              {token.status === "graduated" && <GraduationBadge />}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>${token.symbol}</span>
              {token.category && <span>· {token.category}</span>}
              {token.contract_address && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-mono text-xs hover:text-foreground"
                  onClick={() => {
                    void navigator.clipboard.writeText(token.contract_address!);
                    toast.success("Address copied");
                  }}
                >
                  {shortAddress(token.contract_address)} <Copy className="h-3 w-3" />
                </button>
              )}
              <span>· {timeAgo(token.created_at)}</span>
            </div>
            {token.description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{token.description}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {token.website && (
                <a href={token.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Website
                </a>
              )}
              {token.twitter && <span className="text-muted-foreground">X · {token.twitter}</span>}
              {token.telegram && <span className="text-muted-foreground">TG · {token.telegram}</span>}
              {creator && (
                <Link
                  to="/opentoken/creator/$userId"
                  params={{ userId: creator.id }}
                  className="text-primary hover:underline"
                >
                  by {creator.username || creator.display_name || "creator"}
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="rounded-full" onClick={toggleFav}>
            <Star className={cn("h-4 w-4", favorited && "fill-warning text-warning")} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied");
            }}
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => setReportOpen(true)}>
            <Flag className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Market cap"
          value={formatUSD(token.market_cap, { compact: true })}
          sub={
            <span className={change >= 0 ? "text-success" : "text-destructive"}>{formatPct(change)}</span>
          }
        />
        <StatCard label="Price" value={`${formatNumber(token.price_usd, 8)} π`} />
        <StatCard label="Vol 24h" value={formatUSD(token.volume_24h, { compact: true })} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Chart</div>
            <div className="flex gap-1 rounded-full border border-border/60 p-0.5 text-xs">
              <button
                type="button"
                className={cn("rounded-full px-2.5 py-1", chartMode === "price" && "bg-primary text-primary-foreground")}
                onClick={() => setChartMode("price")}
              >
                Price
              </button>
              <button
                type="button"
                className={cn("rounded-full px-2.5 py-1", chartMode === "mcap" && "bg-primary text-primary-foreground")}
                onClick={() => setChartMode("mcap")}
              >
                MCap
              </button>
            </div>
          </div>
          <PriceChart ticks={ticks} mode={chartMode} />
          <CurveProgress token={token} />
          <TokenStats token={token} />

          <Card className="rounded-3xl border-border/60 p-4">
            <Tabs defaultValue="trades">
              <TabsList className="rounded-full">
                <TabsTrigger value="trades" className="rounded-full">Trades</TabsTrigger>
                <TabsTrigger value="comments" className="rounded-full">Comments</TabsTrigger>
                <TabsTrigger value="info" className="rounded-full">Info</TabsTrigger>
              </TabsList>
              <TabsContent value="trades" className="mt-3">
                <TradesTable trades={trades as any} symbol={token.symbol} />
              </TabsContent>
              <TabsContent value="comments" className="mt-3">
                <CommentThread tokenId={tokenId} userId={user.id} />
              </TabsContent>
              <TabsContent value="info" className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>Fair launch on OpenToken bonding curve. No team or VC allocation.</p>
                <p>
                  Burnable: {token.burnable ? "yes" : "no"} · Mintable: {token.mintable ? "yes" : "no"} ·
                  Decimals: {token.decimals}
                </p>
                {token.contract_address && (
                  <a
                    href={`https://openledger.app/tx/${token.contract_address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary"
                  >
                    View on OpenLedger <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <TradePanel
            token={token}
            walletId={wallet?.id}
            piBalance={Number(wallet?.pi_balance ?? 0)}
            tokenBalance={holding ?? 0}
          />
        </div>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Report token</DialogTitle>
          </DialogHeader>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you reporting this?"
            className="rounded-xl"
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-full" disabled={reason.trim().length < 3} onClick={submitReport}>
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
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border/60 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs">{sub}</div>}
    </Card>
  );
}
