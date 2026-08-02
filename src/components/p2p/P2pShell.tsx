import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, CircleHelp, MessageCircleMore } from "lucide-react";
import type { ReactNode } from "react";

import { P2pBottomNav } from "@/components/p2p/P2pBottomNav";
import { P2P_ADMIN_SHELL_WIDTH, P2P_SHELL_WIDTH } from "@/components/p2p/p2p-layout";
import { cn } from "@/lib/utils";

const MODE_TABS = [
  { id: "p2p", label: "P2P", to: "/p2p" as const },
  { id: "express", label: "Express", to: "/p2p/express" as const },
] as const;

function showModeTabs(pathname: string) {
  return pathname === "/p2p" || pathname === "/p2p/" || pathname.startsWith("/p2p/express");
}

function showBottomNav(pathname: string) {
  if (!pathname.startsWith("/p2p") || pathname.startsWith("/p2p/admin")) return false;
  // Bitget-style: hide chrome on take-order + live trade room
  if (pathname.startsWith("/p2p/take/") || pathname.startsWith("/p2p/order/")) return false;
  return true;
}

function isAdminPath(pathname: string) {
  return pathname.startsWith("/p2p/admin");
}

function isWidePath(pathname: string) {
  return (
    isAdminPath(pathname) ||
    pathname.startsWith("/p2p/guide") ||
    pathname.startsWith("/p2p/rules") ||
    pathname.startsWith("/p2p/security") ||
    pathname.startsWith("/p2p/agreement") ||
    pathname.startsWith("/p2p/terms") ||
    pathname.startsWith("/p2p/privacy") ||
    pathname.startsWith("/p2p/profile") ||
    pathname.startsWith("/p2p/wallet") ||
    pathname.startsWith("/p2p/payment") ||
    pathname.startsWith("/p2p/select-payment") ||
    pathname.startsWith("/p2p/settings") ||
    pathname.startsWith("/p2p/reviews") ||
    pathname.startsWith("/p2p/support") ||
    pathname.startsWith("/p2p/merchant") ||
    pathname.startsWith("/p2p/api")
  );
}

export function P2pShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const modes = showModeTabs(pathname);
  const bottom = showBottomNav(pathname);
  const admin = isAdminPath(pathname);
  const wide = isWidePath(pathname);
  const isExpress = pathname.startsWith("/p2p/express");

  return (
    <div
      className={cn(
        "relative min-h-[100dvh] bg-background text-foreground",
        admin || wide ? P2P_ADMIN_SHELL_WIDTH : P2P_SHELL_WIDTH,
        !wide && "md:border-0",
      )}
    >
      {modes ? (
        <header
          className="sticky top-0 z-30 border-b border-border/30 bg-background/95 backdrop-blur-xl"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="flex h-11 items-center gap-0.5 px-1.5 sm:px-2 md:px-3">
            <button
              type="button"
              onClick={() => void navigate({ to: "/dashboard" })}
              className="grid h-9 w-9 place-items-center rounded-full text-foreground press"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex flex-1 items-end justify-center gap-8 pb-0.5 md:gap-12">
              {MODE_TABS.map((tab) => {
                const active =
                  (tab.id === "p2p" && !isExpress) || (tab.id === "express" && isExpress);
                return (
                  <Link
                    key={tab.id}
                    to={tab.to}
                    className={cn(
                      "relative pb-2 text-[16px] font-extrabold tracking-tight",
                      active ? "text-foreground" : "text-muted-foreground/65",
                    )}
                  >
                    {tab.label}
                    {active ? (
                      <span className="absolute inset-x-0 -bottom-px mx-auto h-[2.5px] w-6 rounded-full bg-foreground" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground press"
              aria-label="Help"
              onClick={() => void navigate({ to: "/p2p/guide" })}
            >
              <CircleHelp className="h-[1.15rem] w-[1.15rem]" />
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground press"
              aria-label="Support"
              onClick={() => void navigate({ to: "/p2p/support" })}
            >
              <MessageCircleMore className="h-[1.15rem] w-[1.15rem]" />
            </button>
          </div>
        </header>
      ) : null}

      <div className={cn(bottom && "pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]")}>
        {children}
      </div>

      {bottom ? <P2pBottomNav /> : null}
    </div>
  );
}
