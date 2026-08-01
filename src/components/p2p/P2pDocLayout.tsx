import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { P2pMenuCard, P2pSubpageHeader } from "@/components/p2p/P2pSubpage";
import { cn } from "@/lib/utils";

export const P2P_LEGAL_NAV = [
  { to: "/p2p/guide" as const, label: "How to use" },
  { to: "/p2p/rules" as const, label: "Trading rules" },
  { to: "/p2p/security" as const, label: "Safety & protection" },
  { to: "/p2p/agreement" as const, label: "User agreement" },
  { to: "/p2p/terms" as const, label: "P2P terms" },
  { to: "/p2p/privacy" as const, label: "P2P privacy" },
] as const;

export function P2pDocLayout({
  title,
  dek,
  children,
  active,
}: {
  title: string;
  dek?: string;
  children: ReactNode;
  active?: string;
}) {
  return (
    <div>
      <P2pSubpageHeader title={title} backTo="/p2p/profile" />
      {dek ? (
        <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground md:px-6">{dek}</p>
      ) : null}

      <div className="-mx-0 px-4 pb-2 md:px-6">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {P2P_LEGAL_NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "h-8 shrink-0 rounded-full px-3 text-[11px] font-bold transition-colors",
                active === n.to
                  ? "bg-foreground text-background"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {n.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-0 pb-10">{children}</div>
    </div>
  );
}

export function P2pDocSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="mx-4 mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground md:mx-6">
        {title}
      </h2>
      <P2pMenuCard className="mb-1">
        <div className="space-y-3 px-4 py-3.5 text-[13px] leading-relaxed text-muted-foreground">
          {children}
        </div>
      </P2pMenuCard>
    </div>
  );
}

export function P2pDocList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-4">
      {items.map((item) => (
        <li key={item} className="text-foreground/90">
          <span className="text-muted-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}
