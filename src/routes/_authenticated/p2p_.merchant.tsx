import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MerchantBadge, MerchantTierLabel } from "@/components/p2p/MerchantBadge";
import { P2pMenuCard, P2pHubLayout, P2pHubPill } from "@/components/p2p/P2pSubpage";
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
    <P2pHubLayout
      title="Merchant program"
      dek="Apply as a merchant, wait for admin approval, then publish buy/sell ads. Verified and Super badges appear on the marketplace; Featured merchants float to the top."
      crumb="Profile"
      eyebrow="Apply · Badges · Featured"
      hero={{ from: "#fde68a", to: "#c4b5fd", glyph: "✦" }}
      actions={
        <>
          <P2pHubPill to="/p2p/create" primary>
            {canList ? "Create / manage ads" : "Ads (locked)"}
          </P2pHubPill>
          <P2pHubPill to="/p2p/wallet">Fund wallet</P2pHubPill>
        </>
      }
    >
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--accent)] p-5">
        <p className="inline-flex items-center gap-1.5 text-base font-bold">
          <Sparkles className="h-4 w-4" /> List ads on the P2P marketplace
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
          <p className="mt-2 text-sm font-semibold text-amber-700">
            You cannot publish ads until an admin approves your application.
          </p>
        ) : (
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            Approved — you can publish and activate ads.
          </p>
        )}
      </div>

      {pending ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-base font-bold">
            Pending {pending.requested_tier === "super" ? "Super Merchant" : "Verified Merchant"}{" "}
            review
          </p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Submitted {new Date(pending.created_at).toLocaleString()}. An admin will approve or reject
            this request.
          </p>
          <Button
            variant="outline"
            className="mt-3 h-9 rounded-full text-xs font-bold"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            Cancel application
          </Button>
        </div>
      ) : null}

      {appQ.data?.status === "rejected" ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
          <p className="text-base font-bold text-rose-700">Last application rejected</p>
          {appQ.data.admin_note ? (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{appQ.data.admin_note}</p>
          ) : (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">You can fix issues and apply again.</p>
          )}
        </div>
      ) : null}

      <div>
        <h2 className="opblog-h2">1. Verified Merchant</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Required to list ads</p>
        <P2pMenuCard className="mt-4">
          {verifiedChecks.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4 last:border-b-0 hover:bg-[var(--muted)]"
            >
              <CheckCircle ok={c.ok} />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold tracking-tight">{c.label}</span>
                <span className="text-sm text-[var(--muted-foreground)]">{c.detail}</span>
              </span>
            </Link>
          ))}
        </P2pMenuCard>
      </div>

      <div>
        <h2 className="opblog-h2">2. Super Merchant</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Badge + ranking boost</p>
        <P2pMenuCard className="mt-4">
          {superChecks.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4 last:border-b-0 hover:bg-[var(--muted)]"
            >
              <CheckCircle ok={c.ok} />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold tracking-tight">{c.label}</span>
                <span className="text-sm text-[var(--muted-foreground)]">{c.detail}</span>
              </span>
            </Link>
          ))}
        </P2pMenuCard>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
          Note to admin (optional)
        </label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Trading experience, regions, payment rails…"
          className="min-h-[72px] rounded-2xl border-[var(--border)] bg-[var(--card)]"
          maxLength={500}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {!canList ? (
          <Button
            className="h-11 rounded-full bg-[var(--primary)] px-6 font-bold text-[var(--primary-foreground)]"
            disabled={!verifiedReady || !!pending || apply.isPending}
            onClick={() => apply.mutate("verified")}
          >
            {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply as Verified Merchant"}
          </Button>
        ) : merchant?.tier !== "super" ? (
          <Button
            className="h-11 rounded-full bg-amber-500 px-6 font-bold text-white hover:bg-amber-500/90"
            disabled={!superReady || !!pending || apply.isPending}
            onClick={() => apply.mutate("super")}
          >
            {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply for Super Merchant"}
          </Button>
        ) : null}
      </div>
    </P2pHubLayout>
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
