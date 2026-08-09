import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  BadgeCheck,
  ChevronLeft,
  ImagePlus,
  Loader2,
  LifeBuoy,
  ShieldAlert,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/upload";
import { OPENPAY_AI_AVATAR } from "@/lib/openpay-auth";
import {
  getSupportThread,
  sendSupportMessage,
  startSupportTicket,
} from "@/lib/support.functions";
import { getOpenPayLinkStatus } from "@/lib/openpay-pro.functions";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support Chat — OpenPay Pro Wallet" },
      {
        name: "description",
        content:
          "Get help from OpenPay Pro support. Chat with OpenPay AI instantly, attach screenshots and escalate to a human agent — your account details are attached automatically.",
      },
      { property: "og:title", content: "Support Chat — OpenPay Pro Wallet" },
      {
        property: "og:description",
        content: "Instant AI answers and live human support for your OpenPay Pro wallet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});

const CATEGORIES = [
  { id: "general", label: "General" },
  { id: "deposit", label: "Deposit" },
  { id: "withdrawal", label: "Withdrawal" },
  { id: "payment", label: "Payment / Top Up" },
  { id: "p2p", label: "P2P" },
  { id: "trade", label: "Trade" },
  { id: "kyc", label: "KYC" },
  { id: "security", label: "Security" },
  { id: "bug", label: "Bug report" },
] as const;

const QUICK = [
  "My deposit hasn't arrived yet",
  "How do I top up with a voucher?",
  "My P2P order is stuck in escrow",
  "I need help with KYC verification",
];

type Msg = {
  id: string;
  role: string;
  body: string;
  image_url: string | null;
  created_at: string;
};

function SupportPage() {
  const qc = useQueryClient();
  const start = useServerFn(startSupportTicket);
  const thread = useServerFn(getSupportThread);
  const send = useServerFn(sendSupportMessage);
  const linkStatus = useServerFn(getOpenPayLinkStatus);

  const [ticketId, setTicketId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("general");
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const threadQuery = useQuery({
    queryKey: ["support-thread", ticketId],
    enabled: Boolean(ticketId),
    queryFn: () => thread({ data: { ticketId: ticketId as string } }),
  });

  const ticket = threadQuery.data?.ticket;
  const messages = useMemo(() => (threadQuery.data?.messages ?? []) as Msg[], [threadQuery.data]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Live updates for admin replies
  useEffect(() => {
    if (!ticketId) return;
    const channel = supabase
      .channel(`support-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => void qc.invalidateQueries({ queryKey: ["support-thread", ticketId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ticketId, qc]);

  const openTicket = useMutation({
    mutationFn: async (cat: string) => {
      let openpayAccount: string | null = null;
      try {
        const link = (await linkStatus()) as { account_number?: string; username?: string };
        openpayAccount = link?.account_number ?? link?.username ?? null;
      } catch {
        openpayAccount = null;
      }
      return start({ data: { category: cat as never, openpay_account: openpayAccount } });
    },
    onSuccess: (res) => setTicketId(res.ticketId),
    onError: (e: Error) => toast.error(e.message || "Could not start a support chat"),
  });

  const sendMsg = useMutation({
    mutationFn: async (text: string) =>
      send({
        data: {
          ticketId: ticketId as string,
          body: text,
          image_url: pendingImage?.url ?? null,
        },
      }),
    onSuccess: () => {
      setPendingImage(null);
      void qc.invalidateQueries({ queryKey: ["support-thread", ticketId] });
    },
    onError: (e: Error) => toast.error(e.message || "Message failed to send"),
  });

  async function pickImage(file: File) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    setUploading(true);
    try {
      const url = await uploadMedia(file, data.user.id, "support");
      setPendingImage({ url, name: file.name });
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  function submit(text: string) {
    const value = text.trim();
    if ((!value && !pendingImage) || sendMsg.isPending) return;
    setInput("");
    sendMsg.mutate(value);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const busy = sendMsg.isPending;

  /* ---------------------------- intake ---------------------------- */
  if (!ticketId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-1 py-6">
        <header className="mb-6 flex items-center gap-3">
          <Link
            to="/dashboard"
            className="grid h-9 w-9 place-items-center rounded-full bg-muted/60 press"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">Support</h1>
        </header>

        <div className="rounded-3xl border border-border/60 bg-card/60 p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <LifeBuoy className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold">How can we help?</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            OpenPay AI answers instantly, 24/7. A human agent takes over whenever the issue needs
            one. Your username, OpenPay account, wallet address and KYC status are attached
            automatically.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-semibold press",
                  category === c.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/70 text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={openTicket.isPending}
            onClick={() => openTicket.mutate(category)}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground press disabled:opacity-50"
          >
            {openTicket.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Start support chat
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Never share your PIN, recovery phrase or private keys — support will never ask for them.
        </p>
      </div>
    );
  }

  /* ---------------------------- chat ---------------------------- */
  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-2xl flex-col md:h-[calc(100dvh-6rem)]">
      <header className="flex items-center gap-3 border-b border-border/60 pb-3">
        <button
          type="button"
          onClick={() => setTicketId(null)}
          className="grid h-9 w-9 place-items-center rounded-full bg-muted/60 press"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
          <LifeBuoy className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">OpenPay Pro Support</p>
          <p className="truncate text-xs text-muted-foreground">
            {ticket?.ai_enabled ? "OpenPay AI · replies instantly" : "Live agent · connected"}
            {ticket?.status ? ` · ${ticket.status}` : ""}
          </p>
        </div>
        {ticket?.kyc_status === "verified" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500">
            <BadgeCheck className="h-3.5 w-3.5" /> KYC
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" /> No KYC
          </span>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-5">
        {threadQuery.isLoading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : null}

        {messages.length === 0 && !threadQuery.isLoading ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Describe your issue and attach a screenshot if it helps.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => submit(q)}
                  className="rounded-2xl border border-border/70 bg-card/50 px-4 py-3 text-left text-sm font-medium hover:border-primary/50 press"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m) => {
          const mine = m.role === "user";
          return (
            <div key={m.id} className={cn("flex gap-3", mine && "justify-end")}>
              {!mine ? (
                <img
                  src={OPENPAY_AI_AVATAR}
                  alt=""
                  width={512}
                  height={512}
                  loading="lazy"
                  className="mt-0.5 h-7 w-7 shrink-0 rounded-[0.6rem] object-cover"
                />
              ) : null}
              <div className={cn("min-w-0", mine ? "max-w-[85%]" : "flex-1")}>
                {!mine ? (
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">
                    {m.role === "admin" ? "Support agent" : "OpenPay AI"}
                  </p>
                ) : null}
                {m.image_url ? (
                  <a href={m.image_url} target="_blank" rel="noreferrer">
                    <img
                      src={m.image_url}
                      alt="Attachment"
                      loading="lazy"
                      className="mb-2 max-h-64 rounded-2xl border border-border/60 object-cover"
                    />
                  </a>
                ) : null}
                {m.body ? (
                  mine ? (
                    <div className="rounded-3xl rounded-br-lg bg-primary px-4 py-2.5 text-sm font-medium leading-relaxed text-primary-foreground">
                      {m.body}
                    </div>
                  ) : (
                    <div className="prose-none text-[15px] leading-[1.75] text-foreground">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                          ul: ({ children }) => (
                            <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">
                              {children}
                            </ol>
                          ),
                          a: ({ children, href }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="font-medium text-primary underline underline-offset-2"
                            >
                              {children}
                            </a>
                          ),
                          code: ({ children }) => (
                            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px]">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {m.body}
                      </ReactMarkdown>
                    </div>
                  )
                ) : null}
              </div>
            </div>
          );
        })}

        {busy ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <img
              src={OPENPAY_AI_AVATAR}
              alt=""
              width={512}
              height={512}
              loading="lazy"
              className="h-7 w-7 rounded-[0.6rem] object-cover"
            />
            <span className="animate-pulse">Typing…</span>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="sticky bottom-0 pb-2 pt-2"
      >
        {pendingImage ? (
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs">
            <span className="max-w-40 truncate">{pendingImage.name}</span>
            <button type="button" onClick={() => setPendingImage(null)} aria-label="Remove image">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2 rounded-3xl border border-border/70 bg-card/70 p-2 pl-3 backdrop-blur">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void pickImage(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach image"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground press"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
          </button>
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder="Describe your issue…"
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={busy || (!input.trim() && !pendingImage)}
            aria-label="Send message"
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground press",
              (busy || (!input.trim() && !pendingImage)) && "opacity-40",
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
