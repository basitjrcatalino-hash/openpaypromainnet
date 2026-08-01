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
  { to: "/p2p", label: "P2P", icon: Users, match: (p: string) => p === "/p2p" || p === "/p2p/" || p.startsWith("/p2p/express") || p.startsWith("/p2p/select-payment") },
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
    match: (p: string) =>
      p.startsWith("/p2p/profile") ||
      p.startsWith("/p2p/wallet") ||
      p.startsWith("/p2p/payment") ||
      p.startsWith("/p2p/select-payment") ||
      p.startsWith("/p2p/settings") ||
      p.startsWith("/p2p/reviews") ||
      p.startsWith("/p2p/support") ||
      p.startsWith("/p2p/merchant") ||
      p.startsWith("/p2p/guide") ||
      p.startsWith("/p2p/rules") ||
      p.startsWith("/p2p/agreement") ||
      p.startsWith("/p2p/terms") ||
      p.startsWith("/p2p/privacy") ||
      p.startsWith("/p2p/api") ||
      p.startsWith("/p2p/security"),
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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
      aria-label="P2P"
    >
      <div
        className={cn(
          "pointer-events-auto w-full border-t border-border/50 bg-background/95 backdrop-blur-xl",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex h-[3.25rem] items-stretch px-1 sm:px-2 md:px-3">
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
                  active ? "text-foreground" : "text-muted-foreground/75",
                )}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.35 : 1.7} />
                  {showBadge ? (
                    <span className="absolute -right-2.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-[#F04438] px-1 text-[9px] font-bold leading-4 text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  ) : null}
                </span>
                <span className={cn(active && "font-bold")}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
