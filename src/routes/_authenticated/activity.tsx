import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { TransactionDetailSheet, TxRowButton, type TxRow } from "@/components/transaction-detail";
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

  const { data: txs = [] } = useQuery({
    queryKey: ["all-txs", wallet?.id],
    enabled: !!wallet?.id,
    staleTime: 10_000,
    refetchOnMount: "always",
    queryFn: (): Promise<ActivityItem[]> => fetchWalletActivity(supabase, wallet!.id, 80),
  });

  return (
    <div className="ot-phantom ph-page space-y-4 pb-8">
      <PageHeader title="History" backTo="/dashboard" />
      <p className="-mt-2 text-center text-sm text-muted-foreground">
        Transfers, swaps, and OpenToken trades
      </p>

      {txs.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No activity yet — your transactions will appear here.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-card">
          {txs.map((t) => (
            <li key={`${t.source ?? "wallet"}-${t.id}`}>
              <TxRowButton tx={t} onOpen={setSelected} />
            </li>
          ))}
        </ul>
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
