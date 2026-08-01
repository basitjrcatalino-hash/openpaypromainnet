import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageListenButton } from "@/components/page-listen-button";
import { cn } from "@/lib/utils";

export type LegalNavKey = "terms" | "privacy" | "regulatory" | "legal";

const LEGAL_NAV: {
  key: LegalNavKey;
  to: "/terms" | "/privacy" | "/regulatory" | "/legal";
  label: string;
}[] = [
  { key: "terms", to: "/terms", label: "Terms" },
  { key: "privacy", to: "/privacy", label: "Privacy" },
  { key: "regulatory", to: "/regulatory", label: "Regulatory" },
  { key: "legal", to: "/legal", label: "License" },
];

type Props = {
  navKey: LegalNavKey;
  title: string;
  dek: string;
  updated: string;
  speechId: string;
  speechText: string;
  hero: { from: string; to: string; glyph: string };
  children: ReactNode;
  toc?: { id: string; label: string }[];
};

/**
 * Phantom / blog editorial chrome for Terms, Privacy, and Regulatory Status.
 */
export function LegalDocLayout({
  navKey,
  title,
  dek,
  updated,
  speechId,
  speechText,
  hero,
  children,
  toc,
}: Props) {
  return (
    <main className="opblog min-h-screen">
      <div className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-8 sm:px-8">
        <nav className="mb-10 flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Link
            to="/website"
            className="rounded-full bg-[var(--muted)] px-3 py-1.5 text-[var(--foreground)]/80 hover:text-[var(--foreground)]"
          >
            OpenPay Pro
          </Link>
          <span className="text-[var(--muted-foreground)]">›</span>
          <span className="rounded-full bg-[var(--muted)] px-3 py-1.5">Legal</span>
          <span className="text-[var(--muted-foreground)]">›</span>
          <span className="rounded-full bg-[var(--muted)] px-3 py-1.5">
            {LEGAL_NAV.find((n) => n.key === navKey)?.label ?? title}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {LEGAL_NAV.map((n) => (
              <Link
                key={n.key}
                to={n.to}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  n.key === navKey
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                {n.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className={cn("grid gap-10", toc?.length ? "lg:grid-cols-[minmax(0,1fr)_240px]" : "")}>
          <article className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Legal · Listen aloud
            </p>
            <h1 className="opblog-title mt-3">{title}</h1>
            <p className="opblog-dek mt-5 max-w-2xl text-[var(--foreground)]/80">{dek}</p>
            <p className="mt-5 text-sm text-[var(--muted-foreground)]">
              Last updated <span className="italic">{updated}</span>
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <PageListenButton
                id={speechId}
                text={speechText}
                label="Listen to this page"
                stopLabel="Stop"
                preparingLabel="Starting…"
                variant="primary"
              />
              <Link
                to="/authpi"
                className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)]"
              >
                Open wallet
              </Link>
            </div>

            <div
              className="mt-10 grid aspect-[16/7] place-items-center rounded-3xl text-7xl font-black text-[color:rgba(61,46,99,0.28)]"
              style={{
                backgroundImage: `linear-gradient(135deg, ${hero.from}, ${hero.to})`,
              }}
              aria-hidden
            >
              {hero.glyph}
            </div>

            <div className="opblog-body mt-12 max-w-[46rem] space-y-10">{children}</div>

            <div className="mt-14 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-7">
              <h2 className="text-2xl font-bold tracking-tight">Related policies</h2>
              <p className="mt-2 text-[var(--muted-foreground)]">
                Keep reading the OpenPay Pro legal pack — same Phantom editorial look as Blog and Wiki.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {LEGAL_NAV.filter((n) => n.key !== navKey).map((n) => (
                  <Link
                    key={n.key}
                    to={n.to}
                    className="rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"
                  >
                    {n.label}
                  </Link>
                ))}
                <Link
                  to="/website"
                  className="rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-semibold"
                >
                  Back to website
                </Link>
              </div>
            </div>
          </article>

          {toc && toc.length > 0 ? (
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                  On this page
                </p>
                <nav className="space-y-1">
                  {toc.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block rounded-xl px-3 py-2 text-sm font-semibold text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export function LegalSection({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-4">
      <h2 className="opblog-h2">{heading}</h2>
      {children}
    </section>
  );
}
