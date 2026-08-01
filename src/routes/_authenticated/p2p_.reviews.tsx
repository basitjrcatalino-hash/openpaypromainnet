import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";

import { P2pEmptyState } from "@/components/p2p/P2pUi";
import { P2pHubLayout, P2pHubPill, P2pMenuCard } from "@/components/p2p/P2pSubpage";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  ORDER_STATUS_LABEL,
  fetchDisplayNames,
  fetchMyOrders,
  fetchRatingStats,
  fetchTraderStats,
  fmtAmount,
  formatAvgPayTime,
  formatPositiveRate,
} from "@/lib/p2p";

export const Route = createFileRoute("/_authenticated/p2p_/reviews")({
  head: () => ({
    meta: [
      { title: "Reviews & stats — OpenPay Pro P2P" },
      { name: "description", content: "Your P2P completion stats and recent trade history." },
      { property: "og:title", content: "Reviews & stats — OpenPay Pro P2P" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewsPage,
});

function ReviewsPage() {
  const { code: fiat } = useCurrency();
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
  const ratingQ = useQuery({
    queryKey: ["p2p-rating-stats-self", userQ.data],
    enabled: !!userQ.data,
    queryFn: async () => {
      const map = await fetchRatingStats([userQ.data as string]);
      return map[userQ.data as string];
    },
  });
  const ordersQ = useQuery({
    queryKey: ["p2p-orders", userQ.data],
    enabled: !!userQ.data,
    queryFn: () => fetchMyOrders(userQ.data as string),
  });

  const completed = useMemo(
    () => (ordersQ.data ?? []).filter((o) => o.status === "completed").slice(0, 20),
    [ordersQ.data],
  );
  const counterpartyIds = useMemo(
    () => [...new Set(completed.map((o) => (o.buyer_id === userQ.data ? o.seller_id : o.buyer_id)))],
    [completed, userQ.data],
  );
  const namesQ = useQuery({
    queryKey: ["p2p-names", counterpartyIds.join(",")],
    enabled: counterpartyIds.length > 0,
    queryFn: () => fetchDisplayNames(counterpartyIds),
  });

  const st = statsQ.data;
  const rt = ratingQ.data;

  return (
    <P2pHubLayout
      title="Reviews / Orders"
      dek="Completion rate, positive reviews, and recent finished trades — the reputation buyers see on your ads."
      crumb="Profile"
      eyebrow="Reputation · Stats"
      hero={{ from: "#fde68a", to: "#ddd6fe", glyph: "★" }}
      actions={<P2pHubPill to="/p2p/orders" primary>All orders</P2pHubPill>}
    >
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Completed" value={String(st?.completed_count ?? 0)} />
        <StatCard
          label="Completion"
          value={st?.completion_rate == null ? "N/A" : `${Number(st.completion_rate).toFixed(1)}%`}
        />
        <StatCard label="Avg pay time" value={formatAvgPayTime(st?.avg_pay_seconds)} />
        <StatCard label="Positive reviews" value={formatPositiveRate(rt?.positive_rate)} />
        <StatCard
          label="Avg score"
          value={rt?.avg_score == null ? "N/A" : `${Number(rt.avg_score).toFixed(1)} / 5`}
        />
        <StatCard label="Ratings received" value={String(rt?.rating_count ?? 0)} />
      </section>

      <div>
        <h2 className="text-xl font-bold tracking-tight">Recent completed trades</h2>
        <div className="mt-4">
          {ordersQ.isLoading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : !completed.length ? (
            <P2pEmptyState
              title="No completed trades yet"
              description="Finish a P2P order to build completion rate and reputation."
            />
          ) : (
            <P2pMenuCard>
              {completed.map((o) => {
                const other = o.buyer_id === userQ.data ? o.seller_id : o.buyer_id;
                const name = namesQ.data?.[other] ?? "Trader";
                return (
                  <Link
                    key={o.id}
                    to="/p2p/order/$id"
                    params={{ id: o.id }}
                    className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4 last:border-b-0 hover:bg-[var(--muted)]"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-amber-500">
                      <Star className="h-4 w-4" fill="currentColor" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold tracking-tight">
                        {name} · {fmtAmount(o.amount)} {o.asset}
                      </span>
                      <span className="text-sm text-[var(--muted-foreground)]">
                        {ORDER_STATUS_LABEL[o.status] ?? o.status} ·{" "}
                        {formatCurrency(Number(o.total_fiat), fiat as never, { compact: false })}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </P2pMenuCard>
          )}
        </div>
      </div>
    </P2pHubLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
