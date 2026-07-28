import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  QrCode,
  Send,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/wallet/PageHeader";
import { PhantomSparkline, type PhantomPeriod } from "@/components/opentoken/PriceChart";
import { formatNumber, formatUSD } from "@/lib/wallet-utils";
import { OusdIcon } from "@/components/ousd-icon";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ousd")({
  head: () => ({ meta: [{ title: "OpenUSD — OpenPay Pro Wallet" }] }),
  component: OUSDPage,
});

function OUSDPage() {
  const { user } = Route.useRouteContext();
  const [period, setPeriod] = useState<PhantomPeriod>("1D");

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["ousd-txs", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () =>
      (
        await supabase
          .from("transactions")
          .select("*")
          .eq("wallet_id", wallet!.id)
          .eq("token_symbol", "OUSD")
          .order("created_at", { ascending: false })
          .limit(15)
      ).data ?? [],
  });

  const bal = Number(wallet?.ousd_balance ?? 0);

  return (
    <div className="ot-phantom ph-page space-y-6 pb-8">
      <PageHeader title="OpenUSD" backTo="/dashboard" />

      <div className="text-center">
        <div className="mx-auto mb-3 h-16 w-16">
          <OusdIcon className="h-16 w-16" />
        </div>
        <div className="text-4xl font-bold tabular-nums tracking-tight">{formatUSD(1)}</div>
        <div className="mt-2 inline-flex items-center gap-2 text-sm">
          <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
            +$0.00
          </span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            0.00%
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Pegged stablecoin · 1 OUSD = $1</p>
      </div>

      <PhantomSparkline
        period={period}
        onPeriodChange={setPeriod}
        ticks={null}
        price={1}
        changePct={0}
        tokenKey="ousd"
        peg
        footnote="Pegged at $1.00 · stablecoin"
      />

      <div className="grid grid-cols-3 gap-3">
        <Link to="/send" search={{ asset: "OUSD" }} className="flex flex-col items-center gap-2">
          <span className="grid h-14 w-full place-items-center rounded-2xl bg-muted text-primary transition hover:bg-accent hover:text-accent-foreground">
            <Send className="h-5 w-5" />
          </span>
          <span className="text-xs font-medium text-foreground">Send</span>
        </Link>
        <Link to="/receive" className="flex flex-col items-center gap-2">
          <span className="grid h-14 w-full place-items-center rounded-2xl bg-muted text-primary transition hover:bg-accent hover:text-accent-foreground">
            <QrCode className="h-5 w-5" />
          </span>
          <span className="text-xs font-medium text-foreground">Receive</span>
        </Link>
        <Link to="/swap" className="flex flex-col items-center gap-2">
          <span className="grid h-14 w-full place-items-center rounded-2xl bg-muted text-primary transition hover:bg-accent hover:text-accent-foreground">
            <ArrowLeftRight className="h-5 w-5" />
          </span>
          <span className="text-xs font-medium text-foreground">Swap</span>
        </Link>
      </div>

      <section>
        <h2 className="mb-2 text-sm text-muted-foreground">Balance</h2>
        <div className="overflow-hidden rounded-2xl bg-card">
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm text-muted-foreground">Available</span>
            <div className="text-right">
              <div className="font-semibold tabular-nums">{formatNumber(bal, 2)} OUSD</div>
              <div className="text-xs text-muted-foreground">{formatUSD(bal)}</div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-3.5">
            <span className="text-sm text-muted-foreground">Wallet</span>
            <span className="text-sm font-medium">{wallet?.name ?? "Main Wallet"}</span>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm text-muted-foreground">Activity</h2>
          <Link to="/activity" className="text-xs font-semibold text-primary">
            See all
          </Link>
        </div>
        {txs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No OUSD transactions yet.</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl bg-card">
            {txs.map((t: any, i: number) => (
              <li
                key={t.id}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3.5",
                  i > 0 && "border-t border-border/60",
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-full",
                      t.type === "receive"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    {t.type === "receive" ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <div className="font-medium capitalize">{t.type}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div className="font-semibold">{formatNumber(t.amount, 2)} OUSD</div>
                  <div className="text-xs text-muted-foreground">{formatUSD(t.usd_value)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
