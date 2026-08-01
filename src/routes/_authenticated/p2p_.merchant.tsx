import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MerchantBadge, MerchantTierLabel } from "@/components/p2p/MerchantBadge";
import { P2pMenuCard, P2pSubpageHeader } from "@/components/p2p/P2pSubpage";
import { supabase } from "@/integrations/supabase/client";
import {
  applyMerchant,
  cancelMerchantApplication,
  fetchMyMerchant,
  fetchMyMerchantApplication,
  fetchMyPaymentAccounts,
  fetchTraderStats,
  formatAvgPayTime,
  merchantCanList,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/merchant")({
  head: () => ({
    meta: [
      { title: "Merchant program — OpenPay Pro P2P" },
      {
        name: "description",
        content:
          "Apply to list P2P ads. Admin approval required — Verified and Super Merchant badges like OKX / Binance.",
      },
      { property: "og:title", content: "Merchant program — OpenPay Pro P2P" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MerchantPage,
});

function MerchantPage() {
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const merchantQ = useQuery({
    queryKey: ["p2p-my-merchant", userQ.data],
    enabled: !!userQ.data,
    queryFn: fetchMyMerchant,
  });
  const appQ = useQuery({
    queryKey: ["p2p-my-merchant-app", userQ.data],
    enabled: !!userQ.data,
    queryFn: fetchMyMerchantApplication,
  });
  const statsQ = useQuery({
    queryKey: ["p2p-stats-self", userQ.data],
    enabled: !!userQ.data,
    queryFn: async () => {
      const map = await fetchTraderStats([userQ.data as string]);
      return map[userQ.data as string];
    },
  });
  const accountsQ = useQuery({
    queryKey: ["p2p-payment-accounts", userQ.data],
    enabled: !!userQ.data,
    queryFn: () => fetchMyPaymentAccounts(userQ.data as string),
  });

  const completed = stNum(statsQ.data?.completed_count);
  const rate = statsQ.data?.completion_rate == null ? 0 : Number(statsQ.data.completion_rate);
  const avgPay = statsQ.data?.avg_pay_seconds;
  const accounts = (accountsQ.data ?? []).filter((a) => a.is_active).length;
  const merchant = merchantQ.data;
  const canList = merchantCanList(merchant);
  const pending = appQ.data?.status === "pending" ? appQ.data : null;

  const verifiedChecks = [
    {
      ok: accounts >= 1,
      label: "Add 1+ receive payment method",
      detail: `${accounts} active`,
      to: "/p2p/payments" as const,
    },
    {
      ok: true,
      label: "Admin review",
      detail: "Required before your ads appear",
      to: "/p2p/support" as const,
    },
  ];

  const superChecks = [
    {
      ok: completed >= 10,
      label: "Complete 10+ trades",
      detail: `${completed} / 10`,
      to: "/p2p" as const,
    },
    {
      ok: completed > 0 && rate >= 95,
      label: "Keep ≥ 95% completion",
      detail: completed === 0 ? "No trades yet" : `${rate.toFixed(1)}%`,
      to: "/p2p/reviews" as const,
    },
    {
      ok: accounts >= 2,
      label: "Add 2+ receive methods",
      detail: `${accounts} active`,
      to: "/p2p/payments" as const,
    },
    {
      ok: avgPay == null || avgPay <= 15 * 60,
      label: "Respond / pay within 15 min avg",
      detail: formatAvgPayTime(avgPay),
      to: "/p2p/orders" as const,
    },
  ];

  const verifiedReady = accounts >= 1;
  const superReady = superChecks.every((c) => c.ok) && canList;

  const apply = useMutation({
    mutationFn: (tier: "verified" | "super") => applyMerchant(tier, note.trim() || undefined),
    onSuccess: (_d, tier) => {
      toast.success(
        tier === "super"
          ? "Super Merchant application submitted — awaiting admin"
          : "Merchant application submitted — awaiting admin",
      );
      setNote("");
      void qc.invalidateQueries({ queryKey: ["p2p-my-merchant-app"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => cancelMerchantApplication(pending!.id),
    onSuccess: () => {
      toast.success("Application cancelled");
      void qc.invalidateQueries({ queryKey: ["p2p-my-merchant-app"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <P2pSubpageHeader title="Merchant program" />

      <div className="mx-4 mt-4 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-transparent p-5 md:mx-6">
        <p className="inline-flex items-center gap-1.5 text-sm font-extrabold text-amber-400">
          <Sparkles className="h-4 w-4" /> List ads like OKX / Binance P2P
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Apply as a merchant, wait for admin approval, then publish buy/sell ads. Verified and Super
          badges appear on the marketplace; Featured merchants float to the top.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold">{MerchantTierLabel(merchant?.tier ?? "none")}</p>
          {merchant && merchant.tier !== "none" ? (
            <MerchantBadge
              merchant={{
                user_id: merchant.user_id,
                tier: merchant.tier,
                is_featured: merchant.is_featured,
                featured_until: merchant.featured_until,
                badge_label: merchant.badge_label,
              }}
              size="md"
            />
          ) : null}
        </div>
        {!canList ? (
          <p className="mt-2 text-xs font-semibold text-amber-500">
            You cannot publish ads until an admin approves your application.
          </p>
        ) : (
          <p className="mt-2 text-xs font-semibold text-[#11C66D]">
            Approved — you can publish and activate ads.
          </p>
        )}
      </div>

      {pending ? (
        <div className="mx-4 mt-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 md:mx-6">
          <p className="text-sm font-bold text-sky-400">
            Pending {pending.requested_tier === "super" ? "Super Merchant" : "Verified Merchant"}{" "}
            review
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted {new Date(pending.created_at).toLocaleString()}. An admin will approve or reject
            this request.
          </p>
          <Button
            variant="outline"
            className="mt-3 h-9 rounded-[8px] text-xs font-bold"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            Cancel application
          </Button>
        </div>
      ) : null}

      {appQ.data?.status === "rejected" ? (
        <div className="mx-4 mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 md:mx-6">
          <p className="text-sm font-bold text-rose-400">Last application rejected</p>
          {appQ.data.admin_note ? (
            <p className="mt-1 text-xs text-muted-foreground">{appQ.data.admin_note}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">You can fix issues and apply again.</p>
          )}
        </div>
      ) : null}

      <h2 className="mx-4 mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground md:mx-6">
        1. Verified Merchant (required to list)
      </h2>
      <P2pMenuCard className="mb-3">
        {verifiedChecks.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="flex items-center gap-3 border-b border-border/40 px-4 py-3.5 last:border-b-0 hover:bg-muted/30"
          >
            <CheckCircle ok={c.ok} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{c.label}</span>
              <span className="text-[12px] text-muted-foreground">{c.detail}</span>
            </span>
          </Link>
        ))}
      </P2pMenuCard>

      <h2 className="mx-4 mt-4 mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground md:mx-6">
        2. Super Merchant (badge + ranking boost)
      </h2>
      <P2pMenuCard className="mb-4">
        {superChecks.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="flex items-center gap-3 border-b border-border/40 px-4 py-3.5 last:border-b-0 hover:bg-muted/30"
          >
            <CheckCircle ok={c.ok} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{c.label}</span>
              <span className="text-[12px] text-muted-foreground">{c.detail}</span>
            </span>
          </Link>
        ))}
      </P2pMenuCard>

      <div className="mx-4 mb-3 space-y-1.5 md:mx-6">
        <label className="text-xs font-semibold text-muted-foreground">Note to admin (optional)</label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Trading experience, regions, payment rails…"
          className="min-h-[72px] rounded-xl"
          maxLength={500}
        />
      </div>

      <div className="mx-4 mb-8 space-y-2 md:mx-6">
        {!canList ? (
          <Button
            className="h-11 w-full rounded-[8px] bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]"
            disabled={!verifiedReady || !!pending || apply.isPending}
            onClick={() => apply.mutate("verified")}
          >
            {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply as Verified Merchant"}
          </Button>
        ) : merchant?.tier !== "super" ? (
          <Button
            className="h-11 w-full rounded-[8px] bg-amber-500 font-bold text-white hover:bg-amber-500/90"
            disabled={!superReady || !!pending || apply.isPending}
            onClick={() => apply.mutate("super")}
          >
            {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply for Super Merchant"}
          </Button>
        ) : null}

        <Button
          asChild
          variant={canList ? "default" : "outline"}
          className={cn(
            "h-11 w-full rounded-[8px] font-bold",
            canList && "bg-foreground text-background hover:bg-foreground/90",
          )}
        >
          <Link to="/p2p/create">{canList ? "Create / manage ads" : "Ads (locked until approved)"}</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 w-full rounded-[8px] font-bold">
          <Link to="/p2p/wallet">Fund merchant wallet</Link>
        </Button>
      </div>
    </div>
  );
}

function CheckCircle({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "grid h-6 w-6 place-items-center rounded-full",
        ok ? "bg-[#11C66D] text-white" : "bg-muted text-muted-foreground",
      )}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  );
}

function stNum(v: number | null | undefined) {
  return Number(v ?? 0);
}
