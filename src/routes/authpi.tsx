import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, ChevronRight, Loader2, Mail } from "lucide-react";
import { OPENPAY_BRAND_BLUE, OPENPAY_LOGO_WHITE, startOpenPaySignIn } from "@/lib/openpay-auth";
import { startSolanaSignIn, PHANTOM_INSTALL_URL } from "@/lib/solana-auth";
import { TELEGRAM_AUTH_LOGO, TELEGRAM_BRAND_BLUE, startTelegramSignIn } from "@/lib/telegram-auth";
import { WALLETCONNECT_BRAND_BLUE, startWalletConnectSignIn } from "@/lib/walletconnect-auth";
import { METAMASK_EMBEDDED_BRAND } from "@/lib/web3auth-env";
import {
  PHANTOM_WALLET_LOGO,
  SOLANA_WALLET_LOGO,
  METAMASK_WALLET_LOGO,
  PI_NETWORK_AUTH_LOGO,
  ensureTopLevelAuthWindow,
} from "@/lib/phantom";
import { PhantomContinueButton, PhantomGoogleAppleLink } from "@/components/phantom-auth-lazy";
import { AppPhantomProvider, usePhantomClient } from "@/components/phantom-provider";
import { AppWeb3AuthProvider } from "@/components/web3auth-provider";
import { AppPrivyProvider } from "@/components/privy-provider";
import { PRIVY_APP_ID, PRIVY_BRAND_COLOR, completePrivySupabaseSession } from "@/lib/privy-auth";
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithPi } from "@/lib/pi-network";
import { isPiBrowser } from "@/lib/piSdk";

const MetaMaskEmbeddedAuthPanel = lazy(() =>
  import("@/components/metamask-embedded-auth").then((m) => ({
    default: m.MetaMaskEmbeddedAuthPanel,
  })),
);

const POST_AUTH_KEY = "post_auth_redirect";

/** Where to land after sign-in — honours ?next= (same-origin path only). */
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
  head: () => ({
    meta: [
      { title: "Sign in — OpenPay Pro Wallet" },
      {
        name: "description",
        content:
          "Sign in to OpenPay Pro with email, Pi Network, OpenPay, Phantom, MetaMask, or Telegram to manage OUSD, Pi, tokens, and NFTs.",
      },
      { property: "og:title", content: "Sign in — OpenPay Pro Wallet" },
      {
        property: "og:description",
        content: "Sign in with email, Pi Network, OpenPay, Phantom, MetaMask, or Telegram.",
      },
      { property: "og:url", content: "https://openpaypro.space/authpi" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/authpi" }],
  }),
  component: AuthPiPage,
});

type AuthMethod =
  | "openpay"
  | "telegram"
  | "solana"
  | "pi"
  | "phantom"
  | "walletconnect"
  | "metamask"
  | "privy"
  | "email";

type AuthGroup = "wallet" | "social";

