import { useMemo, useState } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Coins,
  ChevronRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import type { AppNotification } from "@/lib/tx-notifications";
import { formatNumber, timeAgo } from "@/lib/wallet-utils";
import { resolveTokenLogoUrl } from "@/lib/token-logos";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { TokenAvatar } from "@/components/wallet/TokenAvatar";
import { activityDateGroupLabel } from "@/components/transaction-detail";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

type Filter = "all" | "unread";

function isIncoming(type: string) {
  return type === "receive" || type === "buy" || type === "reward";
}

function NoteIcon({ type }: { type: string }) {
  if (type === "receive" || type === "buy" || type === "reward") {
    return <ArrowDownLeft className="h-2.5 w-2.5" strokeWidth={2.5} />;
  }
  if (type === "swap") return <ArrowLeftRight className="h-2.5 w-2.5" strokeWidth={2.5} />;
  if (type === "mint") return <Coins className="h-2.5 w-2.5" strokeWidth={2.5} />;
  return <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={2.5} />;
}

function displayTitle(n: AppNotification) {
  const symbol = (n.tokenSymbol ?? "token").replace(/^\$/, "");
  if (isIncoming(n.type)) return `Received ${symbol}`;
  if (n.type === "send" || n.type === "sell") return `Sent ${symbol}`;
  if (n.type === "swap") return `Swapped ${symbol}`;
  if (n.type === "mint") return `Minted ${symbol}`;
  return n.title;
}

function cleanBody(body: string) {
  const t = body.trim();
  if (!t) return "Tap to view details";
  // Soften raw fee / hash noise for the list row
  if (/^pro_xfer:/i.test(t)) return "Internal transfer";
  if (/^OpenPay checkout/i.test(t)) return "OpenPay checkout";
  if (/^MoonPay top-up/i.test(t)) return "MoonPay top-up";
  return t;
}

function groupNotes(items: AppNotification[]) {
  const groups: { label: string; items: AppNotification[] }[] = [];
  const index = new Map<string, number>();
  const now = new Date();
  for (const item of items) {
    const label = activityDateGroupLabel(item.createdAt, now);
    const existing = index.get(label);
    if (existing == null) {
      index.set(label, groups.length);
      groups.push({ label, items: [item] });
    } else {
      groups[existing]!.items.push(item);
    }
  }
  return groups;
}

export function NotificationBell({ unread, onOpen }: { unread: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative grid h-10 w-10 place-items-center rounded-full bg-muted/70 text-foreground press hover:bg-muted"
      aria-label={unread ? `${unread} unread notifications` : "Notifications"}
    >
      <Bell className="h-4.5 w-4.5" strokeWidth={2} />
      {unread > 0 && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
      )}
    </button>
  );
}

export function NotificationCenter({
  open,
  onOpenChange,
  items,
  onMarkAll,
  onClear,
  onMarkOne,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: AppNotification[];
  onMarkAll: () => void;
  onClear: () => void;
  onMarkOne: (id: string) => void;
}) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<Filter>("all");

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);
  const filtered = useMemo(
    () => (filter === "unread" ? items.filter((n) => !n.read) : items),
    [items, filter],
  );
  const groups = useMemo(() => groupNotes(filtered), [filtered]);

  const body = (
    <>
      <SheetHeader className="shrink-0 space-y-0 px-5 pb-3 pt-4 text-left">
        <div className="flex items-start justify-between gap-3 pr-10">
          <div className="min-w-0">
            <SheetTitle className="text-[22px] font-bold tracking-tight">Notifications</SheetTitle>
            <SheetDescription className="sr-only">
              Transaction alerts for your wallets
            </SheetDescription>
            {unread > 0 ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {unread} unread
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">You&apos;re all caught up</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onMarkAll}
              disabled={unread === 0}
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
              aria-label="Mark all as read"
              title="Mark all as read"
            >
              <CheckCheck className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={items.length === 0}
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
              aria-label="Clear all"
              title="Clear all"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-1 rounded-full bg-muted/60 p-1">
          {(
            [
              { id: "all", label: "All" },
              { id: "unread", label: "Unread" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={cn(
                "flex-1 rounded-full py-2 text-sm font-semibold transition-colors press",
                filter === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.id === "unread" && unread > 0 ? (
                <span className="ml-1.5 text-xs font-medium text-primary">{unread}</span>
              ) : null}
            </button>
          ))}
        </div>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        {filtered.length === 0 ? (
          <div className="grid place-items-center px-6 py-20 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-muted/70">
              <Bell className="h-7 w-7 text-muted-foreground/70" strokeWidth={1.75} />
            </div>
            <p className="mt-4 text-[15px] font-semibold text-foreground">
              {filter === "unread" ? "No unread alerts" : "No notifications yet"}
            </p>
            <p className="mt-1 max-w-[16rem] text-sm text-muted-foreground">
              {filter === "unread"
                ? "New receives, sends, and top-ups will show up here."
                : "Activity from your wallets will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            {groups.map((group) => (
              <section key={group.label} className="space-y-1.5">
                <h2 className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {group.label}
                </h2>
                <ul className="ph-group overflow-hidden">
                  {group.items.map((n) => (
                    <li key={n.id} className="border-b border-border/40 last:border-0">
                      <NotificationRow
                        note={n}
                        onOpen={() => {
                          onMarkOne(n.id);
                          onOpenChange(false);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 ? (
        <div className="shrink-0 border-t border-border/50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            to="/activity"
            onClick={() => onOpenChange(false)}
            className="flex w-full items-center justify-center gap-1 rounded-full bg-muted/70 py-3 text-sm font-semibold text-foreground press hover:bg-muted"
          >
            View activity
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      ) : null}
    </>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile
            ? "h-[min(92dvh,720px)] rounded-t-[1.75rem] border-border/60 sm:max-w-none"
            : "w-full sm:max-w-100",
        )}
      >
        {isMobile ? (
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
        ) : null}
        {body}
      </SheetContent>
    </Sheet>
  );
}

function NotificationRow({
  note,
  onOpen,
}: {
  note: AppNotification;
  onOpen: () => void;
}) {
  const incoming = isIncoming(note.type);
  const logo = resolveTokenLogoUrl(null, note.tokenSymbol);
  const amount = Number(note.amount) || 0;
  const amountLabel = formatNumber(amount, amount >= 1_000_000 ? 2 : amount >= 1 ? 4 : 6);

  return (
    <Link
      to="/activity"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition-colors press hover:bg-muted/40",
        !note.read && "bg-primary/4",
      )}
    >
      <span className="relative shrink-0">
        <TokenAvatar logoUrl={logo} symbol={note.tokenSymbol} size="sm" />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 z-10 grid h-5 w-5 place-items-center rounded-full border-2 border-card",
            incoming ? "bg-emerald-500 text-white" : "bg-foreground text-background",
          )}
          aria-hidden
        >
          <NoteIcon type={note.type} />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-[15px] text-foreground",
              note.read ? "font-semibold" : "font-bold",
            )}
          >
            {displayTitle(note)}
          </span>
          {!note.read ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {cleanBody(note.body)}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className={cn(
            "block text-[15px] font-semibold tabular-nums",
            incoming ? "text-emerald-500" : "text-foreground",
          )}
        >
          {incoming ? "+" : note.type === "send" || note.type === "sell" ? "−" : ""}
          {amountLabel}
        </span>
        <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
          {timeAgo(note.createdAt)}
        </span>
      </span>
    </Link>
  );
}
