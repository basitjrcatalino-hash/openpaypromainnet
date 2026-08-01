/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, EyeOff, Star, BadgeCheck, Shield, Flame, BarChart3 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  adminReviewReport,
  adminUpdateOpenToken,
  getOpenTokenAdminOverview,
} from "@/lib/opentoken.functions";
import { formatNumber } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/opentoken_/admin")({
  head: () => ({ meta: [{ title: "Admin — OpenToken" }] }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/authpi" });
    const [{ data: isAdmin }, { data: isMod }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userData.user.id, _role: "moderator" }),
    ]);
    if (!isAdmin && !isMod) throw redirect({ to: "/opentoken" });
  },
  component: OpenTokenAdmin,
});

function OpenTokenAdmin() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getOpenTokenAdminOverview);
  const updateFn = useServerFn(adminUpdateOpenToken);
  const reviewFn = useServerFn(adminReviewReport);

  const { data: overview, isLoading } = useQuery({
    queryKey: ["ot-admin"],
    queryFn: () => overviewFn(),
  });

  const { data: tokens = [] } = useQuery({
    queryKey: ["ot-admin-tokens"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tokens")
        .select(
          "id, name, symbol, is_featured, is_trending, is_top_volume, is_hidden, is_verified, status, report_count, volume_24h, market_cap",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  async function patchToken(
    tokenId: string,
    patch: {
      is_featured?: boolean;
      is_trending?: boolean;
      is_top_volume?: boolean;
      is_hidden?: boolean;
      is_verified?: boolean;
      status?: "curve" | "graduated" | "halted";
    },
  ) {
    try {
      await updateFn({ data: { token_id: tokenId, ...patch } });
      toast.success("Updated");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ot-admin-tokens"] }),
        qc.invalidateQueries({ queryKey: ["ot-tokens"] }),
        qc.invalidateQueries({ queryKey: ["ot-admin"] }),
      ]);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function review(reportId: string, status: "dismissed" | "actioned", hide?: boolean) {
    try {
      await reviewFn({ data: { report_id: reportId, status, hide_token: hide } });
      toast.success("Report reviewed");
      await qc.invalidateQueries({ queryKey: ["ot-admin"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (isLoading || !overview) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading admin…</div>;
  }
  if (!overview.isStaff) {
    return <div className="p-10 text-center text-sm">Not authorized</div>;
  }

  return (
    <div className="animate-page-in space-y-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link to="/opentoken">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Shield className="h-6 w-6 text-primary" /> OpenToken Admin
          </h1>
          <p className="text-sm text-muted-foreground">
            Control Featured, Trending, Top Volume · moderate reports
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl border-border/60 p-4">
          <div className="text-xs text-muted-foreground">Tokens</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatNumber(overview.tokens, 0)}
          </div>
        </Card>
        <Card className="rounded-2xl border-border/60 p-4">
          <div className="text-xs text-muted-foreground">Trades</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatNumber(overview.trades, 0)}
          </div>
        </Card>
        <Card className="rounded-2xl border-border/60 p-4">
          <div className="text-xs text-muted-foreground">Open reports</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatNumber(overview.open_reports, 0)}
          </div>
        </Card>
      </div>

      <Card className="rounded-3xl border-border/60 p-4">
        <h2 className="text-sm font-semibold">Open reports</h2>
        {(overview.reports as any[])?.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No open reports</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/50">
            {(overview.reports as any[]).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {(r.tokens as any)?.name || "Token"}{" "}
                    <span className="text-muted-foreground">${(r.tokens as any)?.symbol}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.reason}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => review(r.id, "dismissed")}
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-full"
                    onClick={() => review(r.id, "actioned", true)}
                  >
                    Hide token
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden rounded-3xl border-border/60">
        <div className="border-b border-border/60 px-4 py-3">
          <div className="text-sm font-semibold">Manage tokens</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Featured · Trending · Top Volume pin tokens to Trade / Tokens lists
          </p>
        </div>
        <ul className="divide-y divide-border/50">
          {tokens.map((t: any) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <Link
                to="/opentoken/$tokenId"
                params={{ tokenId: t.id }}
                className="min-w-0 hover:text-primary"
              >
                <div className="text-sm font-semibold">
                  {t.name} <span className="text-muted-foreground">${t.symbol}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.status} · vol {formatNumber(t.volume_24h ?? 0, 0)}
                  {" · "}reports {t.report_count ?? 0}
                  {t.is_featured ? " · featured" : ""}
                  {t.is_trending ? " · trending" : ""}
                  {t.is_top_volume ? " · top vol" : ""}
                  {t.is_hidden ? " · hidden" : ""}
                </div>
              </Link>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant={t.is_featured ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => patchToken(t.id, { is_featured: !t.is_featured })}
                >
                  <Star className="mr-1 h-3.5 w-3.5" />
                  Featured
                </Button>
                <Button
                  size="sm"
                  variant={t.is_trending ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => patchToken(t.id, { is_trending: !t.is_trending })}
                >
                  <Flame className="mr-1 h-3.5 w-3.5" />
                  Trending
                </Button>
                <Button
                  size="sm"
                  variant={t.is_top_volume ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => patchToken(t.id, { is_top_volume: !t.is_top_volume })}
                >
                  <BarChart3 className="mr-1 h-3.5 w-3.5" />
                  Top Vol
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => patchToken(t.id, { is_verified: !t.is_verified })}
                >
                  <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                  {t.is_verified ? "Unverify" : "Verify"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => patchToken(t.id, { is_hidden: !t.is_hidden })}
                >
                  <EyeOff className="mr-1 h-3.5 w-3.5" />
                  {t.is_hidden ? "Unhide" : "Hide"}
                </Button>
                {t.status === "curve" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => patchToken(t.id, { status: "halted" })}
                  >
                    Halt
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
