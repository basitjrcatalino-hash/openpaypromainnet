import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { OPENPAY_BRAND_BLUE, OPENPAY_LOGO_WHITE, startOpenPaySignIn } from "@/lib/openpay-auth";
import { PI_NETWORK_AUTH_LOGO, ensureTopLevelAuthWindow } from "@/lib/phantom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { signInWithPi } from "@/lib/pi-network";
import { isPiBrowser } from "@/lib/piSdk";
import { EmailAuthPanel, captureEmailAuthNextParam } from "@/components/email-auth-panel";

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

function captureNextParam() {
  try {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      sessionStorage.setItem(POST_AUTH_KEY, next);
    }
  } catch {
    /* ignore */
  }
}

function goPostAuth() {
  const target = postAuthTarget();
  try {
    sessionStorage.removeItem(POST_AUTH_KEY);
  } catch {
    /* ignore */
  }
  window.location.assign(target);
}

export const Route = createFileRoute("/authpi")({
  ssr: false,
  validateSearch: (
    s: Record<string, unknown>,
  ): { method?: string; mode?: "signin" | "signup"; next?: string } => {
    const method = typeof s.method === "string" ? s.method.toLowerCase() : undefined;
    const mode = typeof s.mode === "string" ? s.mode.toLowerCase() : undefined;
    const next = typeof s.next === "string" ? s.next : undefined;
    return {
      method:
        method === "email" || method === "openpay" || method === "pi" ? method : undefined,
      mode: mode === "signin" || mode === "signup" ? mode : undefined,
      next: next && next.startsWith("/") && !next.startsWith("//") ? next : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Sign in — OpenPay Pro Wallet" },
      {
        name: "description",
        content:
          "Sign in to OpenPay Pro with your OpenPay account, Pi Network, or email to manage OUSD, Pi, tokens, and NFTs.",
      },
      { property: "og:title", content: "Sign in — OpenPay Pro Wallet" },
      {
        property: "og:description",
        content: "Sign in with OpenPay, Pi Network, or email.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://openpaypro.space/authpi" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/authpi" }],
  }),
  component: AuthPiPage,
});

type AuthMethod = "openpay" | "pi" | "email";

const METHODS: {
  id: AuthMethod;
  label: string;
  desc: string;
  accent: string;
  accentFg: string;
  logoUrl?: string;
  logoFit?: "cover" | "contain";
}[] = [
  {
    id: "openpay",
    label: "OpenPay",
    desc: "Sign in with your OpenPay account",
    accent: OPENPAY_BRAND_BLUE,
    accentFg: "#ffffff",
    logoUrl: OPENPAY_LOGO_WHITE,
    logoFit: "contain",
  },
  {
    id: "pi",
    label: "Pi Network",
    desc: "Continue with your Pi username",
    accent: "#7038A1",
    accentFg: "#ffffff",
    logoUrl: PI_NETWORK_AUTH_LOGO,
    logoFit: "cover",
  },
  {
    id: "email",
    label: "Email",
    desc: "Sign in or create an account with email",
    accent: "#6366f1",
    accentFg: "#ffffff",
  },
];

function AuthPiPage() {
  const search = Route.useSearch();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<AuthMethod>(
    () => (search.method as AuthMethod | undefined) ?? "openpay",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    captureNextParam();
    captureEmailAuthNextParam();
    ensureTopLevelAuthWindow();
    setMounted(true);
  }, []);

  useEffect(() => {
    if (search.method) setSelected(search.method as AuthMethod);
  }, [search.method]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (data.user) goPostAuth();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mounted) return null;

  async function continueWith(method: AuthMethod) {
    if (busy || method === "email") return;
    setBusy(true);
    try {
      if (method === "openpay") {
        await startOpenPaySignIn({ redirectTo: postAuthTarget() });
        return;
      }
      await handlePiSignIn();
    } catch (err) {
      const message = (err as Error).message || "Sign-in failed";
      if (!/reject|cancel|denied/i.test(message)) toast.error(message);
      setBusy(false);
    }
  }

  const selectedOpt = METHODS.find((m) => m.id === selected)!;

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-y-auto bg-[#0a0a14] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#1652f0]/25 blur-[120px]" />
        <div className="absolute bottom-[-6rem] right-[-4rem] h-80 w-80 rounded-full bg-[#7038A1]/25 blur-[120px]" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-[#0a0a14]/60 to-[#0a0a14]" />
      </div>

      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-8">
          <div className="mb-7 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure wallet access
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">OpenPay Pro</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Choose how you want to sign in
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Sign-in methods"
            className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/30 p-1.5"
          >
            {METHODS.map((m) => {
              const on = selected === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  disabled={busy}
                  onClick={() => setSelected(m.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl px-2 py-3 transition-all duration-200",
                    on
                      ? "bg-white/10 shadow-lg shadow-black/30 ring-1 ring-white/15"
                      : "opacity-70 hover:opacity-100",
                  )}
                >
                  <span
                    className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl"
                    style={{ backgroundColor: m.accent }}
                  >
                    {m.logoUrl ? (
                      <img
                        src={m.logoUrl}
                        alt=""
                        className={cn(
                          "h-full w-full",
                          m.logoFit === "contain" ? "object-contain p-1.5" : "object-cover",
                        )}
                        draggable={false}
                      />
                    ) : (
                      <Mail className="h-5 w-5 text-white" strokeWidth={2} />
                    )}
                  </span>
                  <span className="text-[11px] font-semibold leading-tight">{m.label}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">{selectedOpt.desc}</p>

          <div className="mt-5">
            {selected === "email" ? (
              <EmailAuthPanel
                busy={busy}
                setBusy={setBusy}
                initialMode={search.mode ?? "signin"}
              />
            ) : (
              <Button
                type="button"
                disabled={busy}
                onClick={() => void continueWith(selected)}
                className="h-12 w-full rounded-full text-base font-semibold transition hover:brightness-110 active:scale-[0.99]"
                style={{ backgroundColor: selectedOpt.accent, color: selectedOpt.accentFg }}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    Continue with {selectedOpt.label}
                    <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            )}
          </div>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
            By continuing you agree to OpenPay&apos;s{" "}
            <Link to="/terms" className="font-medium text-foreground hover:underline">
              Terms
            </Link>
            ,{" "}
            <Link to="/privacy" className="font-medium text-foreground hover:underline">
              Privacy Policy
            </Link>
            ,{" "}
            <Link to="/regulatory" className="font-medium text-foreground hover:underline">
              Regulatory Status
            </Link>
            , and{" "}
            <Link to="/legal" className="font-medium text-foreground hover:underline">
              Software License
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

async function handlePiSignIn() {
  const PI_CLIENT_ID = import.meta.env.VITE_PI_CLIENT_ID as string | undefined;

  if (!isPiBrowser()) {
    if (!PI_CLIENT_ID) throw new Error("Pi sign-in is not configured (missing client ID).");
    const state = crypto.randomUUID?.()
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("pi_oauth_state", state);
    sessionStorage.setItem("pi_oauth_redirect", postAuthTarget());
    const redirectUri =
      (import.meta.env.VITE_PI_REDIRECT_URI as string | undefined)?.trim() ||
      `${window.location.origin}/auth/pi/callback`;
    window.location.href =
      `https://accounts.pinet.com/oauth/authorize` +
      `?response_type=token` +
      `&client_id=${encodeURIComponent(PI_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent("username wallet_address")}` +
      `&state=${encodeURIComponent(state)}`;
    return;
  }

  const { username } = await signInWithPi();
  toast.success(`Signed in as @${username} via Pi Network`);
  goPostAuth();
}
