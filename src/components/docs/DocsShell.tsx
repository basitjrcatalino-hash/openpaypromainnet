import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BookOpen, Copy, ExternalLink, Menu, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { PageListenButton } from "@/components/page-listen-button";
import { cn } from "@/lib/utils";
import { DOCS_NAV, PARTNER_PORTAL } from "@/lib/docs-nav";

/** Code block — blog-sized monospace (readable, not 11px) */
export function DocsCode({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-2xl border border-border bg-muted p-4 text-[0.95rem] leading-[1.65] text-foreground md:text-base">
        <code>{children.trim()}</code>
      </pre>
      <button
        type="button"
        className="absolute right-2 top-2 inline-flex h-8 items-center rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary"
        onClick={() =>
          void copyText(children.trim()).then(
            () => toast.success("Copied"),
            () => toast.error("Copy failed"),
          )
        }
      >
        <Copy className="mr-1.5 h-3.5 w-3.5" />
        Copy
      </button>
    </div>
  );
}

export function DocsSection({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="opblog-h2 mt-2">{title}</h2>
      </div>
      <div className="space-y-5 docs-copy">{children}</div>
    </section>
  );
}

function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-6">
      {DOCS_NAV.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-2.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {group.label}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const external = item.href.startsWith("http");
              const hashOnly = item.href.includes("#");
              const pathOnly = item.href.split("#")[0] || item.href;
              const active =
                !external &&
                !hashOnly &&
                (pathname === item.href ||
                  (item.href !== "/docs" && pathname.startsWith(pathOnly)));
              const className = cn(
                "block rounded-2xl px-3 py-2.5 text-[0.95rem] leading-snug transition md:text-base",
                active
                  ? "bg-accent font-semibold text-foreground ring-1 ring-primary/35"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              );
              if (external || hashOnly) {
                return (
                  <li key={item.href + item.label}>
                    <a
                      href={item.href}
                      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                      className={className}
                      onClick={onNavigate}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {item.label}
                        {external ? <ExternalLink className="h-3.5 w-3.5 opacity-50" /> : null}
                      </span>
                      {item.desc ? (
                        <span className="mt-1 block text-sm font-normal leading-snug opacity-75">
                          {item.desc}
                        </span>
                      ) : null}
                    </a>
                  </li>
                );
              }
              return (
                <li key={item.href + item.label}>
                  <Link to={item.href} className={className} onClick={onNavigate}>
                    {item.label}
                    {item.desc ? (
                      <span className="mt-1 block text-sm font-normal leading-snug opacity-75">
                        {item.desc}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

type DocsShellProps = {
  title: string;
  description: string;
  speechText?: string;
  pathname: string;
  children: ReactNode;
  eyebrow?: string;
};

export function DocsShell({
  title,
  description,
  speechText,
  pathname,
  children,
  eyebrow = "Developer Portal",
}: DocsShellProps) {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="opblog relative min-h-screen overflow-x-hidden text-base">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 15% -5%, rgba(171,159,242,0.28), transparent 55%), radial-gradient(ellipse 55% 40% at 90% 0%, rgba(124,108,240,0.14), transparent 50%)",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-border/80 bg-[color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground lg:hidden"
              aria-label="Docs menu"
              onClick={() => setMobileNav((v) => !v)}
            >
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/docs" className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent ring-1 ring-primary/30">
                <BookOpen className="h-4.5 w-4.5 text-foreground" />
              </span>
              <span className="truncate text-lg font-extrabold tracking-tight text-foreground">
                OpenPay Pro Docs
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-2.5">
            {speechText ? (
              <PageListenButton
                id={`page:docs:${pathname}`}
                text={speechText}
                label="Listen"
                variant="primary"
                size="sm"
                className="hidden rounded-full text-sm sm:inline-flex"
              />
            ) : null}
            <a
              href={PARTNER_PORTAL}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 sm:inline-flex"
            >
              Partner portal
              <ExternalLink className="h-4 w-4" />
            </a>
            <Link
              to="/website"
              className="rounded-full bg-muted px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              Website
            </Link>
            <Link
              to="/blog"
              className="hidden rounded-full px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground md:inline-flex"
            >
              Blog
            </Link>
            <Link
              to="/wiki"
              className="hidden rounded-full px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground md:inline-flex"
            >
              Wiki
            </Link>
          </div>
        </div>
      </header>

      {mobileNav ? (
        <div className="relative z-30 border-b border-border bg-card px-4 py-5 lg:hidden">
          <NavList pathname={pathname} onNavigate={() => setMobileNav(false)} />
        </div>
      ) : null}

      <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12 lg:py-12">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl border border-border bg-card/90 p-5 shadow-[0_8px_30px_rgba(61,46,99,0.04)]">
            <NavList pathname={pathname} />
          </div>
        </aside>

        <main className="opdocs-body min-w-0 space-y-12 pb-20">
          <div className="space-y-4">
            <p className="inline-flex rounded-full bg-muted px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </p>
            <h1 className="opblog-title">{title}</h1>
            <p className="opblog-dek docs-lede max-w-3xl text-muted-foreground">{description}</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export function DocsCallout({ children }: { children: ReactNode }) {
  return (
    <div className="docs-copy rounded-2xl border border-border border-l-4 border-l-primary bg-accent/70 px-5 py-4 text-base leading-relaxed text-muted-foreground md:text-[1.125rem]">
      {children}
    </div>
  );
}

export function DocsCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "docs-copy rounded-3xl border border-border bg-card p-5 text-base leading-relaxed shadow-[0_8px_30px_rgba(61,46,99,0.04)] sm:p-7 md:text-[1.125rem]",
        className,
      )}
    >
      {children}
    </div>
  );
}
