import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { OPENPAY_BRAND_BLUE, OPENPAY_LOGO_WHITE, startOpenPaySignIn } from "@/lib/openpay-auth";
import { startSolanaSignIn, PHANTOM_INSTALL_URL } from "@/lib/solana-auth";
import {
  TELEGRAM_AUTH_LOGO,
  TELEGRAM_BRAND_BLUE,
  startTelegramSignIn,
} from "@/lib/telegram-auth";
import { WALLETCONNECT_BRAND_BLUE, startWalletConnectSignIn } from "@/lib/walletconnect-auth";
import { METAMASK_EMBEDDED_BRAND } from "@/lib/web3auth-config";
import {
  PHANTOM_WALLET_LOGO,
  SOLANA_WALLET_LOGO,
  METAMASK_WALLET_LOGO,
  PI_NETWORK_AUTH_LOGO,
  ensureTopLevelAuthWindow,
} from "@/lib/phantom";
import { PhantomContinueButton, PhantomGoogleAppleLink } from "@/components/phantom-auth-lazy";
import { usePhantomClient } from "@/components/phantom-provider";
import { AppWeb3AuthProvider } from "@/components/web3auth-provider";
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { signInWithPi } from "@/lib/pi-network";
import { isPiBrowser } from "@/lib/piSdk";

const MetaMaskEmbeddedAuthPanel = lazy(() =>
  import("@/components/metamask-embedded-auth").then((m) => ({
    default: m.MetaMaskEmbeddedAuthPanel,
  })),
);

export const Route = createFileRoute("/authpi")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — OpenPay Pro Wallet" }] }),
  component: AuthPiPage,
});

type AuthMethod =
  | "openpay"
  | "telegram"
  | "solana"
  | "pi"
  | "phantom"
  | "walletconnect"
  | "metamask";

const AUTH_OPTIONS: {
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
    id: "telegram",
    label: "Telegram",
    desc: "Sign in with Telegram Login",
    accent: TELEGRAM_BRAND_BLUE,
    accentFg: "#ffffff",
    logoUrl: TELEGRAM_AUTH_LOGO,
    logoFit: "cover",
  },
  {
    id: "solana",
    label: "Solana",
    desc: "Phantom extension · works on desktop web",
    accent: "#000000",
    accentFg: "#ffffff",
    logoUrl: SOLANA_WALLET_LOGO,
    logoFit: "cover",
  },
  {
    id: "pi",
    label: "Pi Network",
    desc: "Continue with Pi Browser or OAuth",
    accent: "#7038A1",
    accentFg: "#ffffff",
    logoUrl: PI_NETWORK_AUTH_LOGO,
    logoFit: "cover",
  },
  {
    id: "phantom",
    label: "Phantom",
    desc: "Extension, Google, or Apple",
    accent: "#AB9FF2",
    accentFg: "#1a1330",
    logoUrl: PHANTOM_WALLET_LOGO,
    logoFit: "cover",
  },
  {
    id: "walletconnect",
    label: "WalletConnect",
    desc: "MetaMask · EVM wallet sign-in",
    accent: WALLETCONNECT_BRAND_BLUE,
    accentFg: "#ffffff",
  },
  {
    id: "metamask",
    label: "MetaMask",
    desc: "Social OAuth · Embedded Wallets",
    accent: "#E2761B",
    accentFg: "#ffffff",
    logoUrl: METAMASK_WALLET_LOGO,
    logoFit: "cover",
  },
];

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

function AuthOptionIcon({
  id,
  logoUrl,
  logoFit = "cover",
}: {
  id: AuthMethod;
  logoUrl?: string;
  logoFit?: "cover" | "contain";
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        width={44}
        height={44}
        className={cn(
          "h-full w-full",
          logoFit === "contain" ? "object-contain p-2" : "object-cover",
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
  return (
    <AppWeb3AuthProvider>
      <AuthPiPageInner />
    </AppWeb3AuthProvider>
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
    ensureTopLevelAuthWindow();
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) navigate({ to: "/dashboard" });
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

  function pick(id: AuthMethod) {
    setSelected(id);
    setPulseId(id);
    window.setTimeout(() => setPulseId((cur) => (cur === id ? null : cur)), 450);
  }

  async function continueWith(method: AuthMethod) {
    if (busy) return;
    if (!visibleOptions.some((o) => o.id === method)) return;
    if (method === "metamask" || method === "phantom") return;
    setBusy(true);
    try {
      if (method === "openpay") {
        await startOpenPaySignIn({ redirectTo: "/dashboard" });
        return;
      }
      if (method === "telegram") {
        await startTelegramSignIn({ redirectTo: "/dashboard" });
        return;
      }
      if (method === "solana") {
        await startSolanaSignIn({ redirectTo: "/dashboard" });
        return;
      }
      if (method === "pi") {
        await handlePiSignIn(navigate);
        return;
      }
      if (method === "walletconnect") {
        await startWalletConnectSignIn({ redirectTo: "/dashboard" });
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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="auth-orb absolute -top-28 left-[12%] h-80 w-80 rounded-full bg-primary/25 blur-3xl opacity-50" />
        <div className="auth-orb auth-orb-delay absolute -bottom-36 right-[8%] h-96 w-96 rounded-full bg-primary-glow/30 blur-3xl opacity-40" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-background/40 to-background" />
      </div>

      <div className="auth-select-enter w-full max-w-md">
        <div className="rounded-[1.75rem] border border-border/40 bg-card/95 p-7 shadow-card backdrop-blur-xl">
          <div className="mb-7 text-center">
            <div className="auth-badge-float mb-3 inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              Premium Web3 wallet
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to OpenPay Pro</h1>
            <p className="mt-1 text-sm text-muted-foreground">Select your sign-in method</p>
          </div>

          <div
            className="grid grid-cols-2 gap-3"
            role="listbox"
            aria-label="Sign-in methods"
            aria-activedescendant={selected ? `auth-opt-${selected}` : undefined}
          >
            {visibleOptions.map((opt, i) => {
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
                  style={
                    {
                      "--auth-accent": opt.accent,
                      animationDelay: `${90 + i * 75}ms`,
                    } as CSSProperties
                  }
                  className={cn(
                    "auth-option relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border p-3.5 text-left",
                    "auth-option-enter transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out",
                    "disabled:opacity-60",
                    isOn ? "auth-option-selected" : "border-border/70 bg-muted/30",
                    pulseId === opt.id && "auth-option-pulse",
                  )}
                >
                  <span
                    className={cn(
                      "auth-option-icon grid h-11 w-11 place-items-center overflow-hidden rounded-xl transition-transform duration-200 ease-out",
                    )}
                    style={{ backgroundColor: opt.accent }}
                  >
                    <AuthOptionIcon id={opt.id} logoUrl={opt.logoUrl} logoFit={opt.logoFit} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{opt.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                      {opt.desc}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full transition-all duration-200 ease-out",
                      isOn ? "scale-100 opacity-100" : "scale-75 opacity-0",
                    )}
                    style={{
                      backgroundColor: isOn
                        ? `color-mix(in oklab, ${opt.accent} 22%, transparent)`
                        : undefined,
                      color: opt.accent,
                    }}
                  >
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-2">
            {selected === "metamask" ? (
              <div key="metamask-panel" className="auth-cta-swap">
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
            </Link>{" "}
            &{" "}
            <Link
              to="/privacy"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Privacy Policy
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
    sessionStorage.setItem("pi_oauth_redirect", "/dashboard");
    const redirectUri = `${window.location.origin}/auth/pi/callback`;
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
  void navigate({ to: "/dashboard" });
}