const AUTH_OPTIONS: {
  id: AuthMethod;
  label: string;
  desc: string;
  accent: string;
  accentFg: string;
  logoUrl?: string;
  logoFit?: "cover" | "contain";
  featured?: boolean;
  group?: AuthGroup;
}[] = [
  {
    id: "openpay",
    label: "OpenPay",
    desc: "Sign in with your OpenPay account",
    accent: OPENPAY_BRAND_BLUE,
    accentFg: "#ffffff",
    logoUrl: OPENPAY_LOGO_WHITE,
    logoFit: "contain",
    featured: true,
  },
  {
    id: "phantom",
    label: "Phantom",
    desc: "Extension · Google · Apple",
    accent: "#AB9FF2",
    accentFg: "#1a1330",
    logoUrl: PHANTOM_WALLET_LOGO,
    logoFit: "cover",
    group: "wallet",
  },
  {
    id: "solana",
    label: "Solana",
    desc: "Phantom extension",
    accent: "#000000",
    accentFg: "#ffffff",
    logoUrl: SOLANA_WALLET_LOGO,
    logoFit: "cover",
    group: "wallet",
  },
  {
    id: "walletconnect",
    label: "WalletConnect",
    desc: "EVM wallets",
    accent: WALLETCONNECT_BRAND_BLUE,
    accentFg: "#ffffff",
    group: "wallet",
  },
  {
    id: "metamask",
    label: "MetaMask",
    desc: "Social · Embedded",
    accent: "#E2761B",
    accentFg: "#ffffff",
    logoUrl: METAMASK_WALLET_LOGO,
    logoFit: "cover",
    group: "wallet",
  },
  {
    id: "pi",
    label: "Pi Network",
    desc: "Sign in with your Pi account",
    accent: "#7038A1",
    accentFg: "#ffffff",
    logoUrl: PI_NETWORK_AUTH_LOGO,
    logoFit: "cover",
    group: "social",
  },
  {
    id: "telegram",
    label: "Telegram",
    desc: "Telegram Login",
    accent: TELEGRAM_BRAND_BLUE,
    accentFg: "#ffffff",
    logoUrl: TELEGRAM_AUTH_LOGO,
    logoFit: "cover",
    group: "social",
  },
  {
    id: "email",
    label: "Email",
    desc: "Sign in with email and password",
    accent: "#6366f1",
    accentFg: "#ffffff",
    group: "social",
  },
  {
    id: "privy",
    label: "Privy",
    desc: "Google · Apple · Email · SMS",
    accent: PRIVY_BRAND_COLOR,
    accentFg: "#ffffff",
    group: "social",
  },
];

function PrivyLoginButton({ busy, setBusy }: { busy: boolean; setBusy: (v: boolean) => void }) {
  if (!PRIVY_APP_ID) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          disabled
          className="h-12 w-full rounded-full"
          style={{ backgroundColor: PRIVY_BRAND_COLOR, color: "#fff" }}
        >
          Privy not configured
        </Button>
        <p className="text-center text-[11px] text-destructive">Set VITE_PRIVY_APP_ID to enable</p>
      </div>
    );
  }

  return (
    <AppPrivyProvider>
      <PrivyLoginInner busy={busy} setBusy={setBusy} />
    </AppPrivyProvider>
  );
}

function EmailAuthPanel({ busy, setBusy }: { busy: boolean; setBusy: (v: boolean) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      toast.error("Enter your email and password");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: trimmed,
          password,
          options: { data: { provider: "email" } },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created");
          goPostAuth();
          return;
        }
        toast.success("Check your email to confirm your account, then sign in");
        setMode("signin");
        setBusy(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) throw error;
      goPostAuth();
    } catch (err) {
      toast.error((err as Error).message || "Email sign-in failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <Input
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@email.com"
        value={email}
        disabled={busy}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-muted-foreground"
      />
      <Input
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        placeholder="Password"
        value={password}
        disabled={busy}
        onChange={(e) => setPassword(e.target.value)}
        className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-muted-foreground"
      />
      <Button
        type="submit"
        disabled={busy}
        className="h-12 w-full rounded-full text-base font-semibold"
        style={{ backgroundColor: "#6366f1", color: "#fff" }}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : mode === "signin" ? (
          "Sign in with email"
        ) : (
          "Create account"
        )}
      </Button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}

type PrivyHook = () => {
  login: () => void;
  ready: boolean;
  authenticated: boolean;
  user: {
    id: string;
    email?: { address: string } | null;
    wallet?: { address: string } | null;
  } | null;
};

function PrivyLoginInner({ busy, setBusy }: { busy: boolean; setBusy: (v: boolean) => void }) {
  const [usePrivy, setUsePrivy] = useState<PrivyHook | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const m = await import("@privy-io/react-auth");
        if (!cancelled) setUsePrivy(() => m.usePrivy as PrivyHook);
      } catch (err) {
        console.error("[privy] Failed to load SDK", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!usePrivy) {
    return (
      <Button
        type="button"
        disabled
        className="h-12 w-full rounded-full"
        style={{ backgroundColor: PRIVY_BRAND_COLOR, color: "#fff" }}
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Privy…
      </Button>
    );
  }

  return <PrivySessionButton usePrivy={usePrivy} busy={busy} setBusy={setBusy} />;
}

