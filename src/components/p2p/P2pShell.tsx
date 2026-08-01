import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, QrCode, Search } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { P2pBottomNav } from "@/components/p2p/P2pBottomNav";
import { cn } from "@/lib/utils";

const MODE_TABS = [
  { id: "p2p", label: "P2P", to: "/p2p" as const },
  { id: "express", label: "Express", to: "/p2p/express" as const },
  { id: "block", label: "Block trade", to: null },
] as const;

function showModeTabs(pathname: string) {
  return pathname === "/p2p" || pathname === "/p2p/" || pathname.startsWith("/p2p/express");
}

function showBottomNav(pathname: string) {
  return pathname.startsWith("/p2p") && !pathname.startsWith("/p2p/admin");
}

export function P2pShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const modes = showModeTabs(pathname);
  const bottom = showBottomNav(pathname);
  const isExpress = pathname.startsWith("/p2p/express");

  return (
    <div className="relative mx-auto min-h-[100dvh] w-full max-w-lg bg-background text-foreground">
      {modes ? (
        <header
          className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-xl"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="flex h-12 items-center gap-1 px-2">
            <button
              type="button"
              onClick={() => void navigate({ to: "/dashboard" })}
              className="grid h-9 w-9 place-items-center rounded-full text-foreground press"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex flex-1 items-end justify-center gap-5 pb-0.5">
              {MODE_TABS.map((tab) => {
                const active =
                  (tab.id === "p2p" && !isExpress) || (tab.id === "express" && isExpress);
                if (!tab.to) {
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => toast.message("Block trade coming soon")}
                      className="pb-2 text-[15px] font-semibold text-muted-foreground/70"
                    >
                      {tab.label}
                    </button>
                  );
                }
                return (
                  <Link
                    key={tab.id}
                    to={tab.to}
                    className={cn(
                      "relative pb-2 text-[15px] font-bold",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {tab.label}
                    {active ? (
                      <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-foreground" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground press"
              aria-label="Scan"
              onClick={() => void navigate({ to: "/scan" })}
            >
              <QrCode className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground press"
              aria-label="Search"
              onClick={() => toast.message("Search ads by merchant or amount")}
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </header>
      ) : null}

      <div className={cn(bottom && "pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))]")}>
        {children}
      </div>

      {bottom ? <P2pBottomNav /> : null}
    </div>
  );
}
