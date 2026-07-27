import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TransactionDetailSheet, TxRowButton, type TxRow } from "@/components/transaction-detail";
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

  const { data: txs = [] } = useQuery({
    queryKey: ["all-txs", wallet?.id],
    enabled: !!wallet?.id,
    staleTime: 10_000,
    refetchOnMount: "always",
    queryFn: (): Promise<ActivityItem[]> => fetchWalletActivity(supabase, wallet!.id, 80),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Wallet transfers, OpenDEX swaps, and OpenToken buys & sells
        </p>
      </div>

      <Card className="glass-strong rounded-3xl border-border/60 p-2 sm:p-5">
        {txs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No activity yet — your transactions will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 px-2 sm:px-0">
            {txs.map((t) => (
              <li key={`${t.source ?? "wallet"}-${t.id}`}>
                <TxRowButton tx={t} onOpen={setSelected} />
              </li>
            ))}
          </ul>
        )}
      </Card>

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
