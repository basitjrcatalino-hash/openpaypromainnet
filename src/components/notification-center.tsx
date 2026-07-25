import { Bell, CheckCheck, Trash2, ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";

import type { AppNotification } from "@/lib/tx-notifications";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

function NoteIcon({ type }: { type: string }) {
  if (type === "receive" || type === "buy") return <ArrowDownLeft className="h-4 w-4" />;
  if (type === "swap") return <RefreshCw className="h-4 w-4" />;
  return <ArrowUpRight className="h-4 w-4" />;
}

export function NotificationBell({ unread, onOpen }: { unread: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-sidebar-accent"
      aria-label={unread ? `${unread} unread notifications` : "Notifications"}
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md duration-200 data-[state=closed]:duration-150 data-[state=open]:duration-200"
      >
        <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>Transaction alerts for your wallets</SheetDescription>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={onMarkAll}
              disabled={!items.some((n) => !n.read)}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Mark all read
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={onClear}
              disabled={items.length === 0}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center">
              <Bell className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sends, receives, and top-ups will show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    to="/activity"
                    onClick={() => {
                      onMarkOne(n.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex gap-3 px-5 py-4 transition-colors hover:bg-sidebar-accent/50",
                      !n.read && "bg-primary/5",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full",
                        n.type === "receive" || n.type === "buy"
                          ? "bg-success/15 text-success"
                          : "bg-primary/15 text-primary",
                      )}
                    >
                      <NoteIcon type={n.type} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold">{n.title}</span>
                        {!n.read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {n.body}
                      </span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
