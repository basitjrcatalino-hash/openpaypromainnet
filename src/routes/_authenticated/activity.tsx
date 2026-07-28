import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  TransactionDetailSheet,
  TxRowButton,
  groupActivityByDate,
  type TxRow,
} from "@/components/transaction-detail";
import { PageHeader } from "@/components/wallet/PageHeader";
import { fetchWalletActivity, type ActivityItem } from "@/lib/activity";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity — OpenPay Pro Wallet" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { user } = Route.useRouteContext();
  const [selected, setSelected] = useState<TxRow | null>(null);

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("wallets")
          .select("id")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data,
    staleTime: 30_000,
  });

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["all-txs", wallet?.id],
    enabled: !!wallet?.id,
    staleTime: 10_000,
    refetchOnMount: "always",
    queryFn: (): Promise<ActivityItem[]> => fetchWalletActivity(supabase, wallet!.id, 80),
  });

  const groups = useMemo(() => groupActivityByDate(txs), [txs]);

  return (
    <div className="ot-phantom ph-page space-y-5 pb-8">
      <PageHeader title="History" backTo="/dashboard" />

      {isLoading && txs.length === 0 ? (
        <div className="space-y-6 pt-2">
          {Array.from({ length: 2 }).map((_, gi) => (
            <div key={gi} className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="overflow-hidden rounded-2xl bg-card">
                {Array.from({ length: 3 }).map((__, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-border/40 px-4 py-3.5 last:border-0">
                    <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-3.5 w-14 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : txs.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No activity yet — your transactions will appear here.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label} className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h2>
              <ul className="overflow-hidden rounded-2xl bg-card">
                {group.items.map((t) => (
                  <li
                    key={`${t.source ?? "wallet"}-${t.id}`}
                    className="border-b border-border/40 last:border-0"
                  >
                    <TxRowButton tx={t} onOpen={setSelected} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <TransactionDetailSheet
        tx={selected}
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      />
    </div>
  );
}
