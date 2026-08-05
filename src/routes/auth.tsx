import { useEffect, useState } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useChildMatches,
} from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  EmailAuthPanel,
  captureEmailAuthNextParam,
} from "@/components/email-auth-panel";

/**
 * `/auth` — email sign-in / sign-up.
 * Child OAuth callbacks (`/auth/pi/callback`, `/auth/openpay/callback`, etc.) still render via Outlet.
 * Non-email `?method=` deep links forward to `/authpi`.
 */
export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    s: Record<string, unknown>,
  ): { method?: string; mode?: "signin" | "signup"; next?: string } => {
    const method = typeof s.method === "string" ? s.method.toLowerCase() : undefined;
    const mode = typeof s.mode === "string" ? s.mode.toLowerCase() : undefined;
    const next = typeof s.next === "string" ? s.next : undefined;
    return {
      method: method || undefined,
      mode: mode === "signin" || mode === "signup" ? mode : undefined,
      next: next && next.startsWith("/") && !next.startsWith("//") ? next : undefined,
    };
  },
  beforeLoad: ({ location, search }) => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    if (path !== "/auth") return;

    const method = search.method;
    if (method && method !== "email") {
      const forward: { method?: string; next?: string; mode?: string } = { method };
      if (search.next) forward.next = search.next;
      if (search.mode) forward.mode = search.mode;
      throw redirect({ to: "/authpi", search: forward } as never);
    }
  },
  head: () => ({
    meta: [
      { title: "Email sign in — OpenPay Pro Wallet" },
      {
        name: "description",
        content: "Sign in or create an OpenPay Pro account with email and password.",
      },
      { property: "og:title", content: "Email sign in — OpenPay Pro Wallet" },
      { property: "og:url", content: "https://openpaypro.space/auth" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/auth" }],
  }),
  component: AuthLayout,
});

function AuthLayout() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <EmailAuthPage />;
}

function EmailAuthPage() {
  const search = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    captureEmailAuthNextParam();
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        const next =
          search.next && search.next.startsWith("/") && !search.next.startsWith("//")
            ? search.next
            : "/dashboard";
        window.location.assign(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [search.next]);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="auth-bg-mesh absolute inset-0" />
        <div className="auth-orb absolute -top-20 left-[10%] h-112 w-md rounded-full bg-[#7c3aed]/30 blur-[100px] animate-[auth-float_8s_ease-in-out_infinite]" />
        <div className="auth-orb auth-orb-delay absolute -bottom-24 right-[5%] h-128 w-lg rounded-full bg-[#6366f1]/25 blur-[120px] animate-[auth-float_10s_ease-in-out_infinite_reverse]" />
      </div>

      <div className="auth-select-enter relative z-10 w-full max-w-sm py-2">
        <div className="mb-6 text-center">
          <div className="auth-badge-float mb-3 inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
            Premium Web3 wallet
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">OpenPay Pro</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {search.mode === "signup" ? "Create your account" : "Sign in with email"}
          </p>
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
            style={{ backgroundColor: "#6366f1" }}
          >
            <Mail className="h-5 w-5 text-white" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-base font-semibold text-foreground">Email</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Email and password
            </span>
          </span>
        </div>

        <EmailAuthPanel
          busy={busy}
          setBusy={setBusy}
          initialMode={search.mode === "signup" ? "signup" : "signin"}
        />

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Prefer another method?{" "}
          <Link
            to="/authpi"
            search={search.next ? { next: search.next } : undefined}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            All sign-in options
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to OpenPay&apos;s{" "}
          <Link
            to="/terms"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Terms
          </Link>
          ,{" "}
          <Link
            to="/privacy"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          ,{" "}
          <Link
            to="/regulatory"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Regulatory Status
          </Link>
          , and{" "}
          <Link
            to="/legal"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Software License
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
