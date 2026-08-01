import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronLeft, Loader2, Lock, Send, ShieldCheck, Timer, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  ESCROW_LABEL,
  ORDER_STATUS_LABEL,
  cancelOrder,
  confirmReceived,
  expireOrders,
  fetchDispute,
  fetchDisplayNames,
  fetchMessages,
  fetchOrder,
  fetchPaymentMethods,
  fmtAmount,
  formatCountdown,
  markPaid,
  openDispute,
  resolveDispute,
  sendMessage,
  statusTone,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/order/$id")({
  head: () => ({
    meta: [
      { title: "Trade Room — OpenPay Pro P2P" },
      {
        name: "description",
        content: "Escrow status, payment steps, trade chat and dispute tools for your P2P order.",
      },
      { property: "og:title", content: "Trade Room — OpenPay Pro P2P" },
      { property: "og:description", content: "Escrow-protected P2P trade room." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TradeRoom,
});

function TradeRoom() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { code: fiat } = useCurrency();
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState("");
  const [proof, setProof] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [resolution, setResolution] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const orderQ = useQuery({
    queryKey: ["p2p-order", id],
    queryFn: () => fetchOrder(id),
    refetchInterval: 8_000,
  });
  const msgQ = useQuery({
    queryKey: ["p2p-msgs", id],
    queryFn: () => fetchMessages(id),
    refetchInterval: 5_000,
  });
  const disputeQ = useQuery({ queryKey: ["p2p-dispute", id], queryFn: () => fetchDispute(id) });
  const methodsQ = useQuery({ queryKey: ["p2p-methods"], queryFn: fetchPaymentMethods });
  const modQ = useQuery({
    queryKey: ["p2p-is-mod", userQ.data],
    enabled: !!userQ.data,
    queryFn: async () => {
      const [{ data: admin }, { data: mod }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: userQ.data as string, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userQ.data as string, _role: "moderator" }),
      ]);
      return !!admin || !!mod;
    },
  });

  const order = orderQ.data;
  const names = useQuery({
    queryKey: ["p2p-names", order?.buyer_id, order?.seller_id],
    enabled: !!order,
    queryFn: () => fetchDisplayNames([order!.buyer_id, order!.seller_id]),
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [msgQ.data?.length]);

  const timeLeft = order ? new Date(order.expires_at).getTime() - now : 0;
  useEffect(() => {
    if (order?.status === "pending_payment" && timeLeft <= 0) {
      void expireOrders()
        .then(() => qc.invalidateQueries({ queryKey: ["p2p-order", id] }))
        .catch(() => {});
    }
  }, [order?.status, timeLeft <= 0, id, qc]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["p2p-order", id] });
    void qc.invalidateQueries({ queryKey: ["p2p-msgs", id] });
    void qc.invalidateQueries({ queryKey: ["p2p-dispute", id] });
    void qc.invalidateQueries({ queryKey: ["active-wallet"] });
    void qc.invalidateQueries({ queryKey: ["wallets"] });
  };
  const act = (fn: () => Promise<unknown>, ok: string) =>
    fn()
      .then(() => {
        toast.success(ok);
        refresh();
      })
      .catch((e: Error) => toast.error(e.message));

  const paid = useMutation({ mutationFn: () => markPaid(id, proof || null) });
  const methodLabel = useMemo(() => {
    const m = (methodsQ.data ?? []).find((x) => x.code === order?.payment_method);
    return m ? `${m.icon ?? ""} ${m.name}`.trim() : (order?.payment_method ?? "");
  }, [methodsQ.data, order?.payment_method]);

  if (orderQ.isLoading || !userQ.data) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!order) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-24 text-center">
        <p className="text-sm text-muted-foreground">Order not found or you don&apos;t have access.</p>
        <Link to="/p2p/orders" className="text-sm font-semibold text-primary">
          Back to orders
        </Link>
      </div>
    );
  }

  const uid = userQ.data;
  const isBuyer = order.buyer_id === uid;
  const isSeller = order.seller_id === uid;
  const isMod = !!modQ.data;
  const counterparty = names.data?.[isBuyer ? order.seller_id : order.buyer_id] ?? "Trader";
  const live = order.status === "pending_payment" || order.status === "paid";

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-8 pt-2">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void navigate({ to: "/p2p/orders" })}
          className="grid h-9 w-9 place-items-center rounded-full press"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{order.ref}</h1>
          <p className="truncate text-[11px] text-muted-foreground">{counterparty}</p>
        </div>
      </header>

      <div className="space-y-4">
        <div className="space-y-4">
          {/* Escrow header */}
          <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                  statusTone(order.status),
                )}
              >
                {ORDER_STATUS_LABEL[order.status]}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-500">
                <Lock className="h-3 w-3" /> {ESCROW_LABEL[order.escrow_status]}
              </span>
              {order.status === "pending_payment" ? (
                <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-extrabold tabular-nums text-amber-500">
                  <Timer className="h-4 w-4" /> {formatCountdown(timeLeft)}
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Stat label={isBuyer ? "You buy" : "You sell"} value={`${fmtAmount(order.amount)} ${order.asset}`} />
              <Stat
                label="You pay / receive"
                value={formatCurrency(Number(order.total_fiat), fiat as never, { compact: false })}
              />
              <Stat
                label="Price"
                value={`${formatCurrency(Number(order.price_usd), fiat as never, { compact: false })} / ${order.asset}`}
              />
              <Stat label="Payment method" value={methodLabel} />
              <Stat label="Counterparty" value={counterparty} />
              <Stat label="Escrow reference" value={order.escrow_tx_hash ?? "—"} mono />
              {order.release_tx_hash ? (
                <Stat label="Release reference" value={order.release_tx_hash} mono />
              ) : null}
            </div>

            {order.payment_proof_url ? (
              <a
                href={order.payment_proof_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-semibold text-primary underline underline-offset-4"
              >
                View payment proof
              </a>
            ) : null}
          </div>

          {/* Actions */}
          <div className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Next step
            </h2>

            {isBuyer && order.status === "pending_payment" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Send {formatCurrency(Number(order.total_fiat), fiat as never, { compact: false })} via{" "}
                  {methodLabel}, then confirm below.
                </p>
                <Input
                  value={proof}
                  onChange={(e) => setProof(e.target.value)}
                  placeholder="Payment proof link (optional)"
                  className="h-11"
                />
                <Button
                  className="h-12 w-full rounded-full bg-emerald-500 text-base font-bold text-white hover:bg-emerald-500/90"
                  disabled={paid.isPending}
                  onClick={() => act(() => markPaid(id, proof || null), "Marked as paid")}
                >
                  I have paid
                </Button>
              </>
            ) : null}

            {isSeller && order.status === "paid" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Verify the money arrived in your {methodLabel} account, then release escrow.
                </p>
                <Button
                  className="h-12 w-full rounded-xl bg-emerald-500 text-base font-bold text-white hover:bg-emerald-500/90"
                  onClick={() => act(() => confirmReceived(id), "Escrow released to buyer")}
                >
                  <Check className="mr-1.5 h-4 w-4" /> Payment received — release crypto
                </Button>
              </>
            ) : null}

            {isSeller && order.status === "pending_payment" ? (
              <p className="text-sm text-muted-foreground">
                Waiting for the buyer to pay. You can cancel once the timer expires.
              </p>
            ) : null}
            {isBuyer && order.status === "paid" ? (
              <p className="text-sm text-muted-foreground">
                Waiting for the seller to confirm your payment.
              </p>
            ) : null}

            {live ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => act(() => cancelOrder(id), "Order cancelled")}
                >
                  <X className="mr-1.5 h-4 w-4" /> Cancel order
                </Button>
                {!disputeQ.data ? (
                  <div className="flex w-full gap-2">
                    <Input
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Reason for dispute"
                      className="h-10"
                    />
                    <Button
                      variant="outline"
                      className="shrink-0 rounded-xl border-rose-500/40 text-rose-500"
                      disabled={disputeReason.trim().length < 4}
                      onClick={() =>
                        act(() => openDispute(id, disputeReason.trim()), "Dispute opened")
                      }
                    >
                      <AlertTriangle className="mr-1.5 h-4 w-4" /> Dispute
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {order.status === "completed" ? (
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-500">
                <ShieldCheck className="h-4 w-4" /> Trade completed — escrow released.
              </p>
            ) : null}
          </div>

          {/* Dispute / moderator */}
          {disputeQ.data ? (
            <div className="space-y-3 rounded-3xl border border-rose-500/30 bg-rose-500/5 p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-rose-500">Dispute</h2>
              <p className="text-sm">{disputeQ.data.reason}</p>
              <p className="text-xs text-muted-foreground">
                Status: {disputeQ.data.status}
                {disputeQ.data.resolution ? ` · ${disputeQ.data.resolution}` : ""}
              </p>
              {isMod && order.status === "disputed" ? (
                <div className="space-y-2">
                  <Input
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Resolution note"
                    className="h-10"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-500/90"
                      onClick={() =>
                        act(
                          () => resolveDispute(id, true, resolution || "Released to buyer"),
                          "Escrow released to buyer",
                        )
                      }
                    >
                      Release to buyer
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() =>
                        act(
                          () => resolveDispute(id, false, resolution || "Refunded to seller"),
                          "Escrow refunded to seller",
                        )
                      }
                    >
                      Refund seller
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Chat */}
        <div className="flex h-[32rem] flex-col rounded-3xl border border-border/60 bg-card/70">
          <div className="border-b border-border/60 px-5 py-3 text-sm font-bold">
            Trade chat · {counterparty}
          </div>
          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {(msgQ.data ?? []).map((m) =>
              m.is_system ? (
                <p
                  key={m.id}
                  className="mx-auto w-fit rounded-full bg-muted/70 px-3 py-1 text-center text-[11px] text-muted-foreground"
                >
                  {m.body}
                </p>
              ) : (
                <div
                  key={m.id}
                  className={cn("flex", m.sender_id === uid ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
                      m.sender_id === uid
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {m.body}
                    {m.image_url ? (
                      <img src={m.image_url} alt="Attachment" className="mt-2 rounded-lg" />
                    ) : null}
                  </div>
                </div>
              ),
            )}
          </div>
          <form
            className="flex items-center gap-2 border-t border-border/60 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const body = draft.trim();
              if (!body) return;
              setDraft("");
              void sendMessage(id, uid, body)
                .then(() => qc.invalidateQueries({ queryKey: ["p2p-msgs", id] }))
                .catch((err: Error) => toast.error(err.message));
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message or paste a receipt link…"
              className="h-11"
            />
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-xl">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/40 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("truncate text-sm font-bold", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}
