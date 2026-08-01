import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type P2pPath =
  | "/p2p"
  | "/p2p/profile"
  | "/p2p/wallet"
  | "/p2p/payments"
  | "/p2p/payment-ads"
  | "/p2p/payment-account"
  | "/p2p/select-payment"
  | "/p2p/settings"
  | "/p2p/reviews"
  | "/p2p/support"
  | "/p2p/merchant"
  | "/p2p/guide"
  | "/p2p/rules"
  | "/p2p/agreement"
  | "/p2p/terms"
  | "/p2p/privacy"
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
  | "/deposit"
  | "/terms"
  | "/privacy";

/** Phantom / Blog editorial chrome for P2P hub & guide pages. */
export function P2pHubLayout({
  title,
  dek,
  children,
  backTo = "/p2p/profile",
  crumb = "Profile",
  eyebrow,
  hero,
  actions,
}: {
  title: string;
  dek?: string;
  children: ReactNode;
  backTo?: P2pPath;
  crumb?: string;
  eyebrow?: string;
  hero?: { from: string; to: string; glyph: string };
  actions?: ReactNode;
}) {
  return (
    <div className="opblog min-h-[100dvh]">
      <div className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-6 sm:px-8">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-3 py-1.5 text-[var(--foreground)]/80 hover:text-[var(--foreground)]"
          >
            <ChevronLeft className="h-4 w-4" />
            P2P
          </Link>
          <span className="text-[var(--muted-foreground)]">›</span>
          <span className="rounded-full bg-[var(--muted)] px-3 py-1.5">{crumb}</span>
          <span className="text-[var(--muted-foreground)]">›</span>
          <span className="rounded-full bg-[var(--muted)] px-3 py-1.5">{title}</span>
        </nav>

        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          {eyebrow ?? "P2P · OpenPay Pro"}
        </p>
        <h1 className="opblog-title mt-3">{title}</h1>
        {dek ? (
          <p className="opblog-dek mt-5 max-w-2xl text-[var(--foreground)]/80">{dek}</p>
        ) : null}
        {actions ? <div className="mt-6 flex flex-wrap gap-2">{actions}</div> : null}

        {hero ? (
          <div
            className="mt-10 grid aspect-[16/7] place-items-center rounded-3xl text-6xl font-black text-[color:rgba(61,46,99,0.28)] sm:text-7xl"
            style={{
              backgroundImage: `linear-gradient(135deg, ${hero.from}, ${hero.to})`,
            }}
            aria-hidden
          >
            {hero.glyph}
          </div>
        ) : null}

        <div className={cn("space-y-6", hero ? "mt-10" : "mt-8")}>{children}</div>
      </div>
    </div>
  );
}

/** @deprecated Prefer P2pHubLayout — kept for gradual migration. */
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
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/95 px-5 backdrop-blur-xl sm:px-8">
      <div
        className="mx-auto flex h-14 max-w-[1180px] items-center gap-2"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <Link
          to={backTo}
          className="grid h-9 w-9 place-items-center rounded-full bg-[var(--muted)] text-[var(--foreground)] press"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 truncate text-lg font-bold tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        {right ? <div>{right}</div> : null}
      </div>
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
        "overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-sm",
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
        <span className="block text-base font-bold tracking-tight text-[var(--foreground)]">
          {title}
        </span>
        {desc ? (
          <span className="mt-0.5 block text-sm text-[var(--muted-foreground)]">{desc}</span>
        ) : null}
      </span>
      <ChevronLeft className="h-4 w-4 rotate-180 text-[var(--muted-foreground)]" />
    </>
  );
  const cls =
    "flex w-full items-center gap-3 border-b border-[var(--border)] px-5 py-4 text-left last:border-b-0 transition hover:bg-[var(--muted)]";
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

export function P2pHubPill({
  to,
  children,
  primary,
}: {
  to: P2pPath;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold transition",
        primary
          ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-105"
          : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]",
      )}
    >
      {children}
    </Link>
  );
}
