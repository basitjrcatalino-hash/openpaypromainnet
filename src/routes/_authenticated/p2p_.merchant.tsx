import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { P2pMenuCard, P2pSubpageHeader } from "@/components/p2p/P2pSubpage";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyPaymentAccounts, fetchTraderStats, formatAvgPayTime } from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/merchant")({
  head: () => ({
    meta: [
      { title: "Super Merchant — OpenPay Pro P2P" },
      {
        name: "description",
        content: "Requirements and progress toward Super Merchant status.",
      },
      { property: "og:title", content: "Super Merchant — OpenPay Pro P2P" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MerchantPage,
});

function MerchantPage() {
  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
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

  const checks = [
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
  const ready = checks.every((c) => c.ok) && completed >= 10;

  return (
    <div>
      <P2pSubpageHeader title="Super Merchant" />

      <div className="mx-4 mt-4 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-transparent p-5 md:mx-6">
        <p className="inline-flex items-center gap-1.5 text-sm font-extrabold text-amber-400">
          <Sparkles className="h-4 w-4" /> Super Merchant
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Higher placement in the marketplace, a verified badge on your ads, and priority support —
          same idea as OKX’s merchant program.
        </p>
        <p className="mt-3 text-sm font-bold">
          {ready ? "You’re eligible — keep trading to stay listed." : "Complete the checklist below."}
        </p>
      </div>

      <h2 className="mx-4 mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground md:mx-6">
        Requirements
      </h2>
      <P2pMenuCard className="mb-4">
        {checks.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="flex items-center gap-3 border-b border-border/40 px-4 py-3.5 last:border-b-0 hover:bg-muted/30"
          >
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full",
                c.ok ? "bg-[#11C66D] text-white" : "bg-muted text-muted-foreground",
              )}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{c.label}</span>
              <span className="text-[12px] text-muted-foreground">{c.detail}</span>
            </span>
          </Link>
        ))}
      </P2pMenuCard>

      <div className="mx-4 mb-8 space-y-2 md:mx-6">
        <Button asChild className="h-11 w-full rounded-[8px] bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]">
          <Link to="/p2p/create">Create / manage ads</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 w-full rounded-[8px] font-bold">
          <Link to="/p2p/wallet">Fund merchant wallet</Link>
        </Button>
      </div>
    </div>
  );
}

function stNum(v: number | null | undefined) {
  return Number(v ?? 0);
}
