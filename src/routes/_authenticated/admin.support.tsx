import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Bot, Copy, Loader2, Search, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListSupportTickets,
  adminReplySupport,
  adminUpdateSupportTicket,
  getSupportThread,
  isSupportAdmin,
} from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({
    meta: [
      { title: "Support Console — OpenPay Pro Admin" },
      {
        name: "description",
        content:
          "Admin support console for OpenPay Pro: review every customer support chat, verify identity and KYC, and reply live.",
      },
      { property: "og:title", content: "Support Console — OpenPay Pro Admin" },
      { property: "og:description", content: "Review and answer OpenPay Pro support chats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSupportPage,
});

const STATUSES = ["all", "open", "pending", "resolved", "closed"] as const;

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  ai_enabled: boolean;
  display_name: string | null;
  username: string | null;
  openpay_account: string | null;
  wallet_address: string | null;
  kyc_status: string | null;
  last_message_at: string;
};

type Msg = {
  id: string;
  role: string;
  body: string;
  image_url: string | null;
  created_at: string;
};

function AdminSupportPage() {
  const qc = useQueryClient();
  const checkAdmin = useServerFn(isSupportAdmin);
  const list = useServerFn(adminListSupportTickets);
  const thread = useServerFn(getSupportThread);
  const reply = useServerFn(adminReplySupport);
  const update = useServerFn(adminUpdateSupportTicket);

  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const admin = useQuery({ queryKey: ["support-admin"], queryFn: () => checkAdmin() });

  const tickets = useQuery({
    queryKey: ["support-admin-tickets", status, search],
    enabled: admin.data?.admin === true,
    queryFn: () => list({ data: { status, search } }) as Promise<Ticket[]>,
    refetchInterval: 20_000,
  });

  const threadQuery = useQuery({
    queryKey: ["support-admin-thread", activeId],
    enabled: Boolean(activeId),
    queryFn: () => thread({ data: { ticketId: activeId as string } }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [threadQuery.data]);

  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`support-admin-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${activeId}`,
        },
        () => void qc.invalidateQueries({ queryKey: ["support-admin-thread", activeId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, qc]);

  const sendReply = useMutation({
    mutationFn: async (body: string) => reply({ data: { ticketId: activeId as string, body } }),
    onSuccess: () => {
      setText("");
      void qc.invalidateQueries({ queryKey: ["support-admin-thread", activeId] });
      void qc.invalidateQueries({ queryKey: ["support-admin-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message || "Reply failed"),
  });

  const patch = useMutation({
    mutationFn: async (input: { status?: string; ai_enabled?: boolean; priority?: string }) =>
      update({ data: { ticketId: activeId as string, ...(input as never) } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["support-admin-thread", activeId] });
      void qc.invalidateQueries({ queryKey: ["support-admin-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message || "Update failed"),
  });

  if (admin.isLoading) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!admin.data?.admin) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-lg font-bold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This support console is restricted to OpenPay Pro administrators.
        </p>
      </div>
    );
  }

  const active = (threadQuery.data?.ticket ?? null) as Ticket | null;
  const messages = (threadQuery.data?.messages ?? []) as Msg[];

  return (
    <div className="mx-auto w-full max-w-6xl px-1 py-4">
      <h1 className="mb-4 text-xl font-bold">Support console</h1>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        {/* Ticket list */}
        <div className="rounded-3xl border border-border/60 bg-card/50 p-3">
          <div className="mb-3 flex items-center gap-2 rounded-full border border-border/70 px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Username, OP account, wallet…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold capitalize press",
                  status === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/70 text-muted-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="max-h-[65vh] space-y-2 overflow-y-auto">
            {tickets.isLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </div>
            ) : null}
            {(tickets.data ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                className={cn(
                  "w-full rounded-2xl border p-3 text-left press",
                  activeId === t.id
                    ? "border-primary bg-primary/5"
                    : "border-border/60 hover:border-border",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">
                    {t.display_name || t.username || "Customer"}
                  </span>
                  {t.kyc_status === "verified" ? (
                    <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  {t.ai_enabled ? <Bot className="h-4 w-4 shrink-0 text-primary" /> : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {t.username ? `@${t.username}` : "no username"} ·{" "}
                  {t.openpay_account || "no OP account"}
                </p>
                <p className="mt-1 flex items-center justify-between text-xs">
                  <span className="capitalize text-muted-foreground">
                    {t.category} · {t.status}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(t.last_message_at).toLocaleString()}
                  </span>
                </p>
              </button>
            ))}
            {!tickets.isLoading && (tickets.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No tickets</p>
            ) : null}
          </div>
        </div>

        {/* Thread */}
        <div className="flex min-h-[60vh] flex-col rounded-3xl border border-border/60 bg-card/50">
          {!active ? (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
              Select a ticket to view the conversation
            </div>
          ) : (
            <>
              <div className="border-b border-border/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold">
                    {active.display_name || active.username || "Customer"}
                  </h2>
                  {active.kyc_status === "verified" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500">
                      <BadgeCheck className="h-3.5 w-3.5" /> KYC verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      <ShieldAlert className="h-3.5 w-3.5" /> {active.kyc_status || "not_started"}
                    </span>
                  )}
                </div>
                <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <IdentityRow label="Username" value={active.username ? `@${active.username}` : "—"} />
                  <IdentityRow label="OpenPay account" value={active.openpay_account || "—"} />
                  <IdentityRow label="Wallet" value={active.wallet_address || "—"} mono />
                  <IdentityRow label="Category" value={active.category} />
                </dl>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(["open", "pending", "resolved", "closed"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => patch.mutate({ status: s })}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold capitalize press",
                        active.status === s
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/70 text-muted-foreground",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => patch.mutate({ ai_enabled: !active.ai_enabled })}
                    className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold press"
                  >
                    {active.ai_enabled ? "Disable AI bot" : "Enable AI bot"}
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        m.role === "user"
                          ? "bg-muted text-foreground"
                          : m.role === "ai"
                            ? "border border-border/60 bg-card text-foreground"
                            : "bg-primary text-primary-foreground",
                      )}
                    >
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">
                        {m.role === "user" ? "Customer" : m.role === "ai" ? "OpenPay AI" : "Agent"}
                      </p>
                      {m.image_url ? (
                        <a href={m.image_url} target="_blank" rel="noreferrer">
                          <img
                            src={m.image_url}
                            alt="Attachment"
                            loading="lazy"
                            className="mb-2 max-h-56 rounded-xl"
                          />
                        </a>
                      ) : null}
                      <span className="whitespace-pre-wrap">{m.body}</span>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = text.trim();
                  if (v) sendReply.mutate(v);
                }}
                className="flex items-end gap-2 border-t border-border/60 p-3"
              >
                <textarea
                  value={text}
                  rows={1}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const v = text.trim();
                      if (v) sendReply.mutate(v);
                    }
                  }}
                  placeholder="Reply as a live agent…"
                  className="max-h-32 min-h-9 flex-1 resize-none rounded-2xl border border-border/70 bg-transparent px-3 py-2 text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={sendReply.isPending || !text.trim()}
                  className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground press disabled:opacity-40"
                  aria-label="Send reply"
                >
                  {sendReply.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function IdentityRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="shrink-0">{label}:</dt>
      <dd className={cn("truncate text-foreground", mono && "font-mono text-[11px]")}>{value}</dd>
      {value !== "—" ? (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success("Copied");
          }}
          aria-label={`Copy ${label}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <Copy className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}
