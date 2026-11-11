import { ClientOnly, createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShieldCheck, Mail, Wallet, Send, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { PI_NETWORK_AUTH_LOGO, ensureTopLevelAuthWindow } from "@/lib/phantom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { signInWithPi } from "@/lib/pi-network";
import { isPiBrowser } from "@/lib/piSdk";
import { useQuery } from "@tanstack/react-query";
import { AUTH_METHOD_CATALOG, fetchAuthMethodFlags, isAuthMethodKey, type AuthMethodKey } from "@/lib/auth-methods";
import { EmailAuthPanel } from "@/components/email-auth-panel";
import { ArcConnectDialog } from "@/components/arc-connect-dialog";
import type { EIP1193Provider } from "viem";
import openpayIcon from "@/assets/openpay-pro-icon.png.asset.json";

const AuthProviderPanel = lazy(() => import("@/components/auth-provider-panels").then(module => ({ default: module.AuthProviderPanel })));

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

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    s: Record<string, unknown>,
  ): { method?: string; mode?: "signin" | "signup"; next?: string } => {
    const method = typeof s.method === "string" ? s.method.toLowerCase() : undefined;
    const mode = typeof s.mode === "string" ? s.mode.toLowerCase() : undefined;
    const next = typeof s.next === "string" ? s.next : undefined;
    return {
      method: method && isAuthMethodKey(method) ? method : undefined,
      mode: mode === "signin" || mode === "signup" ? mode : undefined,
      next: next && next.startsWith("/") && !next.startsWith("//") ? next : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Sign-in options — OpenPay Pro Wallet" },
      {
        name: "description",
        content:
          "Sign in to OpenPay Pro with your linked Arc wallet or existing account.",
      },
      { property: "og:title", content: "Sign-in options — OpenPay Pro Wallet" },
      {
        property: "og:description",
        content: "Choose an available OpenPay Pro sign-in method.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://openpaypro.online/auth" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.online/auth" }],
  }),
  component: AuthLayout,
});

function AuthLayout() {
  const children = useChildMatches();
  return children.length ? <Outlet /> : <AuthPage />;
}

