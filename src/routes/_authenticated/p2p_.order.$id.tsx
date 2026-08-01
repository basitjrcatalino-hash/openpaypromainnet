import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Copy,
  ImagePlus,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
  Timer,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { P2pPayChip } from "@/components/p2p/P2pPayIcon";
import { P2pRateTradeCard } from "@/components/p2p/P2pRateTradeCard";
import { P2pTradeCompleteOverlay } from "@/components/p2p/P2pTradeCompleteOverlay";
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
  parsePaymentSnapshot,
  resolveDispute,
  sendMessage,
  statusTone,
} from "@/lib/p2p";
import { uploadMedia } from "@/lib/upload";
import { copyText } from "@/lib/clipboard";
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

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function isImageFile(file: File) {
  return IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

function TradeRoom() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { code: fiat } = useCurrency();
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [chatUploading, setChatUploading] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [resolution, setResolution] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const prevStatusRef = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const chatImageRef = useRef<HTMLInputElement>(null);

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
  const adQ = useQuery({
    queryKey: ["p2p-ad-owner", order?.ad_id],
    enabled: !!order?.ad_id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("p2p_ads")
        .select("user_id")
        .eq("id", order!.ad_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const names = useQuery({
    queryKey: ["p2p-names", order?.buyer_id, order?.seller_id],
    enabled: !!order,
    queryFn: () => fetchDisplayNames([order!.buyer_id, order!.seller_id]),
  });

  const merchantId = adQ.data?.user_id ?? null;

  function chatSenderRole(senderId: string | null | undefined): "merchant" | "customer" | "support" {
    if (!senderId || !order) return "support";
    if (merchantId) {
      if (senderId === merchantId) return "merchant";
      if (senderId === order.buyer_id || senderId === order.seller_id) return "customer";
      return "support";
    }
    // Ad owner still loading — provisional labels (most ads are sell offers).
    if (senderId === order.buyer_id) return "customer";
    if (senderId === order.seller_id) return "merchant";
    return "support";
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [msgQ.data?.length]);

  // Celebrate when the trade flips to completed (buyer or seller).
  useEffect(() => {
    const status = order?.status ?? null;
    const prev = prevStatusRef.current;
    if (status === "completed") {
      const seenKey = `p2p-celebrate-${id}`;
      const justCompleted = prev != null && prev !== "completed";
      const recent =
        !!order?.released_at &&
        Date.now() - new Date(order.released_at).getTime() < 3 * 60_000;
      if ((justCompleted || recent) && !sessionStorage.getItem(seenKey)) {
        setCelebrate(true);
        sessionStorage.setItem(seenKey, "1");
      }
    }
    prevStatusRef.current = status;
  }, [order?.status, order?.released_at, id]);

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
  const act = (fn: () => Promise<unknown>, ok: string, opts?: { celebrate?: boolean }) =>
    fn()
      .then(() => {
        toast.success(ok);
        if (opts?.celebrate) {
          sessionStorage.setItem(`p2p-celebrate-${id}`, "1");
          setCelebrate(true);
        }
        refresh();
      })
      .catch((e: Error) => toast.error(e.message));

  const paid = useMutation({ mutationFn: () => markPaid(id, proofUrl || null) });
  const methodName = useMemo(() => {
    const m = (methodsQ.data ?? []).find((x) => x.code === order?.payment_method);
    return m?.name ?? order?.payment_method ?? "";
  }, [methodsQ.data, order?.payment_method]);
  const methodCode = order?.payment_method ?? "";
  const methodLabel = methodName;

  async function uploadProofImage(file: File) {
    if (!userQ.data) return;
    if (!isImageFile(file)) {
      toast.error("Please upload a JPG, PNG, WEBP, or GIF image");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be under 8 MB");
      return;
    }
    setProofUploading(true);
    try {
      const local = URL.createObjectURL(file);
      setProofPreview((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return local;
      });
      const url = await uploadMedia(file, userQ.data, `p2p/${id}/proof`);
      setProofUrl(url);
      toast.success("Payment proof uploaded");
    } catch (e) {
      toast.error((e as Error).message || "Upload failed");
      setProofPreview(null);
      setProofUrl(null);
    } finally {
      setProofUploading(false);
    }
  }

  async function uploadChatImage(file: File) {
    if (!userQ.data) return;
    if (!isImageFile(file)) {
      toast.error("Please upload a JPG, PNG, WEBP, or GIF image");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be under 8 MB");
      return;
    }
    setChatUploading(true);
    try {
      const url = await uploadMedia(file, userQ.data, `p2p/${id}/chat`);
      await sendMessage(id, userQ.data, draft.trim(), url);
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["p2p-msgs", id] });
      toast.success("Image sent");
    } catch (e) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setChatUploading(false);
    }
  }

  function clearProof() {
    setProofPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setProofUrl(null);
    if (proofInputRef.current) proofInputRef.current.value = "";
  }

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
  const paySnap = parsePaymentSnapshot(order.payment_account_snapshot);
  // Seller confirm window = same length as the original pay window (min 5m).
  const payWindowMs = Math.max(
    5 * 60_000,
    new Date(order.expires_at).getTime() - new Date(order.created_at).getTime(),
  );
  const sellerDeadlineMs = order.paid_at
    ? new Date(order.paid_at).getTime() + payWindowMs
    : 0;
  const sellerTimeLeft = sellerDeadlineMs > 0 ? sellerDeadlineMs - now : 0;
  const payTimerEnded = order.status === "pending_payment" && timeLeft <= 0;
  const sellerTimerEnded = order.status === "paid" && sellerTimeLeft <= 0;
  const canCancel = payTimerEnded || sellerTimerEnded;
  const waitingForResponse =
    (order.status === "pending_payment" && timeLeft > 0) ||
    (order.status === "paid" && sellerTimeLeft > 0);

  async function copyField(label: string, value: string) {
    try {
      await copyText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="mx-auto w-full pb-8">
      {/* OKX-style sticky trade header */}
      <header
        className="sticky top-0 z-20 border-b border-border/40 bg-background/95 px-4 backdrop-blur-xl md:px-6"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex h-12 items-center gap-2">
          <button
            type="button"
            onClick={() => void navigate({ to: "/p2p/orders" })}
            className="grid h-9 w-9 place-items-center rounded-full press"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-extrabold tracking-tight">{order.ref}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {isBuyer ? "Buying from" : "Selling to"} {counterparty}
            </p>
          </div>
          {order.status === "pending_payment" ? (
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Pay within
              </p>
              <p
                className={cn(
                  "inline-flex items-center gap-1 text-lg font-extrabold tabular-nums leading-none",
                  timeLeft < 60_000 ? "text-[#F04438]" : "text-amber-500",
                )}
              >
                <Timer className="h-4 w-4" />
                {timeLeft > 0 ? formatCountdown(timeLeft) : "00:00"}
              </p>
            </div>
          ) : order.status === "paid" ? (
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Seller confirm
              </p>
              <p
                className={cn(
                  "inline-flex items-center gap-1 text-lg font-extrabold tabular-nums leading-none",
                  sellerTimeLeft < 60_000 ? "text-[#F04438]" : "text-amber-500",
                )}
              >
                <Timer className="h-4 w-4" />
                {sellerTimeLeft > 0 ? formatCountdown(sellerTimeLeft) : "00:00"}
              </p>
            </div>
          ) : null}
        </div>
      </header>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
        <div className="space-y-0 divide-y divide-border/40 border-b border-border/40 lg:border-b-0 lg:border-r">
          {/* Status strip */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-6">
            <span
              className={cn(
                "rounded-[4px] border px-2 py-0.5 text-[11px] font-bold",
                statusTone(order.status),
              )}
            >
              {ORDER_STATUS_LABEL[order.status]}
            </span>
            <span className="inline-flex items-center gap-1 rounded-[4px] border border-[#11C66D]/25 bg-[#11C66D]/10 px-2 py-0.5 text-[11px] font-bold text-[#11C66D]">
              <Lock className="h-3 w-3" /> {ESCROW_LABEL[order.escrow_status]}
            </span>
            {methodCode ? (
              <span className="ml-auto">
                <P2pPayChip code={methodCode} label={methodName} />
              </span>
            ) : null}
          </div>

          {/* Hero amounts — OKX dominant signal */}
          <div className="px-4 py-4 md:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {isBuyer ? "You buy" : "You sell"}
            </p>
            <p className="mt-1 text-[28px] font-extrabold leading-none tabular-nums tracking-tight">
              {fmtAmount(order.amount)}{" "}
              <span className="text-lg font-bold text-muted-foreground">{order.asset}</span>
            </p>
            <p className="mt-2 text-sm font-semibold tabular-nums text-muted-foreground">
              {isBuyer ? "You pay" : "You receive"}{" "}
              <span className="text-foreground">
                {formatCurrency(Number(order.total_fiat), fiat as never, { compact: false })}
              </span>
              <span className="mx-1.5 text-border">·</span>
              {formatCurrency(Number(order.price_usd), fiat as never, { compact: false })}/{order.asset}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
              <div className="flex justify-between gap-2 border-b border-border/30 py-1.5">
                <span className="text-muted-foreground">Counterparty</span>
                <span className="font-semibold">{counterparty}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-border/30 py-1.5">
                <span className="text-muted-foreground">Order</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold"
                  onClick={() => void copyField("Order ref", order.ref)}
                >
                  {order.ref.slice(-8)}
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
              {order.escrow_tx_hash ? (
                <div className="col-span-2 flex justify-between gap-2 border-b border-border/30 py-1.5">
                  <span className="text-muted-foreground">Escrow ref</span>
                  <button
                    type="button"
                    className="inline-flex max-w-[60%] items-center gap-1 truncate font-mono text-[11px] font-semibold"
                    onClick={() => void copyField("Escrow ref", order.escrow_tx_hash!)}
                  >
                    <span className="truncate">{order.escrow_tx_hash}</span>
                    <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                </div>
              ) : null}
            </div>

            {order.payment_proof_url ? (
              <a
                href={order.payment_proof_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block overflow-hidden rounded-[8px] border border-border/50"
              >
                <img
                  src={order.payment_proof_url}
                  alt="Payment proof"
                  className="max-h-48 w-full object-contain bg-muted/30"
                />
                <span className="block bg-muted/20 px-3 py-2 text-[11px] font-bold text-[#11C66D]">
                  View payment proof
                </span>
              </a>
            ) : null}
          </div>

          {/* Payment account — OKX pay-to block */}
          {paySnap ? (
            <div className="px-4 py-4 md:px-6">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-[#11C66D]">
                  {isBuyer ? "Pay to this account" : "Your receive account"}
                </h2>
                {methodCode ? <P2pPayChip code={methodCode} label={methodName} /> : null}
              </div>
              <p className="mb-3 text-[12px] text-muted-foreground">
                {isBuyer
                  ? `Transfer exactly ${formatCurrency(Number(order.total_fiat), fiat as never, { compact: false })} then upload proof.`
                  : "Buyer will send fiat to these details."}
              </p>
              <div className="overflow-hidden rounded-[8px] border border-border/50">
                <SnapRow
                  label="Name"
                  value={paySnap.account_name}
                  onCopy={() => void copyField("Account name", paySnap.account_name)}
                />
                <SnapRow
                  label="Account"
                  value={paySnap.account_number}
                  mono
                  onCopy={() => void copyField("Account number", paySnap.account_number)}
                />
                {paySnap.bank_name ? (
                  <SnapRow
                    label="Bank"
                    value={paySnap.bank_name}
                    onCopy={() => void copyField("Bank", paySnap.bank_name!)}
                  />
                ) : null}
              </div>
            </div>
          ) : isBuyer && order.status === "pending_payment" ? (
            <div className="mx-4 my-3 rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-[12px] font-semibold text-amber-500 md:mx-6">
              Merchant receive details unavailable. Ask the seller in chat.
            </div>
          ) : null}

          {/* Actions */}
          <div className="space-y-3 px-4 py-4 md:px-6">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Next step
            </h2>

            {isBuyer && order.status === "pending_payment" ? (
              <>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Pay via{" "}
                  {methodCode ? (
                    <P2pPayChip code={methodCode} label={methodName} className="inline-flex align-middle" />
                  ) : (
                    methodLabel
                  )}
                  {paySnap ? ` to ${paySnap.account_name}` : ""}, then confirm below.
                </p>

                <input
                  ref={proofInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadProofImage(f);
                  }}
                />

                {proofPreview || proofUrl ? (
                  <div className="relative overflow-hidden rounded-[8px] border border-border/50 bg-muted/20">
                    <img
                      src={proofPreview || proofUrl || ""}
                      alt="Payment proof preview"
                      className="max-h-44 w-full object-contain"
                    />
                    <div className="flex items-center justify-between gap-2 border-t border-border/40 px-3 py-2">
                      <p className="truncate text-[11px] font-semibold text-muted-foreground">
                        {proofUploading ? "Uploading…" : "Proof ready"}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          disabled={proofUploading}
                          onClick={() => proofInputRef.current?.click()}
                        >
                          Replace
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={proofUploading}
                          onClick={clearProof}
                          aria-label="Remove proof"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={proofUploading}
                    onClick={() => proofInputRef.current?.click()}
                    className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-border/70 bg-muted/15 text-[13px] font-semibold text-muted-foreground press hover:bg-muted/30 disabled:opacity-60"
                  >
                    {proofUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-5 w-5" />
                    )}
                    {proofUploading ? "Uploading…" : "Upload payment proof"}
                    <span className="text-[10px] font-medium opacity-70">JPG · PNG · max 8 MB</span>
                  </button>
                )}

                <Button
                  className="h-12 w-full rounded-[8px] bg-[#11C66D] text-base font-bold text-white hover:bg-[#0FB461]"
                  disabled={paid.isPending || proofUploading}
                  onClick={() => act(() => markPaid(id, proofUrl || null), "Marked as paid")}
                >
                  {paid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "I have paid"}
                </Button>
              </>
            ) : null}

            {isSeller && order.status === "paid" ? (
              <>
                <p className="text-[12px] text-muted-foreground">
                  Verify funds arrived in your {methodLabel} account, then release escrow.
                </p>
                <Button
                  className="h-12 w-full rounded-[8px] bg-[#11C66D] text-base font-bold text-white hover:bg-[#0FB461]"
                  onClick={() =>
                    act(() => confirmReceived(id), "Escrow released to buyer", { celebrate: true })
                  }
                >
                  <Check className="mr-1.5 h-4 w-4" /> Payment received — release crypto
                </Button>
              </>
            ) : null}

            {isSeller && order.status === "pending_payment" ? (
              <div className="rounded-[8px] bg-muted/30 px-3 py-3 text-[12px] text-muted-foreground">
                Waiting for buyer payment.
                {timeLeft > 0
                  ? ` Cancel unlocks when the timer ends (${formatCountdown(timeLeft)}).`
                  : " Timer ended — you can cancel if there is no response."}
              </div>
            ) : null}
            {isBuyer && order.status === "paid" ? (
              <div className="rounded-[8px] bg-[#11C66D]/10 px-3 py-3 text-[12px] font-semibold text-[#11C66D]">
                Payment submitted — waiting for seller to release crypto
                {sellerTimeLeft > 0
                  ? ` · confirm window ${formatCountdown(sellerTimeLeft)}`
                  : " · confirm window ended — you may cancel or open a dispute"}.
              </div>
            ) : null}

            {live ? (
              <div className="space-y-2 pt-1">
                {waitingForResponse && !canCancel ? (
                  <p className="text-center text-[11px] text-muted-foreground">
                    Cancel order appears after the countdown if there is no response.
                  </p>
                ) : null}
                {canCancel ? (
                  <Button
                    variant="outline"
                    className="h-10 w-full rounded-[8px] border-border/60 text-[13px] font-bold"
                    onClick={() => act(() => cancelOrder(id), "Order cancelled")}
                  >
                    <X className="mr-1.5 h-4 w-4" /> Cancel order
                  </Button>
                ) : null}
                {!disputeQ.data && (order.status === "paid" || canCancel) ? (
                  <div className="flex gap-2">
                    <Input
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Reason for dispute"
                      className="h-10 rounded-[8px] text-[13px]"
                    />
                    <Button
                      variant="outline"
                      className="h-10 shrink-0 rounded-[8px] border-[#F04438]/40 text-[13px] font-bold text-[#F04438]"
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
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-[8px] border border-[#11C66D]/25 bg-[#11C66D]/8 px-3 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#11C66D]/20">
                    <ShieldCheck className="h-5 w-5 text-[#11C66D]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold text-[#11C66D]">Trade verified</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      You {isBuyer ? "bought" : "sold"}{" "}
                      <span className="font-bold text-foreground">
                        {fmtAmount(order.amount)} {order.asset}
                      </span>
                      {" · "}
                      {isBuyer ? "paid" : "received"}{" "}
                      <span className="font-bold text-foreground">
                        {formatCurrency(Number(order.total_fiat), fiat as never, { compact: false })}
                      </span>
                    </p>
                  </div>
                </div>
                <P2pRateTradeCard orderId={id} counterpartyName={counterparty} />
              </div>
            ) : null}
          </div>

          {disputeQ.data ? (
            <div className="space-y-3 px-4 py-4 md:px-6">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-[#F04438]">Dispute</h2>
              <p className="text-[13px]">{disputeQ.data.reason}</p>
              <p className="text-[11px] text-muted-foreground">
                Status: {disputeQ.data.status}
                {disputeQ.data.resolution ? ` · ${disputeQ.data.resolution}` : ""}
              </p>
              {isMod && order.status === "disputed" ? (
                <div className="space-y-2">
                  <Input
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Resolution note"
                    className="h-10 rounded-[8px]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="h-10 rounded-[8px] bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]"
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
                      className="h-10 rounded-[8px] font-bold"
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

        {/* Chat — denser OKX-style panel */}
        <div className="flex h-[min(28rem,65dvh)] flex-col bg-background lg:sticky lg:top-12 lg:h-[calc(100dvh-3rem)]">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
            <div>
              <p className="text-[13px] font-extrabold">Trade chat</p>
              <p className="text-[11px] text-muted-foreground">{counterparty}</p>
            </div>
            <div className="flex gap-2 text-[9px] font-bold uppercase tracking-wide">
              <span className="text-amber-500">● Merch</span>
              <span className="text-sky-400">● Cust</span>
              <span className="text-violet-400">● Support</span>
            </div>
          </div>
          <div ref={scroller} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
            {(msgQ.data ?? []).map((m) =>
              m.is_system ? (
                <div key={m.id} className="flex justify-center px-4">
                  <p className="rounded-[4px] bg-muted/60 px-2.5 py-1 text-center text-[10px] leading-snug text-muted-foreground">
                    {m.body}
                  </p>
                </div>
              ) : (
                (() => {
                  const mine = m.sender_id === uid;
                  const role = chatSenderRole(m.sender_id);
                  const roleMeta =
                    role === "merchant"
                      ? { label: "Merchant", className: "text-amber-500" }
                      : role === "customer"
                        ? { label: "Customer", className: "text-sky-400" }
                        : { label: "Support", className: "text-violet-400" };
                  const displayName =
                    role === "support"
                      ? "Support"
                      : names.data?.[m.sender_id ?? ""] ?? roleMeta.label;
                  return (
                    <div
                      key={m.id}
                      className={cn("flex flex-col gap-0.5", mine ? "items-end" : "items-start")}
                    >
                      <div
                        className={cn(
                          "flex max-w-[82%] items-center gap-1 px-1 text-[9px] font-bold uppercase tracking-wide",
                          mine ? "flex-row-reverse" : "flex-row",
                          roleMeta.className,
                        )}
                      >
                        <span>{roleMeta.label}</span>
                        <span className="font-semibold normal-case tracking-normal text-muted-foreground">
                          · {mine ? "You" : displayName}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "max-w-[82%] rounded-[8px] px-3 py-2 text-[13px] leading-snug",
                          mine
                            ? "bg-[#11C66D] text-white"
                            : role === "support"
                              ? "border border-violet-500/30 bg-violet-500/10 text-foreground"
                              : "bg-muted/70 text-foreground",
                        )}
                      >
                        {m.body && m.body !== "📷 Image" ? m.body : null}
                        {m.image_url ? (
                          <a href={m.image_url} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={m.image_url}
                              alt="Attachment"
                              className={cn(
                                "mt-1 max-h-44 rounded-[6px] object-cover",
                                m.body && m.body !== "📷 Image" && "mt-2",
                              )}
                            />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })()
              ),
            )}
          </div>
          <form
            className="flex items-center gap-1.5 border-t border-border/40 px-2 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              const body = draft.trim();
              if (!body || chatUploading) return;
              setDraft("");
              void sendMessage(id, uid, body)
                .then(() => qc.invalidateQueries({ queryKey: ["p2p-msgs", id] }))
                .catch((err: Error) => toast.error(err.message));
            }}
          >
            <input
              ref={chatImageRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadChatImage(f);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-[8px]"
              disabled={chatUploading}
              onClick={() => chatImageRef.current?.click()}
              aria-label="Upload image"
            >
              {chatUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
            </Button>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message…"
              className="h-10 rounded-[8px] border-0 bg-muted/40 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-foreground/15"
              disabled={chatUploading}
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-[8px] bg-[#11C66D] text-white hover:bg-[#0FB461]"
              disabled={chatUploading || !draft.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      <P2pTradeCompleteOverlay
        open={celebrate}
        onClose={() => setCelebrate(false)}
        isBuyer={isBuyer}
        asset={order.asset}
        amount={order.amount}
        totalFiat={Number(order.total_fiat)}
        fiatCode={fiat}
        counterparty={counterparty}
      />
    </div>
  );
}

function SnapRow({
  label,
  value,
  mono,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/40 bg-muted/20 px-3 py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("truncate text-[13px] font-bold", mono && "font-mono text-xs")}>{value}</p>
      </div>
      <button
        type="button"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] text-muted-foreground press hover:bg-muted/50"
        onClick={onCopy}
        aria-label={`Copy ${label}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
