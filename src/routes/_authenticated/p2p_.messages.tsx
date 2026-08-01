import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Pin, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { P2pEmptyState } from "@/components/p2p/P2pUi";
import { supabase } from "@/integrations/supabase/client";
import {
  ORDER_STATUS_LABEL,
  fetchDisplayNames,
  fetchInboxThreads,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/messages")({
  head: () => ({
    meta: [
      { title: "P2P Messages — OpenPay Pro" },
      { name: "description", content: "Chat threads for your P2P escrow trades." },
      { property: "og:title", content: "P2P Messages — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesInboxPage,
});

function MessagesInboxPage() {
  const [q, setQ] = useState("");

  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const inboxQ = useQuery({
    queryKey: ["p2p-inbox", userQ.data],
    queryFn: () => fetchInboxThreads(userQ.data as string),
    enabled: !!userQ.data,
    refetchInterval: 10_000,
  });

  const ids = useMemo(
    () => (inboxQ.data ?? []).map((t) => t.counterpartyId),
    [inboxQ.data],
  );
  const names = useQuery({
    queryKey: ["p2p-names", ids.join(",")],
    queryFn: () => fetchDisplayNames(ids),
    enabled: ids.length > 0,
  });

  const threads = useMemo(() => {
    const list = inboxQ.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((t) => {
      const name = (names.data?.[t.counterpartyId] ?? "").toLowerCase();
      const preview = (t.lastMessage?.body ?? "").toLowerCase();
      const ref = t.order.ref.toLowerCase();
      return name.includes(needle) || preview.includes(needle) || ref.includes(needle);
    });
  }, [inboxQ.data, names.data, q]);

  return (
    <div>
      <header
        className="sticky top-0 z-20 border-b border-border/40 bg-background/95 px-4 pb-3 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex h-12 items-center">
          <h1 className="text-lg font-bold">Messages</h1>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="h-10 rounded-xl border-0 bg-muted/60 pl-9"
          />
        </div>
      </header>

      {inboxQ.isLoading ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !threads.length ? (
        <P2pEmptyState
          title="No messages"
          description="Order chats appear here when you start a P2P trade."
        />
      ) : (
        <div className="divide-y divide-border/40">
          {threads.map((t, idx) => {
            const name = names.data?.[t.counterpartyId] ?? "Trader";
            const preview =
              t.lastMessage?.body ||
              `[P2P order] ${ORDER_STATUS_LABEL[t.order.status] ?? t.order.status}`;
            const when = new Date(
              t.lastMessage?.created_at ?? t.order.updated_at ?? t.order.created_at,
            );
            const open = ["pending_payment", "paid", "disputed"].includes(t.order.status);
            return (
              <Link
                key={t.order.id}
                to="/p2p/order/$id"
                params={{ id: t.order.id }}
                className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-sm font-black">
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-bold">{name}</p>
                    {idx < 2 ? <Pin className="h-3 w-3 text-muted-foreground" /> : null}
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                      {when.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit" })}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="truncate text-xs text-muted-foreground">{preview}</p>
                    {open ? (
                      <span
                        className={cn(
                          "ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white",
                        )}
                      >
                        ·
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
