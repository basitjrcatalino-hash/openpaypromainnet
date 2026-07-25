import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { formatNumber, formatUSD } from "@/lib/wallet-utils";
import { OusdIcon } from "@/components/ousd-icon";

export const Route = createFileRoute("/_authenticated/ousd")({
  head: () => ({ meta: [{ title: "OUSD — OpenPay Pro Wallet" }] }),
  component: OUSDPage,
});

function OUSDPage() {
  const { user } = Route.useRouteContext();

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () =>
      (await supabase.from("wallets").select("*").eq("user_id", user.id).limit(1).maybeSingle())
        .data,
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

  const chart = Array.from({ length: 30 }).map((_, i) => ({
    t: i,
    v: 100 + Math.sin(i / 3) * 12 + i,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <OusdIcon className="h-12 w-12 rounded-2xl" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              OUSD Stablecoin Center
            </h1>
            <p className="text-sm text-muted-foreground">Manage your OpenPay OUSD — 1:1 backed</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/20 px-3 py-1 text-xs font-semibold text-mint-foreground">
          <Sparkles className="h-3 w-3" /> $1.00 peg
        </span>
      </div>

      <Card className="relative overflow-hidden rounded-3xl border-0 bg-gradient-mint p-6 text-mint-foreground shadow-glow md:p-8">
        <div className="text-xs uppercase tracking-widest opacity-80">Your OUSD balance</div>
        <div className="mt-2 text-5xl font-bold tabular-nums">
          {formatNumber(wallet?.ousd_balance ?? 0, 2)} OUSD
        </div>
        <div className="mt-1 text-sm opacity-80">
          ≈ {formatUSD(Number(wallet?.ousd_balance ?? 0))}
        </div>

        <div className="-mx-2 mt-4 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="ouG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="black" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="black" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip cursor={false} content={() => null} />
              <Area
                type="monotone"
                dataKey="v"
                stroke="currentColor"
                strokeWidth={2}
                fill="url(#ouG)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="secondary" className="rounded-full">
            <Link to="/send">Send</Link>
          </Button>
          <Button asChild variant="secondary" className="rounded-full">
            <Link to="/receive">Receive</Link>
          </Button>
          <Button asChild variant="secondary" className="rounded-full">
            <Link to="/swap">Swap</Link>
          </Button>
        </div>
      </Card>

      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          OUSD activity
        </h2>
        {txs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No OUSD transactions yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {txs.map((t: any) => (
              <li key={t.id} className="flex items-center justify-between py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full ${t.type === "receive" ? "bg-mint/20 text-mint-foreground" : "bg-primary/15 text-primary"}`}
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
      </Card>
    </div>
  );
}
