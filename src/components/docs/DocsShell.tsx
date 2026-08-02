import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  BookOpen,
  Copy,
  ExternalLink,
  Menu,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { PageListenButton } from "@/components/page-listen-button";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { DOCS_NAV, PARTNER_PORTAL } from "@/lib/docs-nav";

export function DocsCode({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-2xl border border-border bg-muted/50 p-4 text-[11px] leading-relaxed text-foreground md:text-xs">
        <code>{children.trim()}</code>
      </pre>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="absolute right-2 top-2 h-7 rounded-full border-border bg-background/80 text-[10px] backdrop-blur"
        onClick={() =>
          void copyText(children.trim()).then(
            () => toast.success("Copied"),
            () => toast.error("Copy failed"),
          )
        }
      >
        <Copy className="mr-1 h-3 w-3" />
        Copy
      </Button>
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
    <section id={id} className="scroll-mt-28 space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground md:text-2xl">
          {title}
        </h2>
      </div>
      {children}
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
    <nav className="space-y-5">
      {DOCS_NAV.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {group.label}
          </p>
          <ul className="space-y-0.5">
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
                "block rounded-xl px-2.5 py-2 text-sm transition",
                active
                  ? "bg-primary/12 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
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
                      <span className="inline-flex items-center gap-1">
                        {item.label}
                        {external ? <ExternalLink className="h-3 w-3 opacity-50" /> : null}
                      </span>
                      {item.desc ? (
                        <span className="mt-0.5 block text-[11px] font-normal opacity-70">
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
                      <span className="mt-0.5 block text-[11px] font-normal opacity-70">
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
  /** Compact hero for deep pages */
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
  const { theme, setTheme } = useTheme();
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full bg-muted lg:hidden"
              aria-label="Docs menu"
              onClick={() => setMobileNav((v) => !v)}
            >
              {mobileNav ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <Link to="/docs" className="flex min-w-0 items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 text-primary">
                <BookOpen className="h-4 w-4" />
              </span>
              <span className="truncate font-extrabold tracking-tight">OpenPay Pro Docs</span>
            </Link>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {speechText ? (
              <PageListenButton
                id={`page:docs:${pathname}`}
                text={speechText}
                label="Listen"
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
              />
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 rounded-full"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button asChild size="sm" className="hidden rounded-full sm:inline-flex">
              <a href={PARTNER_PORTAL} target="_blank" rel="noreferrer">
                Partner portal
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
            <Button asChild size="sm" variant="secondary" className="rounded-full">
              <Link to="/website">Website</Link>
            </Button>
          </div>
        </div>
      </header>

      {mobileNav ? (
        <div className="border-b border-border bg-card px-4 py-4 lg:hidden">
          <NavList pathname={pathname} onNavigate={() => setMobileNav(false)} />
        </div>
      ) : null}

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 lg:py-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            <NavList pathname={pathname} />
          </div>
        </aside>

        <main className="min-w-0 space-y-10 pb-16">
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
            <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
