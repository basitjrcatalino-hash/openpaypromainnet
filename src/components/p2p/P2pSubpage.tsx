import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type P2pPath =
  | "/p2p"
  | "/p2p/profile"
  | "/p2p/wallet"
  | "/p2p/payments"
  | "/p2p/payment-ads"
  | "/p2p/settings"
  | "/p2p/reviews"
  | "/p2p/support"
  | "/p2p/merchant"
  | "/p2p/guide"
  | "/p2p/api"
  | "/p2p/security"
  | "/p2p/create"
  | "/p2p/orders"
  | "/p2p/messages"
  | "/p2p/admin"
  | "/p2p/express"
  | "/settings"
  | "/chat"
  | "/ledger"
  | "/docs/openpay"
  | "/deposit";

export function P2pSubpageHeader({
  title,
  backTo = "/p2p/profile",
  right,
}: {
  title: string;
  backTo?: P2pPath;
  right?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-20 flex h-12 items-center gap-1 border-b border-border/40 bg-background/95 px-2 backdrop-blur-xl md:px-4"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <Link
        to={backTo}
        className="grid h-9 w-9 place-items-center rounded-full text-foreground press"
        aria-label="Back"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <h1 className="flex-1 truncate text-[17px] font-extrabold tracking-tight">{title}</h1>
      {right ? <div className="pr-2">{right}</div> : null}
    </header>
  );
}

export function P2pMenuCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "mx-4 overflow-hidden rounded-2xl border border-border/50 bg-card/40 md:mx-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function P2pActionRow({
  to,
  title,
  desc,
  onClick,
}: {
  to?: P2pPath;
  title: string;
  desc?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        {desc ? (
          <span className="mt-0.5 block text-[12px] text-muted-foreground">{desc}</span>
        ) : null}
      </span>
      <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
    </>
  );
  const cls =
    "flex w-full items-center gap-3 border-b border-border/40 px-4 py-3.5 text-left last:border-b-0 hover:bg-muted/30";
  if (to) {
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}
