import { Link, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  MessageSquare,
  Tag,
  UserRound,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fetchInboxUnreadCount } from "@/lib/p2p";

const TABS = [
  { to: "/p2p", label: "P2P", icon: Users, match: (p: string) => p === "/p2p" || p === "/p2p/" || p.startsWith("/p2p/express") },
  {
    to: "/p2p/orders",
    label: "Orders",
    icon: ClipboardList,
    match: (p: string) => p.startsWith("/p2p/orders") || p.startsWith("/p2p/order/"),
  },
  {
    to: "/p2p/create",
    label: "Ads",
    icon: Tag,
    match: (p: string) => p.startsWith("/p2p/create"),
  },
  {
    to: "/p2p/messages",
    label: "Messages",
    icon: MessageSquare,
    match: (p: string) => p.startsWith("/p2p/messages"),
  },
  {
    to: "/p2p/profile",
    label: "Profile",
    icon: UserRound,
    match: (p: string) => p.startsWith("/p2p/profile"),
  },
] as const;

export function P2pBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const userQ = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const unreadQ = useQuery({
    queryKey: ["p2p-inbox-unread", userQ.data],
    queryFn: () => fetchInboxUnreadCount(userQ.data as string),
    enabled: !!userQ.data,
    refetchInterval: 20_000,
  });
  const unread = unreadQ.data ?? 0;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-xl"
      aria-label="P2P"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(pathname);
          const showBadge = tab.to === "/p2p/messages" && unread > 0;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              preload="intent"
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold press",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={active ? 2.25 : 1.75} />
                {showBadge ? (
                  <span className="absolute -right-2.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-4 text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </span>
              <span>{tab.label}</span>
              {active ? (
                <span className="absolute top-1 h-1 w-1 rounded-full bg-rose-500" aria-hidden />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
