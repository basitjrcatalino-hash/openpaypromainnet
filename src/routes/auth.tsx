import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OPENPAY_BRAND_BLUE, OPENPAY_LOGO_WHITE, startOpenPaySignIn } from "@/lib/openpay-auth";
import { Button } from "@/components/ui/button";
import { startPiSignIn } from "@/lib/pi-signin";

const POST_AUTH_KEY = "post_auth_redirect";

function postAuthTarget(): string {
  try {
    const v = sessionStorage.getItem(POST_AUTH_KEY);
    if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  } catch {
    /* ignore */
  }
  return "/dashboard";
}

/**
 * `/auth` — OpenPay-only sign-in.
 * Child OAuth callbacks (`/auth/openpay/callback`, etc.) still render via Outlet.
 */
export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    s: Record<string, unknown>,
  ): { method?: string; mode?: "signin" | "signup"; next?: string } => {
    const mode = typeof s.mode === "string" ? s.mode.toLowerCase() : undefined;
    const next = typeof s.next === "string" ? s.next : undefined;
    return {
      mode: mode === "signin" || mode === "signup" ? mode : undefined,
      next: next && next.startsWith("/") && !next.startsWith("//") ? next : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Sign in with OpenPay — OpenPay Pro Wallet" },
      {
        name: "description",
        content:
          "Sign in to OpenPay Pro with your OpenPay account to manage OUSD, tokens, and payments.",
      },
      { property: "og:title", content: "Sign in with OpenPay — OpenPay Pro Wallet" },
      {
        property: "og:description",
        content: "Sign in to OpenPay Pro with your OpenPay account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://openpaypro.space/auth" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/auth" }],
  }),
  component: AuthLayout,
});

function AuthLayout() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <OpenPayAuthPage />;
}

function OpenPayAuthPage() {
  const search = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const next = new URLSearchParams(window.location.search).get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        sessionStorage.setItem(POST_AUTH_KEY, next);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next =
        search.next && search.next.startsWith("/") && !search.next.startsWith("//")
          ? search.next
          : "/dashboard";
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (data.user) {
        window.location.assign(next);
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session || cancelled) return;
      const refreshed = await supabase.auth.refreshSession();
      if (cancelled) return;
      if (refreshed.data.user) {
        window.location.assign(next);
        return;
      }
      const msg = refreshed.error?.message || "";
      if (/invalid|expired|session missing|refresh.?token/i.test(msg)) {
        await supabase.auth.signOut({ scope: "local" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.next]);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-y-auto bg-[#0c0a1a] px-4 py-8 text-white sm:py-10">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="auth-bg-mesh absolute inset-0" />
        <div className="auth-orb absolute -top-20 left-[10%] h-112 w-md rounded-full bg-[#7c3aed]/30 blur-[100px] animate-[auth-float_8s_ease-in-out_infinite]" />
        <div className="auth-orb auth-orb-delay absolute -bottom-24 right-[5%] h-128 w-lg rounded-full bg-[#6366f1]/25 blur-[120px] animate-[auth-float_10s_ease-in-out_infinite_reverse]" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-[#0c0a1a]/50 to-[#0c0a1a]" />
      </div>

      <div className="auth-select-enter w-full max-w-sm py-2">
        <div className="rounded-[1.75rem] border border-white/8 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-7">
          <div className="mb-6 text-center">
            <div className="auth-badge-float mb-3 inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              Premium Web3 wallet
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">OpenPay Pro</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {search.mode === "signup" ? "Create your account" : "Sign in to continue"}
            </p>
          </div>

          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
              style={{ backgroundColor: OPENPAY_BRAND_BLUE }}
            >
              <img src={OPENPAY_LOGO_WHITE} alt="" className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-base font-semibold">OpenPay</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Sign in with your OpenPay account
              </span>
            </span>
          </div>

          <Button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await startOpenPaySignIn({ redirectTo: postAuthTarget() });
              } catch (err) {
                toast.error((err as Error).message || "Could not start OpenPay sign-in");
                setBusy(false);
              }
            }}
            className="h-12 w-full rounded-xl text-base font-semibold text-white transition-opacity hover:opacity-95"
            style={{ backgroundColor: OPENPAY_BRAND_BLUE }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="inline-flex items-center gap-1.5">
                Continue with OpenPay
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </Button>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              try {
                startPiSignIn({ redirectTo: postAuthTarget() });
              } catch (err) {
                toast.error((err as Error).message || "Could not start Pi sign-in");
              }
            }}
            className="h-12 w-full rounded-xl border-white/12 bg-white/5 text-base font-semibold hover:bg-white/10"
          >
            <span className="inline-flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#7d4bd1] text-sm font-bold text-white">
                &#960;
              </span>
              Continue with Pi Network
            </span>
          </Button>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            By continuing you agree to OpenPay&apos;s{" "}
            <Link to="/terms" className="font-medium text-foreground underline-offset-2 hover:underline">
              Terms
            </Link>
            ,{" "}
            <Link to="/privacy" className="font-medium text-foreground underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            ,{" "}
            <Link to="/regulatory" className="font-medium text-foreground underline-offset-2 hover:underline">
              Regulatory Status
            </Link>
            , and{" "}
            <Link to="/legal" className="font-medium text-foreground underline-offset-2 hover:underline">
              Software License
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
