import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Gift, Loader2, Store } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MerchantBadge, MerchantTierLabel } from "@/components/p2p/MerchantBadge";
import { P2pMenuCard, P2pHubLayout, P2pHubPill } from "@/components/p2p/P2pSubpage";
import { supabase } from "@/integrations/supabase/client";
import {
  applyMerchant,
  cancelMerchantApplication,
  claimMerchantMilestones,
  fetchMerchantProgramStatus,
  fetchMyMerchant,
  fetchMyMerchantApplication,
  merchantCanList,
  merchantHasVerifiedBadge,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

const MIN_P2P_OUSD = 100;

export const Route = createFileRoute("/_authenticated/p2p_/merchant")({
  head: () => ({
    meta: [
      { title: "Merchant program — OpenPay Pro P2P" },
      {
        name: "description",
        content:
          "Become a P2P merchant with KYC, merchant details, and 100 OUSD in P2P. Earn Verified badge and order bonuses.",
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
  const [merchantName, setMerchantName] = useState("");
  const [merchantRegion, setMerchantRegion] = useState("");

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
  const programQ = useQuery({
    queryKey: ["p2p-merchant-program", userQ.data],
    enabled: !!userQ.data,
    queryFn: fetchMerchantProgramStatus,
  });
  const merchant = merchantQ.data;
  const canList = merchantCanList(merchant);
  const hasVerified = merchantHasVerifiedBadge(merchant) || !!programQ.data?.has_verified_badge;
  const pending = appQ.data?.status === "pending" ? appQ.data : null;
  const p2pOusd = Number(programQ.data?.p2p_ousd ?? 0);
  const fundedOk = p2pOusd >= MIN_P2P_OUSD;
  const detailsOk = merchantName.trim().length >= 2 && merchantRegion.trim().length >= 2;
  const applyReady = fundedOk && detailsOk;
  const daysLeft = Number(programQ.data?.verified_badge_days_left ?? 0);
  const milestones = programQ.data?.milestones ?? [];
  const claimable = milestones.some((m) => m.reached && !m.claimed);

  useEffect(() => {
    if (merchant?.merchant_name && !merchantName) setMerchantName(merchant.merchant_name);
    if (merchant?.merchant_region && !merchantRegion) setMerchantRegion(merchant.merchant_region);
  }, [merchant?.merchant_name, merchant?.merchant_region, merchantName, merchantRegion]);

  const applyChecks = [
    {
      ok: detailsOk,
      label: "Merchant details",
      detail: detailsOk ? `${merchantName.trim()} · ${merchantRegion.trim()}` : "Name + region below",
      to: "/p2p/merchant" as const,
    },
    {
      ok: fundedOk,
      label: `Minimum ${MIN_P2P_OUSD} OUSD in P2P account`,
      detail: `${p2pOusd.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${MIN_P2P_OUSD} OUSD`,
      to: "/transfer" as const,
    },
    {
      ok: canList,
      label: "Admin review",
      detail: canList ? "Approved — you can create ads" : "Required before your ads appear",
      to: "/p2p/support" as const,
    },
  ];

  const apply = useMutation({
    mutationFn: () =>
      applyMerchant({
        note: note.trim() || undefined,
        merchantName: merchantName.trim(),
        merchantRegion: merchantRegion.trim(),
      }),
    onSuccess: () => {
      toast.success("Merchant application submitted — awaiting admin");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["p2p-my-merchant-app"] });
      void qc.invalidateQueries({ queryKey: ["p2p-merchant-program"] });
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

  const claim = useMutation({
    mutationFn: claimMerchantMilestones,
    onSuccess: (res) => {
      const amt = Number(res.claimed_ousd ?? 0);
      if (amt > 0) toast.success(`Claimed ${amt} OUSD bonus to your P2P account`);
      else toast.message("No new bonuses to claim");
      void qc.invalidateQueries({ queryKey: ["p2p-merchant-program"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <P2pHubLayout
      title="Merchant program"
      dek="Become a merchant with KYC, your details, and 100 OUSD in P2P. Admin approves before you create ads. Stay active 30 days for Verified — hit order milestones for OUSD bonuses."
      crumb="Profile"
      eyebrow="Apply · Verified · Bonuses"
      hero={{ from: "#fde68a", to: "#c4b5fd", glyph: "★" }}
      actions={
        <>
          <P2pHubPill to="/p2p/create" primary>
            {canList ? "Create / manage ads" : "Ads (locked)"}
          </P2pHubPill>
          <P2pHubPill to="/p2p/wallet">P2P wallet</P2pHubPill>
          <Link
            to="/transfer"
            search={{ from: "funding", to: "p2p" }}
            className="inline-flex items-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground"
          >
            Transfer to P2P
          </Link>
        </>
      }
    >
      <div className="rounded-3xl border border-border bg-accent p-5">
        <p className="inline-flex items-center gap-1.5 text-base font-bold">
          <Store className="h-4 w-4" /> List ads on the P2P marketplace
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold">
            {MerchantTierLabel(merchant?.tier ?? "none", { hasVerifiedBadge: hasVerified })}
          </p>
          {merchant && merchant.tier !== "none" ? (
            <MerchantBadge
              merchant={{
                user_id: merchant.user_id,
                tier: merchant.tier,
                is_featured: merchant.is_featured,
                featured_until: merchant.featured_until,
                badge_label: merchant.badge_label,
                has_verified_badge: hasVerified,
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
          <p className="mt-2 text-sm font-semibold text-foreground">
            Approved — you can publish and activate ads.
          </p>
        )}
      </div>

      {pending ? (
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-base font-bold">Pending merchant review</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted {new Date(pending.created_at).toLocaleString()}. An admin will approve or
            reject this request.
          </p>
          {(pending.merchant_name || pending.merchant_region) && (
            <p className="mt-2 text-sm text-muted-foreground">
              {[pending.merchant_name, pending.merchant_region].filter(Boolean).join(" · ")}
            </p>
          )}
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
            <p className="mt-1 text-sm text-muted-foreground">{appQ.data.admin_note}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              You can fix issues and apply again.
            </p>
          )}
        </div>
      ) : null}

      <div>
        <h2 className="text-xl font-bold tracking-tight">1. Become a merchant</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Details + {MIN_P2P_OUSD} OUSD in P2P, then admin review
        </p>
        <P2pMenuCard className="mt-4">
          {applyChecks.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              search={c.to === "/transfer" ? { from: "funding", to: "p2p" } : undefined}
              className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-b-0 hover:bg-muted"
            >
              <CheckCircle ok={c.ok} />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold tracking-tight">{c.label}</span>
                <span className="text-sm text-muted-foreground">{c.detail}</span>
              </span>
            </Link>
          ))}
        </P2pMenuCard>
      </div>

      {!canList ? (
        <div className="space-y-3 rounded-3xl border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Merchant details
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Display name</label>
              <Input
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="How buyers see you"
                className="h-11 rounded-2xl"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Region / country</label>
              <Input
                value={merchantRegion}
                onChange={(e) => setMerchantRegion(e.target.value)}
                placeholder="e.g. Philippines"
                className="h-11 rounded-2xl"
                maxLength={80}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Note to admin (optional)
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Trading experience, payment rails…"
              className="min-h-18 rounded-2xl border-border bg-background"
              maxLength={500}
            />
          </div>
          <Button
            className="h-11 rounded-full bg-primary px-6 font-bold text-primary-foreground"
            disabled={!applyReady || !!pending || apply.isPending}
            onClick={() => apply.mutate()}
          >
            {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply as merchant"}
          </Button>
        </div>
      ) : null}

      <div>
        <h2 className="text-xl font-bold tracking-tight">2. Verified badge</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Stay an approved merchant for 30 continuous days on P2P
        </p>
        <P2pMenuCard className="mt-4">
          <div className="flex items-center gap-3 px-5 py-4">
            <CheckCircle ok={hasVerified} />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold tracking-tight">30 days continuous</span>
              <span className="text-sm text-muted-foreground">
                {hasVerified
                  ? "Verified badge unlocked"
                  : canList
                    ? daysLeft > 0
                      ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`
                      : "Almost there — keep your merchant status active"
                    : "Become an approved merchant first"}
              </span>
            </span>
          </div>
        </P2pMenuCard>
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight">3. Order bonuses</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reach order milestones and claim OUSD into your P2P account
            </p>
          </div>
          {canList ? (
            <Button
              className="h-9 rounded-full bg-[#11C66D] px-4 text-xs font-bold text-white hover:bg-[#0FB461]"
              disabled={!claimable || claim.isPending}
              onClick={() => claim.mutate()}
            >
              {claim.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Gift className="mr-1.5 h-3.5 w-3.5" />
                  Claim bonuses
                </>
              )}
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Completed orders:{" "}
          <span className="font-semibold text-foreground">
            {Number(programQ.data?.completed_orders ?? 0)}
          </span>
        </p>
        <P2pMenuCard className="mt-4">
          {milestones.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              Bonus tiers load after the merchant program migration is applied.
            </p>
          ) : (
            milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-b-0"
              >
                <CheckCircle ok={m.claimed || m.reached} />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold tracking-tight">{m.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {m.claimed
                      ? `Claimed ${m.bonus_ousd} OUSD`
                      : m.reached
                        ? `${m.bonus_ousd} OUSD ready to claim`
                        : `${Number(programQ.data?.completed_orders ?? 0)} / ${m.order_count} · +${m.bonus_ousd} OUSD`}
                  </span>
                </span>
              </div>
            ))
          )}
        </P2pMenuCard>
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
