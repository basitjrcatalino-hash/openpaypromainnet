import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ScrollText } from "lucide-react";

import { PageHeader } from "@/components/wallet/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  ESCROW_LABEL,
  ORDER_STATUS_LABEL,
  expireOrders,
  fetchMyOrders,
  fmtAmount,
  statusTone,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/orders")({
  head: () => ({
    meta: [
      { title: "P2P Orders — OpenPay Pro" },
      {
        name: "description",
        content: "Track your peer-to-peer trades, escrow status and settlement history.",
      },
      { property: "og:title", content: "P2P Orders — OpenPay Pro" },
      { property: "og:description", content: "Escrow status and trade history for P2P orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const ordersQ = useQuery({
    queryKey: ["p2p-orders", userQ.data],
    queryFn: () => fetchMyOrders(userQ.data as string),
    enabled: !!userQ.data,
    refetchInterval: 20_000,
  });

  useEffect(() => {
    void expireOrders().catch(() => {});
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 pb-24">
      <PageHeader
        title="P2P orders"
        backTo="/p2p"
        right={
          <Link
            to="/p2p"
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground press"
          >
            Marketplace
          </Link>
        }
      />

      {ordersQ.isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !ordersQ.data?.length ? (
        <div className="grid place-items-center gap-3 rounded-3xl border border-border/60 bg-card/50 py-20 text-center">
          <ScrollText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No P2P trades yet.</p>
          <Link to="/p2p" className="text-sm font-semibold text-primary underline underline-offset-4">
            Browse the marketplace
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border/60 overflow-hidden rounded-3xl border border-border/60 bg-card/50">
          {ordersQ.data.map((o) => {
            const isBuyer = o.buyer_id === userQ.data;
            return (
              <Link
                key={o.id}
                to="/p2p/order/$id"
                params={{ id: o.id }}
                className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-bold uppercase",
                    isBuyer
                      ? "bg-emerald-500/12 text-emerald-500"
                      : "bg-rose-500/12 text-rose-500",
                  )}
                >
                  {isBuyer ? "Buy" : "Sell"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold tabular-nums">
                    {fmtAmount(o.amount)} {o.asset} · ${Number(o.total_fiat).toFixed(2)}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {o.ref} · {o.payment_method} · {ESCROW_LABEL[o.escrow_status]}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                    statusTone(o.status),
                  )}
                >
                  {ORDER_STATUS_LABEL[o.status]}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
