import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { PageListenButton } from "@/components/page-listen-button";
import { cn } from "@/lib/utils";

export const P2P_LEGAL_NAV = [
  { to: "/p2p/guide" as const, label: "How to use", key: "guide" },
  { to: "/p2p/rules" as const, label: "Trading rules", key: "rules" },
  { to: "/p2p/security" as const, label: "Safety & protection", key: "security" },
  { to: "/p2p/agreement" as const, label: "User agreement", key: "agreement" },
  { to: "/p2p/terms" as const, label: "P2P terms", key: "terms" },
  { to: "/p2p/privacy" as const, label: "P2P privacy", key: "privacy" },
] as const;

export type P2pDocPath = (typeof P2P_LEGAL_NAV)[number]["to"];

type Hero = { from: string; to: string; glyph: string };

export function P2pDocLayout({
  title,
  dek,
  children,
  active,
  speechId,
  speechText,
  hero,
  updated = "August 2026",
  eyebrow = "P2P · Listen aloud",
}: {
  title: string;
  dek: string;
  children: ReactNode;
  active: P2pDocPath;
  speechId: string;
  speechText: string;
  hero: Hero;
  updated?: string;
  eyebrow?: string;
}) {
  const activeLabel = P2P_LEGAL_NAV.find((n) => n.to === active)?.label ?? title;

  return (
    <div className="opblog min-h-[100dvh]">
      <div className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-6 sm:px-8">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Link
            to="/p2p/profile"
            className="rounded-full bg-[var(--muted)] px-3 py-1.5 text-[var(--foreground)]/80 hover:text-[var(--foreground)]"
          >
            P2P
          </Link>
          <span className="text-[var(--muted-foreground)]">›</span>
          <span className="rounded-full bg-[var(--muted)] px-3 py-1.5">Guides</span>
          <span className="text-[var(--muted-foreground)]">›</span>
          <span className="rounded-full bg-[var(--muted)] px-3 py-1.5">{activeLabel}</span>
        </nav>

        <div className="mb-8 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {P2P_LEGAL_NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                n.to === active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              {n.label}
            </Link>
          ))}
        </div>

        <article className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            {eyebrow}
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
              to="/p2p"
              className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)]"
            >
              Open marketplace
            </Link>
          </div>

          <div
            className="mt-10 grid aspect-[16/7] place-items-center rounded-3xl text-6xl font-black text-[color:rgba(61,46,99,0.28)] sm:text-7xl"
            style={{
              backgroundImage: `linear-gradient(135deg, ${hero.from}, ${hero.to})`,
            }}
            aria-hidden
          >
            {hero.glyph}
          </div>

          <div className="opblog-body mt-12 max-w-[46rem] space-y-10">{children}</div>

          <div className="mt-14 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-7">
            <h2 className="text-2xl font-bold tracking-tight">Keep reading</h2>
            <p className="mt-2 text-[var(--muted-foreground)]">
              More from the OpenPay Pro P2P guide pack.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {P2P_LEGAL_NAV.filter((n) => n.to !== active).map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"
                >
                  {n.label}
                </Link>
              ))}
              <Link
                to="/p2p/profile"
                className="rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-semibold"
              >
                Back to profile
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

export function P2pDocSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-4">
      <h2 className="opblog-h2">{title}</h2>
      {children}
    </section>
  );
}

export function P2pDocList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3.5 text-base leading-relaxed text-[var(--foreground)]/85"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export function P2pDocSteps({
  steps,
}: {
  steps: { title: string; detail: string }[];
}) {
  return (
    <ol className="space-y-4">
      {steps.map((step, i) => (
        <li
          key={step.title}
          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5"
        >
          <div className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold tracking-tight">{step.title}</p>
              <p className="mt-1.5 text-base leading-relaxed text-[var(--muted-foreground)]">
                {step.detail}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function P2pDocTips({ items }: { items: string[] }) {
  return (
    <div className="rounded-2xl border-l-4 border-[var(--primary)] bg-[var(--accent)] px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
        Good to know
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((tip) => (
          <li key={tip} className="text-base font-medium leading-relaxed">
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function P2pDocCtas({
  primary,
  secondary,
}: {
  primary?: {
    to: P2pDocPath | "/p2p" | "/p2p/express" | "/p2p/support" | "/settings" | "/terms" | "/privacy";
    label: string;
  };
  secondary?: {
    to: P2pDocPath | "/p2p" | "/p2p/express" | "/p2p/support" | "/settings" | "/terms" | "/privacy";
    label: string;
  }[];
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {primary ? (
        <Link
          to={primary.to}
          className="inline-flex rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)]"
        >
          {primary.label}
        </Link>
      ) : null}
      {(secondary ?? []).map((s) => (
        <Link
          key={s.to + s.label}
          to={s.to}
          className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] px-6 py-3 text-sm font-semibold text-[var(--foreground)]"
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}