function AuthPage() {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [createWalletAccount, setCreateWalletAccount] = useState(false);
  const autoRan = useRef(false);
  const search = Route.useSearch();
  const [selected, setSelected] = useState<AuthMethodKey | null>(null);
  const flags = useQuery({ queryKey: ["auth-methods"], queryFn: () => fetchAuthMethodFlags(supabase), refetchInterval: 15_000, refetchOnWindowFocus: true });
  const enabled = (method: AuthMethodKey) => flags.data?.[method]?.enabled === true;

  useEffect(() => {
    if (search.method && isAuthMethodKey(search.method)) setSelected(search.method);
  }, [search.method]);

  useEffect(() => {
    captureNextParam();
    ensureTopLevelAuthWindow();
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (data.user) {
        goPostAuth();
        return;
      }
      // Auto-trigger Pi authentication on load inside the Pi Browser.
      if (autoRan.current || !isPiBrowser() || !enabled("pi")) return;
      autoRan.current = true;
      setBusy(true);
      try {
        await handlePiSignIn();
      } catch (err) {
        if (cancelled) return;
        const message = (err as Error).message || "Sign-in failed";
        if (!/reject|cancel|denied/i.test(message)) toast.error(message);
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flags.data]);

  const { theme, toggle } = useTheme();
  if (!mounted) return null;

  async function onContinue() {
    if (busy || !enabled("pi")) return;
    setBusy(true);
    try {
      await handlePiSignIn();
    } catch (err) {
      const message = (err as Error).message || "Sign-in failed";
      if (!/reject|cancel|denied/i.test(message)) toast.error(message);
      setBusy(false);
    }
  }

  async function continueWith(method: AuthMethodKey) {
    const current = await flags.refetch();
    if (current.error || !current.data?.[method]?.enabled) {
      toast.error(current.data?.[method]?.message || "This sign-in method is unavailable.");
      return;
    }
    if (method === "email" || method === "phantom" || method === "metamask" || method === "privy") {
      setSelected(method);
      return;
    }
    if (method === "pi") { await onContinue(); return; }
    if (method === "arc") {
      setCreateWalletAccount(search.mode === "signup");
      setConnectOpen(true);
      return;
    }
    setBusy(true);
    try {
      const redirectTo = postAuthTarget();
      if (method === "openpay") await (await import("@/lib/openpay-auth")).startOpenPaySignIn({ redirectTo });
      if (method === "solana") await (await import("@/lib/solana-auth")).startSolanaSignIn({ redirectTo });
      if (method === "walletconnect") await (await import("@/lib/walletconnect-auth")).startWalletConnectSignIn({ redirectTo });
      if (method === "telegram") await (await import("@/lib/telegram-auth")).startTelegramSignIn({ redirectTo });
    } catch (error) { toast.error((error as Error).message || "Sign-in failed"); }
    finally { setBusy(false); }
  }

  async function handleWalletSelect(provider: EIP1193Provider) {
    setConnectOpen(false);
    setBusy(true);
    try {
      const current = await flags.refetch();
      if (current.error || !current.data?.arc.enabled) throw new Error("Arc wallet access is unavailable.");
      await (await import("@/lib/arc-wallet")).verifyArcWallet("login", provider, createWalletAccount);
      goPostAuth();
    } catch (error) {
      toast.error((error as Error).message || "Wallet sign-in failed.");
    } finally { setBusy(false); }
  }

  const methods = AUTH_METHOD_CATALOG.filter(m => enabled(m.method_key)).sort((a, b) => Number(b.method_key === "arc") - Number(a.method_key === "arc"));
  const active = selected && enabled(selected) ? selected : null;
  const logos: Partial<Record<AuthMethodKey, string>> = { phantom: "/auth-phantom.png", solana: "/auth-solana.png", metamask: "/auth-metamask.png", pi: PI_NETWORK_AUTH_LOGO, telegram: "/auth-telegram.svg" };
  const isSignup = search.mode === "signup";
  const methodIcon = (key: AuthMethodKey, cls: string) => logos[key] ? <img src={logos[key]} alt="" className={`${cls} rounded-full object-contain`} /> : key === "email" ? <Mail className={cls} /> : key === "telegram" ? <Send className={cls} /> : <Wallet className={cls} />;
  const continueLabel = (key: AuthMethodKey, label: string) => key === "arc" ? (isSignup ? "Create account with wallet" : "Connect wallet") : key === "pi" ? "Continue with Pi" : `Continue with ${label}`;

  return (
    <div className="auth-gradient relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-12 text-auth-foreground">
      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-auth-border bg-auth-surface text-auth-foreground backdrop-blur transition-colors hover:bg-auth-surface-hover"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <ArcConnectDialog open={connectOpen} onOpenChange={setConnectOpen} onSelect={provider => void handleWalletSelect(provider)} />
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-500">
        <header className="mb-8 text-center">
          <img src={openpayIcon.url} alt="OpenPay Pro" className="mx-auto h-14 w-14 rounded-2xl object-cover shadow-lg" />
          <h1 className="mt-6 text-5xl font-extrabold tracking-tight sm:text-6xl">OpenPay Pro</h1>
          <p className="mt-3 text-lg font-medium text-auth-muted">{isSignup ? "Create your account" : "Sign in to your account"}</p>
          <div className="mx-auto mt-6 inline-flex rounded-full border border-auth-border bg-auth-surface p-1 backdrop-blur" role="group" aria-label="Account access">
            <Link to="/auth" search={{ ...search, mode: "signin" }} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${!isSignup ? "bg-auth-button text-auth-button-foreground" : "text-auth-muted hover:text-auth-foreground"}`}>Sign in</Link>
            <Link to="/auth" search={{ ...search, mode: "signup" }} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${isSignup ? "bg-auth-button text-auth-button-foreground" : "text-auth-muted hover:text-auth-foreground"}`}>Create account</Link>
          </div>
          {isSignup && <p className="mt-4 text-xs leading-relaxed text-auth-muted">Already have an account? Sign in first to link your wallet and keep your balances. Wallet-only accounts use wallet recovery, not email.</p>}
        </header>
        {flags.isPending ? <div className="grid h-32 place-items-center"><Loader2 aria-label="Loading sign-in methods" className="h-6 w-6 animate-spin" /></div> : flags.isError ? <div className="space-y-4 text-center"><p className="text-sm font-medium">Sign-in options could not be loaded.</p><button type="button" onClick={() => void flags.refetch()} className="h-12 rounded-xl border border-auth-border bg-auth-surface px-6 text-sm font-semibold hover:bg-auth-surface-hover">Try again</button></div> : active ? <div className="space-y-5 rounded-2xl border border-auth-border bg-auth-surface p-5 backdrop-blur">
          <button type="button" disabled={busy} onClick={() => setSelected(null)} className="inline-flex items-center gap-2 text-sm font-medium text-auth-muted hover:text-auth-foreground"><ArrowLeft className="h-4 w-4" /> All sign-in options</button>
          <h2 className="text-center text-lg font-semibold">{AUTH_METHOD_CATALOG.find(m => m.method_key === active)?.label}</h2>
          <div className="rounded-xl bg-card p-4 text-card-foreground">
            {active === "email" && <EmailAuthPanel busy={busy} setBusy={setBusy} initialMode={isSignup ? "signup" : "signin"} />}
            {(active === "phantom" || active === "metamask") && <ClientOnly><Suspense fallback={<Loader2 aria-label="Loading wallet sign-in" className="mx-auto h-5 w-5 animate-spin" />}><AuthProviderPanel method={active} busy={busy} setBusy={setBusy} /></Suspense></ClientOnly>}
            {active === "privy" && <p role="status" className="text-center text-sm text-muted-foreground">Privy sign-in is temporarily unavailable. Please choose another sign-in method.</p>}
            {active === "pi" && <Button className="h-12 w-full" disabled={busy} onClick={() => void continueWith("pi")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue with Pi Network"}</Button>}
            {(active === "arc" || active === "openpay" || active === "solana" || active === "walletconnect" || active === "telegram") && <Button className="h-12 w-full" disabled={busy} onClick={() => void continueWith(active)}>Continue</Button>}
          </div>
        </div> : <div className="space-y-3">
          {methods.map((method, i) => <button key={method.method_key} type="button" disabled={busy} onClick={() => void continueWith(method.method_key)} className={`flex h-14 w-full items-center justify-center gap-3 rounded-xl px-5 text-base font-semibold shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 ${i === 0 ? "bg-auth-button text-auth-button-foreground hover:opacity-95" : "border border-auth-border bg-auth-surface text-auth-foreground backdrop-blur hover:bg-auth-surface-hover"}`}>
            {busy && i === 0 ? <Loader2 className="h-5 w-5 animate-spin" /> : methodIcon(method.method_key, "h-5 w-5")}
            <span>{busy && i === 0 && method.method_key === "arc" ? "Awaiting wallet approval…" : continueLabel(method.method_key, method.label)}</span>
          </button>)}
          {!methods.length && <p role="status" className="py-6 text-center text-sm text-auth-muted">Sign-in is temporarily unavailable.</p>}
        </div>}
        <p className="mt-7 text-center text-xs leading-relaxed text-auth-muted">By continuing, you agree to our <Link to="/terms" className="font-semibold text-auth-foreground hover:underline">Terms</Link>, <Link to="/privacy" className="font-semibold text-auth-foreground hover:underline">Privacy Policy</Link>, <Link to="/regulatory" className="font-semibold text-auth-foreground hover:underline">Regulatory Status</Link> and <Link to="/legal" className="font-semibold text-auth-foreground hover:underline">Software License</Link>.</p>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-auth-muted"><ShieldCheck className="h-3.5 w-3.5" /> Secure wallet access</p>
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
