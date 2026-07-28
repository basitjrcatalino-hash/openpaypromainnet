import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

import { supabase } from "@/integrations/supabase/client";
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

  const chart = Array.from({ length: 30 }).map((_, i) => ({
    t: i,
    v: 100 + Math.sin(i / 3) * 12 + i,
  }));

  return (
    <div className="ph-page space-y-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <OusdIcon className="h-16 w-16" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">OUSD</h1>
          <p className="text-sm text-muted-foreground">Earn · 1:1 USD-backed stablecoin</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
          <Sparkles className="h-3 w-3" /> $1.00 peg
        </span>
      </div>

      <div className="rounded-2xl bg-card px-5 py-6 text-center">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your balance
        </div>
        <div className="mt-2 text-4xl font-bold tabular-nums">
          {formatNumber(wallet?.ousd_balance ?? 0, 2)}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          ≈ {formatUSD(Number(wallet?.ousd_balance ?? 0))}
        </div>

        <div className="mx-auto mt-4 h-16 max-w-xs">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="ouG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip cursor={false} content={() => null} />
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#ouG)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild className="rounded-full bg-primary text-primary-foreground">
            <Link to="/send">Send</Link>
          </Button>
          <Button asChild variant="secondary" className="rounded-full">
            <Link to="/receive">Receive</Link>
          </Button>
          <Button asChild variant="secondary" className="rounded-full">
            <Link to="/swap">Swap</Link>
          </Button>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Activity</h2>
        {txs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No OUSD transactions yet.
          </p>
        ) : (
          <ul>
            {txs.map((t: any) => (
              <li key={t.id} className="ph-row">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-full ${t.type === "receive" ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}
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
      </div>
    </div>
  );
}