function PrivySessionButton({
  usePrivy,
  busy,
  setBusy,
}: {
  usePrivy: PrivyHook;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const { login, ready, authenticated, user } = usePrivy();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authenticated || !user) return;
    let cancelled = false;
    void (async () => {
      setBusy(true);
      try {
        await completePrivySupabaseSession({
          id: user.id,
          email: user.email,
          wallet: user.wallet,
        });
        if (!cancelled) goPostAuth();
      } catch (err) {
        if (!cancelled) {
          toast.error((err as Error).message || "Privy sign-in failed");
          setBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, user, navigate, setBusy]);

  return (
    <Button
      type="button"
      disabled={busy || !ready}
      onClick={() => login()}
      className="h-12 w-full rounded-full text-base font-semibold"
      style={{ backgroundColor: PRIVY_BRAND_COLOR, color: "#fff" }}
    >
      {!ready ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {ready ? "Continue with Privy" : "Initializing…"}
    </Button>
  );
}

function WalletConnectMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        fill="currentColor"
        d="M6.5 9.2c2.9-2.8 7.6-2.8 10.5 0l.35.33a.36.36 0 0 1 0 .52l-1.2 1.14a.19.19 0 0 1-.26 0l-.48-.46c-2-1.95-5.3-1.95-7.32 0l-.52.49a.19.19 0 0 1-.26 0L5.66 10a.36.36 0 0 1 0-.52l.84-.8Zm13 2.48 1.06 1a.36.36 0 0 1 0 .52l-4.8 4.55a.74.74 0 0 1-1.02 0l-3.4-3.23a.1.1 0 0 0-.13 0l-3.4 3.23a.74.74 0 0 1-1.02 0L1.99 13.2a.36.36 0 0 1 0-.52l1.06-1a.74.74 0 0 1 1.02 0l3.4 3.23a.1.1 0 0 0 .13 0l3.4-3.23a.74.74 0 0 1 1.02 0l3.4 3.23a.1.1 0 0 0 .13 0l3.4-3.23a.74.74 0 0 1 1.02 0Z"
      />
    </svg>
  );
}

function PrivyMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" fill="none">
      {/* Privy-style logomark: soft rounded tile + P */}
      <rect x="3" y="3" width="26" height="26" rx="8" fill="currentColor" opacity="0.22" />
      <path
        fill="currentColor"
        d="M10 8h7.4c3.85 0 6.35 2.15 6.35 5.55 0 3.45-2.5 5.6-6.35 5.6H14.1V24H10V8Zm4.1 7.9h3c1.65 0 2.65-.9 2.65-2.35S18.75 11.2 17.1 11.2h-3v4.7Z"
      />
    </svg>
  );
}

function AuthOptionIcon({
  id,
  logoUrl,
  logoFit = "cover",
}: {
  id: AuthMethod;
  logoUrl?: string;
  logoFit?: "cover" | "contain";
}) {
  if (id === "email") {
    return <Mail className="h-5 w-5 text-white" strokeWidth={2} />;
  }
  if (id === "privy") {
    return <PrivyMark className="h-7 w-7 text-white" />;
  }
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        width={40}
        height={40}
        className={cn(
          "h-full w-full",
          logoFit === "contain" ? "object-contain p-1.5" : "object-cover",
        )}
        draggable={false}
      />
    );
  }
  if (id === "walletconnect") {
    return <WalletConnectMark className="h-5 w-5 text-white" />;
  }
  return null;
}

function AuthPiPage() {
  // Phantom only here — never mount Web3Auth until MetaMask is selected
  // (SafeEventEmitter crashes if `events.EventEmitter` interop is broken).
  return (
    <AppPhantomProvider>
      <AuthPiPageInner />
    </AppPhantomProvider>
  );
}

