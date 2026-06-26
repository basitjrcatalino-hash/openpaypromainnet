import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Sparkles, ShoppingCart } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { formatNumber, formatUSD, shortAddress } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity — OpenPay Pro Wallet" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { user } = Route.useRouteContext();

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () => (await supabase.from("wallets").select("id").eq("user_id", user.id).limit(1).maybeSingle()).data,
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["all-txs", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => (await supabase.from("transactions").select("*").eq("wallet_id", wallet!.id).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Activity</h1>
        <p className="text-sm text-muted-foreground">All transactions on your active wallet</p>
      </div>

      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        {txs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No activity yet — your transactions will appear here.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {txs.map((t: any) => {
              const Icon = t.type === "receive" || t.type === "buy" ? ArrowDownLeft : t.type === "swap" ? RefreshCw : t.type === "mint" ? Sparkles : t.type === "sell" ? ShoppingCart : ArrowUpRight;
              return (
                <li key={t.id} className="flex items-center gap-3 py-3 text-sm">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold capitalize">{t.type} {t.token_symbol ?? ""}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{t.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.counterparty ? `${shortAddress(t.counterparty)} • ` : ""}{new Date(t.created_at).toLocaleString()}
                    </div>
                    {t.memo && <div className="mt-0.5 truncate text-xs text-muted-foreground">"{t.memo}"</div>}
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="font-semibold">{formatNumber(t.amount, 6)}</div>
                    <div className="text-xs text-muted-foreground">{formatUSD(t.usd_value)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
