import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle, Search } from "lucide-react";

import { FilterChipRow, P2pEmptyState } from "@/components/p2p/P2pUi";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  expireOrders,
  fetchDisplayNames,
  fetchMyOrders,
  fmtAmount,
  type P2POrder,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/orders")({
  head: () => ({
    meta: [
      { title: "P2P Orders — OpenPay Pro" },
      { name: "description", content: "Track pending and completed P2P escrow trades." },
      { property: "og:title", content: "P2P Orders — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

type MainTab = "pending" | "completed";
type PendingChip = "all" | "progress" | "dispute";
type CompletedChip = "all" | "fulfilled" | "canceled";

const PENDING_STATUSES = new Set(["pending_payment", "paid", "disputed"]);
const COMPLETED_STATUSES = new Set(["completed", "cancelled", "expired"]);

function OrdersPage() {
  const [main, setMain] = useState<MainTab>("pending");
  const [pendingChip, setPendingChip] = useState<PendingChip>("all");
  const [completedChip, setCompletedChip] = useState<CompletedChip>("all");
  const { code: fiat } = useCurrency();

  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const ordersQ = useQuery({
    queryKey: ["p2p-orders", userQ.data],
    queryFn: () => fetchMyOrders(userQ.data as string),
    enabled: !!userQ.data,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    void expireOrders().catch(() => {});
  }, []);

  const counterparties = useMemo(() => {
    const uid = userQ.data;
    if (!uid || !ordersQ.data) return [];
    return ordersQ.data.map((o) => (o.buyer_id === uid ? o.seller_id : o.buyer_id));
  }, [ordersQ.data, userQ.data]);

  const names = useQuery({
    queryKey: ["p2p-names", counterparties.join(",")],
    queryFn: () => fetchDisplayNames(counterparties),
    enabled: counterparties.length > 0,
  });

  const filtered = useMemo(() => {
    const uid = userQ.data;
    let list = ordersQ.data ?? [];
    if (main === "pending") {
      list = list.filter((o) => PENDING_STATUSES.has(o.status));
      if (pendingChip === "progress") {
        list = list.filter((o) => o.status === "pending_payment" || o.status === "paid");
      } else if (pendingChip === "dispute") {
        list = list.filter((o) => o.status === "disputed");
      }
    } else {
      list = list.filter((o) => COMPLETED_STATUSES.has(o.status));
      if (completedChip === "fulfilled") list = list.filter((o) => o.status === "completed");
      if (completedChip === "canceled") {
        list = list.filter((o) => o.status === "cancelled" || o.status === "expired");
      }
    }
    return list.map((o) => ({
      order: o,
      isBuyer: o.buyer_id === uid,
      counterparty: names.data?.[o.buyer_id === uid ? o.seller_id : o.buyer_id] ?? "Trader",
    }));
  }, [ordersQ.data, userQ.data, main, pendingChip, completedChip, names.data]);

  return (
    <div>
      <header
        className="sticky top-0 z-20 border-b border-border/40 bg-background/95 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex h-12 items-center justify-between px-4 md:px-6">
          <h1 className="text-lg font-bold">Orders</h1>
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-6 px-4 md:px-6">
          {(["pending", "completed"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMain(tab)}
              className={cn(
                "relative pb-2.5 text-sm font-bold capitalize",
                main === tab ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {tab}
              {main === tab ? (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground" />
              ) : null}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 py-3 md:px-6">
        <FilterChipRow>
          {main === "pending"
            ? (
                [
                  ["all", "All"],
                  ["progress", "In progress"],
                  ["dispute", "In dispute"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPendingChip(id)}
                  className={cn(
                    "h-8 shrink-0 rounded-full px-3 text-xs font-semibold",
                    pendingChip === id ? "bg-secondary text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))
            : (
                [
                  ["all", "All"],
                  ["fulfilled", "Fulfilled"],
                  ["canceled", "Canceled"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCompletedChip(id)}
                  className={cn(
                    "h-8 shrink-0 rounded-full px-3 text-xs font-semibold",
                    completedChip === id ? "bg-secondary text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
        </FilterChipRow>
      </div>

      {ordersQ.isLoading ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !filtered.length ? (
        <P2pEmptyState title="No orders" description="Your P2P trades will show up here." />
      ) : (
        <div className="divide-y divide-border/40">
          {filtered.map(({ order, isBuyer, counterparty }) => (
            <OrderRow
              key={order.id}
              order={order}
              isBuyer={!!isBuyer}
              counterparty={counterparty}
              fiat={fiat}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderRow({
  order,
  isBuyer,
  counterparty,
  fiat,
}: {
  order: P2POrder;
  isBuyer: boolean;
  counterparty: string;
  fiat: string;
}) {
  const statusLabel =
    order.status === "completed"
      ? "Fulfilled"
      : order.status === "cancelled" || order.status === "expired"
        ? "Canceled"
        : order.status === "disputed"
          ? "In dispute"
          : "In progress";

  return (
    <Link
      to="/p2p/order/$id"
      params={{ id: order.id }}
      className="block px-4 py-4 transition-colors hover:bg-muted/30 md:px-6"
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "text-sm font-bold",
            isBuyer ? "text-emerald-500" : "text-rose-500",
          )}
        >
          {isBuyer ? "Buy" : "Sell"} {order.asset}
        </span>
        <span className="text-xs text-muted-foreground">{statusLabel} ›</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {new Date(order.created_at).toLocaleString()}
      </p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>
            Unit price{" "}
            <span className="text-foreground">
              {formatCurrency(Number(order.price_usd), fiat as never, { compact: false })}
            </span>
          </p>
          <p>
            Quantity{" "}
            <span className="text-foreground">
              {fmtAmount(order.amount)} {order.asset}
            </span>
          </p>
        </div>
        <p className="text-lg font-extrabold tabular-nums">
          {formatCurrency(Number(order.total_fiat), fiat as never, { compact: false })}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="truncate text-xs text-muted-foreground">{counterparty}</p>
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