function AuthPiPageInner() {
  const navigate = useNavigate();
  const {
    ready: phantomReady,
    status: phantomStatus,
    error: phantomError,
    retry: retryPhantom,
  } = usePhantomClient();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<AuthMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [pulseId, setPulseId] = useState<AuthMethod | null>(null);

  useEffect(() => {
    captureNextParam();
    ensureTopLevelAuthWindow();
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) goPostAuth();
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const inPiBrowser = isPiBrowser();
  const visibleOptions = inPiBrowser
    ? AUTH_OPTIONS.filter((o) => o.id === "openpay" || o.id === "pi")
    : AUTH_OPTIONS;

  function renderFeaturedOption(opt: (typeof AUTH_OPTIONS)[number], delayMs = 0) {
    const isOn = selected === opt.id;
    return (
      <button
        key={opt.id}
        id={`auth-opt-${opt.id}`}
        type="button"
        role="option"
        aria-selected={isOn}
        disabled={busy}
        onClick={() => pick(opt.id)}
        style={{ "--auth-accent": opt.accent, animationDelay: `${delayMs}ms` } as CSSProperties}
        className={cn(
          "auth-option auth-option-featured relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border px-4 py-3.5 text-left",
          "auth-option-enter transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out",
          "disabled:opacity-60",
          isOn ? "auth-option-selected" : "border-border/60 bg-muted/20",
          pulseId === opt.id && "auth-option-pulse",
        )}
      >
        <span
          className="auth-option-icon grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl"
          style={{ backgroundColor: opt.accent }}
        >
          <AuthOptionIcon id={opt.id} logoUrl={opt.logoUrl} logoFit={opt.logoFit} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-foreground">{opt.label}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{opt.desc}</span>
        </span>
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full transition-all duration-200",
            isOn ? "scale-100 opacity-100" : "scale-75 opacity-0",
          )}
          style={{
            backgroundColor: isOn
              ? `color-mix(in oklab, ${opt.accent} 22%, transparent)`
              : undefined,
            color: opt.accent,
          }}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      </button>
    );
  }

  function pick(id: AuthMethod) {
    setSelected(id);
    setPulseId(id);
    window.setTimeout(() => setPulseId((cur) => (cur === id ? null : cur)), 450);
  }

  async function continueWith(method: AuthMethod) {
    if (busy) return;
    if (!visibleOptions.some((o) => o.id === method)) return;
    if (method === "metamask" || method === "phantom" || method === "privy" || method === "email")
      return;
    setBusy(true);
    try {
      if (method === "openpay") {
        await startOpenPaySignIn({ redirectTo: postAuthTarget() });
        return;
      }
      if (method === "telegram") {
        await startTelegramSignIn({ redirectTo: postAuthTarget() });
        return;
      }
      if (method === "solana") {
        await startSolanaSignIn({ redirectTo: postAuthTarget() });
        return;
      }
      if (method === "pi") {
        await handlePiSignIn(navigate);
        return;
      }
      if (method === "walletconnect") {
        await startWalletConnectSignIn({ redirectTo: postAuthTarget() });
        return;
      }
    } catch (err) {
      const message = (err as Error).message || "Sign-in failed";
      if (!/reject|cancel|denied/i.test(message)) {
        toast.error(message, {
          action: /No Solana wallet|Install the Phantom/i.test(message)
            ? {
                label: "Install Phantom",
                onClick: () => window.open(PHANTOM_INSTALL_URL, "_blank", "noopener,noreferrer"),
              }
            : undefined,
        });
      }
      setBusy(false);
    }
  }

  const selectedOpt = visibleOptions.find((o) => o.id === selected) ?? null;
  const featuredOpt = inPiBrowser ? null : (visibleOptions.find((o) => o.featured) ?? null);
  const piBrowserRows = inPiBrowser ? visibleOptions : [];
  const gridOptions = inPiBrowser ? [] : visibleOptions.filter((o) => !o.featured);
  const walletOptions = gridOptions.filter((o) => o.group === "wallet");
  const socialOptions = gridOptions.filter((o) => o.group === "social" || !o.group);

  function renderAuthTile(
    opt: (typeof AUTH_OPTIONS)[number],
    i: number,
    delayBase = 80,
  ) {
    const isOn = selected === opt.id;
    return (
      <button
        key={opt.id}
        id={`auth-opt-${opt.id}`}
        type="button"
        role="option"
        aria-selected={isOn}
        disabled={busy}
        onClick={() => pick(opt.id)}
        title={opt.desc}
        style={
          {
            "--auth-accent": opt.accent,
            animationDelay: `${delayBase + i * 40}ms`,
          } as CSSProperties
        }
        className={cn(
          "auth-option auth-option-tile relative flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center",
          "auth-option-enter transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out",
          "disabled:opacity-60",
          isOn ? "auth-option-selected" : "border-border/55 bg-muted/20",
          pulseId === opt.id && "auth-option-pulse",
        )}
      >
        <span
          className="auth-option-icon grid h-11 w-11 place-items-center overflow-hidden rounded-xl"
          style={{ backgroundColor: opt.accent }}
        >
          <AuthOptionIcon id={opt.id} logoUrl={opt.logoUrl} logoFit={opt.logoFit} />
        </span>
        <span className="w-full truncate text-[11px] font-semibold leading-tight text-foreground">
          {opt.label}
        </span>
        <span
          className={cn(
            "absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full transition-all duration-200",
            isOn ? "scale-100 opacity-100" : "scale-75 opacity-0",
          )}
          style={{
            backgroundColor: isOn
              ? `color-mix(in oklab, ${opt.accent} 22%, transparent)`
              : undefined,
            color: opt.accent,
          }}
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      </button>
    );
  }

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-y-auto bg-[#0c0a1a] px-4 py-8 text-white sm:py-10">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="auth-bg-mesh absolute inset-0" />
        <div className="auth-orb absolute -top-20 left-[10%] h-112 w-md rounded-full bg-[#7c3aed]/30 blur-[100px] animate-[auth-float_8s_ease-in-out_infinite]" />
        <div className="auth-orb auth-orb-delay absolute -bottom-24 right-[5%] h-128 w-lg rounded-full bg-[#6366f1]/25 blur-[120px] animate-[auth-float_10s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-[30%] left-[55%] h-60 w-60 rounded-full bg-[#a78bfa]/20 blur-[80px] animate-[auth-float_12s_ease-in-out_2s_infinite]" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-[#0c0a1a]/50 to-[#0c0a1a]" />
      </div>

      <div className="auth-select-enter w-full max-w-sm py-2">
        <div className="rounded-[1.75rem] border border-white/8 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-7">
          <div className="mb-6 text-center">
            <div className="auth-badge-float mb-3 inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              Premium Web3 wallet
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">OpenPay Pro</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to continue</p>
          </div>

          <div
            role="listbox"
            aria-label="Sign-in methods"
            aria-activedescendant={selected ? `auth-opt-${selected}` : undefined}
            className="space-y-4"
          >
            {inPiBrowser ? (
              <div className="space-y-3">
                {piBrowserRows.map((opt, i) => (
                  <div key={opt.id}>
                    {i > 0 ? (
                      <div className="mb-3 flex items-center gap-3 px-1">
                        <div className="h-px flex-1 bg-border/70" />
                        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          or continue with
                        </span>
                        <div className="h-px flex-1 bg-border/70" />
                      </div>
                    ) : null}
                    {renderFeaturedOption(opt, i * 60)}
                  </div>
                ))}
              </div>
            ) : featuredOpt ? (
              renderFeaturedOption(featuredOpt)
            ) : null}

            {gridOptions.length > 0 ? (
              <div className="space-y-4">
                {featuredOpt ? (
                  <div className="flex items-center gap-3 px-1">
                    <div className="h-px flex-1 bg-border/70" />
                    <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      or continue with
                    </span>
                    <div className="h-px flex-1 bg-border/70" />
                  </div>
                ) : null}

                {walletOptions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Wallets
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {walletOptions.map((opt, i) => renderAuthTile(opt, i, 80))}
                    </div>
                  </div>
                ) : null}

                {socialOptions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Social &amp; network
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {socialOptions.map((opt, i) =>
                        renderAuthTile(opt, i, 80 + walletOptions.length * 40),
                      )}
                    </div>
                  </div>
                ) : null}

                {selectedOpt && !selectedOpt.featured ? (
                  <p className="auth-cta-swap text-center text-xs text-muted-foreground">
                    {selectedOpt.desc}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-5 space-y-2">
            {selected === "metamask" ? (
              <div key="metamask-panel" className="auth-cta-swap">
                <AppWeb3AuthProvider
                  fallback={
                    <Button type="button" disabled className="h-12 w-full rounded-full">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading MetaMask…
                    </Button>
                  }
                >
                  <Suspense
                    fallback={
                      <Button type="button" disabled className="h-12 w-full rounded-full">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading MetaMask…
                      </Button>
                    }
                  >
                    <MetaMaskEmbeddedAuthPanel
                      busy={busy}
                      setBusy={setBusy}
                      accent={selectedOpt?.accent ?? METAMASK_EMBEDDED_BRAND}
                      accentFg={selectedOpt?.accentFg ?? "#ffffff"}
                    />
                  </Suspense>
                </AppWeb3AuthProvider>
              </div>
            ) : selected === "phantom" ? (
              <div key="phantom-panel" className="auth-cta-swap space-y-2">
                {phantomReady ? (
                  <>
                    <PhantomContinueButton
                      busy={busy}
                      setBusy={setBusy}
                      accent={selectedOpt?.accent ?? "#AB9FF2"}
                      accentFg={selectedOpt?.accentFg ?? "#1a1330"}
                    />
                    <PhantomGoogleAppleLink busy={busy} />
                  </>
                ) : phantomStatus === "error" ? (
                  <div className="space-y-2">
                    <p className="text-center text-xs text-destructive">
                      {phantomError || "Phantom Connect failed to load."}
                    </p>
                    <Button
                      type="button"
                      className="h-12 w-full rounded-full text-base font-semibold"
                      style={{
                        backgroundColor: selectedOpt?.accent ?? "#AB9FF2",
                        color: selectedOpt?.accentFg ?? "#1a1330",
                      }}
                      onClick={() => retryPhantom()}
                    >
                      Retry Phantom
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-full"
                      disabled={busy}
                      onClick={() => {
                        setSelected("solana");
                        void continueWith("solana");
                      }}
                    >
                      Continue with Solana instead
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      disabled
                      className="h-12 w-full rounded-full"
                      style={{
                        backgroundColor: selectedOpt?.accent ?? "#AB9FF2",
                        color: selectedOpt?.accentFg ?? "#1a1330",
                      }}
                    >
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading Phantom…
                    </Button>
                    <p className="text-center text-[11px] text-muted-foreground">
                      Preparing wallet connect. If this stalls, pick Solana or retry.
                    </p>
                  </div>
                )}
              </div>
            ) : selected === "privy" ? (
              <div key="privy-panel" className="auth-cta-swap">
                <PrivyLoginButton busy={busy} setBusy={setBusy} />
              </div>
            ) : selected === "email" ? (
              <div key="email-panel" className="auth-cta-swap">
                <EmailAuthPanel busy={busy} setBusy={setBusy} />
              </div>
            ) : (
              <Button
                key={selected ?? "none"}
                type="button"
                disabled={!selected || busy}
                onClick={() => selected && void continueWith(selected)}
                className={cn(
                  "auth-cta-swap h-12 w-full rounded-full text-base font-semibold",
                  "transition-[background-color,color,opacity,transform] duration-200 ease-out",
                  "hover:opacity-95 hover:brightness-105 active:scale-[0.99] disabled:opacity-50",
                )}
                style={
                  selectedOpt
                    ? { backgroundColor: selectedOpt.accent, color: selectedOpt.accentFg }
                    : undefined
                }
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    {selected ? `Continue with ${selectedOpt?.label}` : "Select a method"}
                    {selected ? <ChevronRight className="h-4 w-4" /> : null}
                  </span>
                )}
              </Button>
            )}
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground">
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
    </div>
  );
}

async function handlePiSignIn(navigate: ReturnType<typeof useNavigate>) {
  const PI_CLIENT_ID = import.meta.env.VITE_PI_CLIENT_ID as string | undefined;

  if (!isPiBrowser()) {
    if (!PI_CLIENT_ID) {
      throw new Error("Pi sign-in is not configured (missing client ID).");
    }
    const state = crypto.randomUUID?.()
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("pi_oauth_state", state);
    sessionStorage.setItem("pi_oauth_redirect", postAuthTarget());
    // Pi rejects any redirect_uri that isn't allowlisted in the Developer Portal.
    // Set VITE_PI_REDIRECT_URI to pin one exact allowlisted URI (e.g. preview/iframe origins).
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
