import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import {
  AddressType,
  useAccounts,
  useConnect,
  useIsExtensionInstalled,
  useModal,
  usePhantom,
} from "@phantom/react-sdk";
import {
  OPENPAY_BRAND_BLUE,
  OPENPAY_LOGO_WHITE,
  startOpenPaySignIn,
} from "@/lib/openpay-auth";
import { SOLANA_BRAND_PURPLE, startSolanaSignIn } from "@/lib/solana-auth";
import { signInWithPi } from "@/lib/pi-network";
import { PI_NETWORK_LOGO_URL } from "@/lib/token-logos";
import { getPhantomRedirectUrl, PHANTOM_APP_ICON } from "@/lib/phantom";
import { usePhantomClientReady } from "@/components/phantom-provider";
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/authpi")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — OpenPay Pro Wallet" }] }),
  component: AuthPiPage,
});

type AuthMethod = "openpay" | "solana" | "pi" | "phantom";

const AUTH_OPTIONS: {
  id: AuthMethod;
  label: string;
  desc: string;
  accent: string;
  accentFg: string;
}[] = [
  {
    id: "openpay",
    label: "OpenPay",
    desc: "Sign in with your OpenPay account",
    accent: OPENPAY_BRAND_BLUE,
    accentFg: "#ffffff",
  },
  {
    id: "solana",
    label: "Solana",
    desc: "Sign In With Solana (SIWS)",
    accent: SOLANA_BRAND_PURPLE,
    accentFg: "#ffffff",
  },
  {
    id: "pi",
    label: "Pi Network",
    desc: "Continue with Pi Browser or OAuth",
    accent: "#6F3CC3",
    accentFg: "#ffffff",
  },
  {
    id: "phantom",
    label: "Phantom",
    desc: "Extension, Google, or Apple",
    accent: "#AB9FF2",
    accentFg: "#1a1330",
  },
];

function SolanaMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4.8 17.5a.7.7 0 0 1 .5-.2h14.2a.35.35 0 0 1 .25.6l-1.7 1.7a.7.7 0 0 1-.5.2H3.35a.35.35 0 0 1-.25-.6l1.7-1.7Zm0-6.5a.7.7 0 0 1 .5-.2h14.2a.35.35 0 0 1 .25.6l-1.7 1.7a.7.7 0 0 1-.5.2H3.35a.35.35 0 0 1-.25-.6l1.7-1.7Zm15.65-4.9a.35.35 0 0 0-.25-.6H6.05a.7.7 0 0 0-.5.2L3.85 7.4a.35.35 0 0 0 .25.6h14.2a.7.7 0 0 0 .5-.2l1.65-1.7Z"
      />
    </svg>
  );
}

function AuthOptionIcon({ id }: { id: AuthMethod }) {
  if (id === "openpay") {
    return <img src={OPENPAY_LOGO_WHITE} width={22} height={22} alt="" />;
  }
  if (id === "solana") {
    return <SolanaMark className="h-5 w-5 text-white" />;
  }
  if (id === "pi") {
    return (
      <img src={PI_NETWORK_LOGO_URL} width={22} height={22} alt="" className="rounded-full" />
    );
  }
  return <img src={PHANTOM_APP_ICON} width={22} height={22} alt="" className="rounded-full" />;
}

function phantomErrorMessage(err: unknown): string {
  const message = (err as Error)?.message || String(err || "Phantom connect failed");
  if (/failed to fetch|networkerror|load failed|cors/i.test(message)) {
    const origin = typeof window !== "undefined" ? window.location.origin : "this site";
    return `Phantom blocked this origin. In Phantom Portal → Set Up, add Allowed Origin "${origin}" and Redirect URL "${getPhantomRedirectUrl()}".`;
  }
  return message;
}

function AuthPiPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<AuthMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [pulseId, setPulseId] = useState<AuthMethod | null>(null);

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

  function pick(id: AuthMethod) {
    setSelected(id);
    setPulseId(id);
    window.setTimeout(() => setPulseId((cur) => (cur === id ? null : cur)), 450);
  }

  async function continueWith(method: AuthMethod) {
    if (busy) return;
    setBusy(true);
    try {
      if (method === "openpay") {
        await startOpenPaySignIn({ redirectTo: "/dashboard" });
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
    } catch (err) {
      const message = (err as Error).message || "Sign-in failed";
      if (!/reject|cancel|denied/i.test(message)) toast.error(message);
      setBusy(false);
    }
  }

  const selectedOpt = AUTH_OPTIONS.find((o) => o.id === selected) ?? null;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 -z-10 opacity-40" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-primary blur-3xl opacity-20" />
        <div className="absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-primary-glow blur-3xl opacity-15" />
      </div>

      <div className="auth-select-enter w-full max-w-md">
        <div className="rounded-3xl bg-card p-7 shadow-card">
          <div className="mb-7 text-center">
            <div className="mb-3 inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              Premium Web3 wallet
            </div>
            <h1 className="text-2xl font-semibold">Welcome to OpenPay Pro</h1>
            <p className="mt-1 text-sm text-muted-foreground">Select your sign-in method</p>
          </div>

          <div
            className="grid grid-cols-2 gap-3"
            role="listbox"
            aria-label="Sign-in methods"
            aria-activedescendant={selected ? `auth-opt-${selected}` : undefined}
          >
            {AUTH_OPTIONS.map((opt, i) => {
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
                      animationDelay: `${80 + i * 70}ms`,
                    } as CSSProperties
                  }
                  className={cn(
                    "auth-option relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border p-3.5 text-left press",
                    "auth-option-enter disabled:opacity-60",
                    isOn
                      ? "auth-option-selected border-transparent"
                      : "border-border/70 bg-muted/30 hover:bg-muted/50",
                    pulseId === opt.id && "auth-option-pulse",
                  )}
                >
                  {isOn ? (
                    <span
                      className="pointer-events-none absolute inset-0 -z-10 rounded-2xl transition-colors"
                      style={{ backgroundColor: opt.accent }}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={cn(
                      "grid h-11 w-11 place-items-center rounded-xl transition-transform duration-300",
                      isOn ? "scale-105 bg-white/20" : "scale-100",
                    )}
                    style={isOn ? undefined : { backgroundColor: opt.accent }}
                  >
                    <AuthOptionIcon id={opt.id} />
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn("block text-sm font-semibold", !isOn && "text-foreground")}
                      style={isOn ? { color: opt.accentFg } : undefined}
                    >
                      {opt.label}
                    </span>
                    <span
                      className={cn("mt-0.5 block text-[11px] leading-snug", !isOn && "text-muted-foreground")}
                      style={isOn ? { color: `${opt.accentFg}cc` } : undefined}
                    >
                      {opt.desc}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full transition-all duration-300",
                      isOn ? "scale-100 opacity-100" : "scale-50 opacity-0",
                    )}
                    style={{ backgroundColor: isOn ? "rgba(255,255,255,0.25)" : undefined }}
                  >
                    <Check className="h-3 w-3" style={{ color: opt.accentFg }} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-2">
            {selected === "phantom" ? (
              <PhantomContinueButton
                busy={busy}
                setBusy={setBusy}
                accent={selectedOpt?.accent ?? "#AB9FF2"}
                accentFg={selectedOpt?.accentFg ?? "#1a1330"}
              />
            ) : (
              <Button
                type="button"
                disabled={!selected || busy}
                onClick={() => selected && void continueWith(selected)}
                className="auth-continue h-12 w-full rounded-xl text-base font-semibold hover:opacity-95 disabled:opacity-50"
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

            {selected === "phantom" ? <PhantomGoogleAppleLink busy={busy} /> : null}
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            By continuing you agree to OpenPay&apos;s{" "}
            <Link to="/terms" className="font-medium text-foreground underline-offset-2 hover:underline">
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
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const isPiBrowser =
    /PiBrowser/i.test(ua) ||
    (typeof window !== "undefined" && Boolean((window as unknown as { Pi?: unknown }).Pi));

  if (!isPiBrowser) {
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

function PhantomContinueButton({
  busy,
  setBusy,
  accent,
  accentFg,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  accent: string;
  accentFg: string;
}) {
  const ready = usePhantomClientReady();
  if (!ready) {
    return (
      <Button type="button" disabled className="auth-continue h-12 w-full rounded-xl">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }
  return (
    <PhantomContinueButtonInner
      busy={busy}
      setBusy={setBusy}
      accent={accent}
      accentFg={accentFg}
    />
  );
}

function PhantomContinueButtonInner({
  busy,
  setBusy,
  accent,
  accentFg,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  accent: string;
  accentFg: string;
}) {
  const { open } = useModal();
  const { connect, isConnecting } = useConnect();
  const { isInstalled: extensionInstalled } = useIsExtensionInstalled();
  const { isConnected, isLoading: phantomLoading, addresses } = usePhantom();
  const accounts = useAccounts();
  const bridgingRef = useRef(false);
  const [bridging, setBridging] = useState(false);

  const walletAddresses = accounts?.length ? accounts : addresses;
  const solanaAddress = walletAddresses?.find(
    (a) => a.addressType === AddressType.solana || String(a.addressType) === "Solana",
  )?.address;

  useEffect(() => {
    if (!isConnected || !solanaAddress || bridgingRef.current || bridging) return;
    let cancelled = false;
    bridgingRef.current = true;
    setBridging(true);
    setBusy(true);
    (async () => {
      try {
        await startSolanaSignIn({ redirectTo: "/dashboard" });
      } catch (err) {
        if (cancelled) return;
        const message = (err as Error).message || "Phantom sign-in failed";
        if (!/reject|cancel|denied/i.test(message)) toast.error(message);
        bridgingRef.current = false;
        setBridging(false);
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, solanaAddress, bridging, setBusy]);

  const waiting = busy || isConnecting || bridging || (isConnected && phantomLoading);

  return (
    <Button
      type="button"
      disabled={waiting}
      onClick={async () => {
        setBusy(true);
        try {
          if (extensionInstalled) {
            await connect({ provider: "injected" });
            return;
          }
          open();
          setBusy(false);
        } catch (err) {
          toast.error(phantomErrorMessage(err));
          setBusy(false);
        }
      }}
      className="auth-continue h-12 w-full rounded-xl text-base font-semibold hover:opacity-95"
      style={{ backgroundColor: accent, color: accentFg }}
    >
      {waiting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <span className="inline-flex items-center gap-1.5">
          {extensionInstalled ? "Connect Phantom extension" : "Continue with Phantom"}
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </Button>
  );
}

function PhantomGoogleAppleLink({ busy }: { busy: boolean }) {
  const ready = usePhantomClientReady();
  if (!ready) return null;
  return <PhantomGoogleAppleLinkInner busy={busy} />;
}

function PhantomGoogleAppleLinkInner({ busy }: { busy: boolean }) {
  const { open } = useModal();
  const { isInstalled: extensionInstalled } = useIsExtensionInstalled();
  if (!extensionInstalled) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        try {
          open();
        } catch (err) {
          toast.error(phantomErrorMessage(err));
        }
      }}
      className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-60"
    >
      Or continue with Google / Apple
    </button>
  );
}
