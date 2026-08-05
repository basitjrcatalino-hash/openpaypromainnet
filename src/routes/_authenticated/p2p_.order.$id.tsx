import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Copy,
  Headphones,
  ImagePlus,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Send,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MerchantAvatar, P2pAssetIcon } from "@/components/p2p/P2pUi";
import { P2pPayChip } from "@/components/p2p/P2pPayIcon";
import { P2pRateTradeCard } from "@/components/p2p/P2pRateTradeCard";
import { P2pTradeCompleteOverlay } from "@/components/p2p/P2pTradeCompleteOverlay";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
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
  const [view, setView] = useState<"order" | "chat">("order");
  const [noticeOpen, setNoticeOpen] = useState(true);
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
        .select("user_id, terms")
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

  function chatSenderRole(
    senderId: string | null | undefined,
  ): "merchant" | "customer" | "support" {
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
        !!order?.released_at && Date.now() - new Date(order.released_at).getTime() < 3 * 60_000;
      if ((justCompleted || recent) && !sessionStorage.getItem(seenKey)) {
        setCelebrate(true);
        sessionStorage.setItem(seenKey, "1");
      }
    }
    prevStatusRef.current = status;
  }, [order?.status, order?.released_at, id]);

  const timeLeft = order ? new Date(order.expires_at).getTime() - now : 0;
  const paymentExpired = order?.status === "pending_payment" && timeLeft <= 0;
  useEffect(() => {
    if (!paymentExpired) return;
    void expireOrders()
      .then(() => qc.invalidateQueries({ queryKey: ["p2p-order", id] }))
      .catch(() => {});
  }, [paymentExpired, id, qc]);

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
        notifySuccess(ok, { sound: opts?.celebrate ? "success" : "paid" });
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
      notifySuccess("Payment proof uploaded", { sound: "notify" });
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
        <p className="text-sm text-muted-foreground">
          Order not found or you don&apos;t have access.
        </p>
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
  const sellerDeadlineMs = order.paid_at ? new Date(order.paid_at).getTime() + payWindowMs : 0;
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

  const countdownMs =
    order.status === "pending_payment" ? timeLeft : order.status === "paid" ? sellerTimeLeft : 0;
  const progressFilled =
    order.status === "completed" ? 3 : order.status === "paid" || order.status === "disputed" ? 2 : 1;
  const statusTitle =
    order.status === "pending_payment"
      ? "Order generated. Pending payment."
      : order.status === "paid"
        ? "Waiting for seller release"
        : order.status === "completed"
          ? "Trade completed"
          : order.status === "disputed"
            ? "Order in dispute"
            : order.status === "cancelled"
              ? "Order cancelled"
              : "Order status";
  const fiatAmount = formatCurrency(Number(order.total_fiat), fiat as never, { compact: false });
  const priceLabel = formatCurrency(Number(order.price_usd), fiat as never, { compact: false });
  const orderTime = new Date(order.created_at).toLocaleString();

  if (view === "chat") {
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col bg-background"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-3">
          <button
            type="button"
            onClick={() => setView("order")}
            className="grid h-9 w-9 place-items-center rounded-full press"
            aria-label="Back to order"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[15px] font-extrabold tracking-tight">{counterparty}</p>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#11C66D]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#11C66D]" />
                Online
              </span>
            </div>
          </div>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full press"
            aria-label="More"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </header>

        {noticeOpen ? (
          <div className="flex items-start gap-2 bg-amber-400/90 px-3 py-2.5 text-[12px] font-semibold leading-snug text-black">
            <p className="min-w-0 flex-1">
              Do not share your contact information in the chat. All communication should stay in
              this trade room for your protection.
            </p>
            <button
              type="button"
              onClick={() => setNoticeOpen(false)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full press"
              aria-label="Dismiss notice"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-2.5">
          <p className="min-w-0 truncate text-[13px] font-bold">{statusTitle}</p>
          {live ? (
            <p className="shrink-0 text-[13px] font-extrabold tabular-nums text-teal-500">
              {countdownMs > 0 ? formatCountdown(countdownMs) : "00:00"}
            </p>
          ) : null}
        </div>

        <div ref={scroller} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
          {(msgQ.data ?? []).map((m) =>
            m.is_system ? (
              <div key={m.id} className="flex justify-center px-4">
                <p className="rounded-lg bg-muted/60 px-2.5 py-1 text-center text-[10px] leading-snug text-muted-foreground">
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
                    : (names.data?.[m.sender_id ?? ""] ?? roleMeta.label);
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
                        "max-w-[82%] rounded-xl px-3 py-2 text-[13px] leading-snug",
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
          className="flex items-center gap-2 border-t border-border/40 px-3 py-2.5"
          style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom, 0px))" }}
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
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Enter message"
            className="h-11 flex-1 rounded-full border-0 bg-muted/50 px-4 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-foreground/15"
            disabled={chatUploading}
          />
          <button
            type="button"
            disabled={chatUploading}
            onClick={() => chatImageRef.current?.click()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border/60 bg-background press disabled:opacity-60"
            aria-label="Upload image"
          >
            {chatUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </button>
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full bg-[#11C66D] text-white hover:bg-[#0FB461]"
            disabled={chatUploading || !draft.trim()}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
      <header
        className="sticky top-0 z-20 border-b border-border/40 bg-background/95 px-3 backdrop-blur-xl"
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
          <div className="flex flex-1 items-center gap-1.5 px-1">
            {[1, 2, 3].map((step) => (
              <span
                key={step}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  step <= progressFilled ? "bg-[#11C66D]" : "bg-muted",
                )}
              />
            ))}
          </div>
          <Link
            to="/p2p/support"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground press"
            aria-label="Support"
          >
            <Headphones className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="space-y-5 px-4 pt-5">
        <div className="text-center">
          <h1 className="text-[18px] font-extrabold leading-snug tracking-tight">{statusTitle}</h1>
          {live ? (
            <div className="mt-3 flex justify-center">
              <TimerBoxes ms={countdownMs} />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-3">
          <MerchantAvatar name={counterparty} size="md" online />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-[14px] font-extrabold">{counterparty}</p>
              <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            </div>
            <p className="text-[11px] text-muted-foreground">Merchant</p>
          </div>
          <button
            type="button"
            onClick={() => setView("chat")}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-[12px] font-bold text-background press"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </button>
        </div>

        <div className="space-y-0 divide-y divide-border/40 text-[13px]">
          <DetailRow label="Transaction type">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <P2pAssetIcon asset={order.asset} className="h-5 w-5" />
              {isBuyer ? `Buy ${order.asset}` : `Sell ${order.asset}`}
            </span>
          </DetailRow>
          <DetailRow label="Trading amount">
            <button
              type="button"
              className="inline-flex items-center gap-1 font-bold tabular-nums"
              onClick={() => void copyField("Trading amount", String(order.total_fiat))}
            >
              {fiatAmount}
              <Copy className="h-3 w-3 text-muted-foreground" />
            </button>
          </DetailRow>
          <DetailRow label="Price">
            <span className="font-bold tabular-nums">
              {priceLabel}/{order.asset}
            </span>
          </DetailRow>
          <DetailRow label="Quantity">
            <span className="font-bold tabular-nums">
              {fmtAmount(order.amount)} {order.asset}
            </span>
          </DetailRow>
          <DetailRow label="Fee">
            <span className="font-bold tabular-nums">0 {order.asset}</span>
          </DetailRow>
          <DetailRow label="Payment methods">
            {methodCode ? (
              <P2pPayChip code={methodCode} label={methodName} />
            ) : (
              <span className="font-bold">{methodLabel || "—"}</span>
            )}
          </DetailRow>
          <DetailRow label="Real name">
            <span className="font-bold">{paySnap?.account_name || "—"}</span>
          </DetailRow>
          <DetailRow label="Order No">
            <button
              type="button"
              className="inline-flex items-center gap-1 font-mono text-[12px] font-bold"
              onClick={() => void copyField("Order No", order.ref)}
            >
              {order.ref}
              <Copy className="h-3 w-3 text-muted-foreground" />
            </button>
          </DetailRow>
          <DetailRow label="Order time">
            <span className="font-bold tabular-nums">{orderTime}</span>
          </DetailRow>
        </div>

        {paySnap && isBuyer && order.status === "pending_payment" ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[12px] font-bold text-foreground">Pay to</h2>
              {methodCode ? <P2pPayChip code={methodCode} label={methodName} /> : null}
            </div>
            <p className="mb-2 text-[12px] text-muted-foreground">
              Transfer exactly {fiatAmount}, then upload proof and confirm.
            </p>
            <div className="overflow-hidden rounded-xl border border-border/50">
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
        ) : null}

        {!paySnap && isBuyer && order.status === "pending_payment" ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-[12px] font-semibold text-amber-500">
            Merchant receive details unavailable. Ask the seller in chat.
          </div>
        ) : null}

        {order.payment_proof_url ? (
          <a
            href={order.payment_proof_url}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-xl border border-border/50"
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

        {isBuyer && order.status === "pending_payment" ? (
          <div className="space-y-3">
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
              <div className="relative overflow-hidden rounded-xl border border-border/50 bg-muted/20">
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
                className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/70 bg-muted/15 text-[13px] font-semibold text-muted-foreground press hover:bg-muted/30 disabled:opacity-60"
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
          </div>
        ) : null}

        {isBuyer && order.status === "paid" ? (
          <div className="rounded-xl bg-[#11C66D]/10 px-3 py-3 text-[12px] font-semibold text-[#11C66D]">
            Payment submitted — waiting for seller to release crypto
            {sellerTimeLeft > 0
              ? ` · confirm window ${formatCountdown(sellerTimeLeft)}`
              : " · confirm window ended — you may cancel or open a dispute"}
            .
          </div>
        ) : null}

        {live ? (
          <div className="space-y-2">
            {waitingForResponse && !canCancel ? (
              <p className="text-center text-[11px] text-muted-foreground">
                Cancel order appears after the countdown if there is no response.
              </p>
            ) : null}
            {canCancel ? (
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl border-border/60 text-[13px] font-bold"
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
                  className="h-10 rounded-xl text-[13px]"
                />
                <Button
                  variant="outline"
                  className="h-10 shrink-0 rounded-xl border-[#F04438]/40 text-[13px] font-bold text-[#F04438]"
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
            <div className="flex items-start gap-3 rounded-xl border border-[#11C66D]/25 bg-[#11C66D]/8 px-3 py-3">
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
                  <span className="font-bold text-foreground">{fiatAmount}</span>
                </p>
              </div>
            </div>
            <P2pRateTradeCard orderId={id} counterpartyName={counterparty} />
          </div>
        ) : null}

        {disputeQ.data ? (
          <div className="space-y-3 rounded-xl border border-[#F04438]/25 px-3 py-3">
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
                  className="h-10 rounded-xl"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="h-10 rounded-xl bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]"
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
                    className="h-10 rounded-xl font-bold"
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

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/40 bg-background/95 px-4 pt-3 backdrop-blur-xl"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
          {isBuyer && order.status === "pending_payment" ? (
            <Button
              className="h-12 w-full rounded-xl bg-[#11C66D] text-base font-bold text-white hover:bg-[#0FB461]"
              disabled={paid.isPending || proofUploading}
              onClick={() => act(() => markPaid(id, proofUrl || null), "Marked as paid")}
            >
              {paid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "I have paid"}
            </Button>
          ) : null}

          {isSeller && order.status === "pending_payment" ? (
            <Button
              disabled
              className="h-12 w-full rounded-xl bg-muted text-base font-bold text-muted-foreground disabled:opacity-100"
            >
              The buyer is paying
            </Button>
          ) : null}

          {isSeller && order.status === "paid" ? (
            <Button
              className="h-12 w-full rounded-xl bg-[#11C66D] text-base font-bold text-white hover:bg-[#0FB461]"
              onClick={() =>
                act(() => confirmReceived(id), "Escrow released to buyer", { celebrate: true })
              }
            >
              <Check className="mr-1.5 h-4 w-4" /> Payment received — release crypto
            </Button>
          ) : null}

          {isBuyer && order.status === "paid" ? (
            <div className="rounded-xl bg-muted/50 px-3 py-3 text-center text-[12px] font-semibold text-muted-foreground">
              Waiting for seller to release crypto
            </div>
          ) : null}

          <Link
            to="/p2p/support"
            className="inline-flex items-center justify-center gap-1.5 py-1 text-[12px] font-semibold text-muted-foreground press"
          >
            <Headphones className="h-3.5 w-3.5" />
            Contact support
          </Link>
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

function TimerBoxes({ ms }: { ms: number }) {
  const t = ms > 0 ? formatCountdown(ms) : "00:00";
  const [a, b] = t.split(":");
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="grid min-w-11 place-items-center rounded-lg bg-muted px-2.5 py-2 text-[20px] font-extrabold tabular-nums tracking-tight">
        {a ?? "00"}
      </span>
      <span className="text-[18px] font-extrabold text-muted-foreground">:</span>
      <span className="grid min-w-11 place-items-center rounded-lg bg-muted px-2.5 py-2 text-[20px] font-extrabold tabular-nums tracking-tight">
        {b ?? "00"}
      </span>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <div className="min-w-0 text-right">{children}</div>
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
