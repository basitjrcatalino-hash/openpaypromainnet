import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Loader2, ShieldCheck, Mail, Wallet, Send } from "lucide-react";
import { PI_NETWORK_AUTH_LOGO, ensureTopLevelAuthWindow } from "@/lib/phantom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { signInWithPi } from "@/lib/pi-network";
import { isPiBrowser } from "@/lib/piSdk";
import { useQuery } from "@tanstack/react-query";
import { AUTH_METHOD_CATALOG, fetchAuthMethodFlags, isAuthMethodKey, type AuthMethodKey } from "@/lib/auth-methods";
import { EmailAuthPanel } from "@/components/email-auth-panel";
import { AuthProviderPanel } from "@/components/auth-provider-panels";
import { ArcConnectDialog } from "@/components/arc-connect-dialog";
import type { EIP1193Provider } from "viem";

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
      { property: "og:url", content: "https://openpaypro.space/auth" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/auth" }],
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

  const methods = AUTH_METHOD_CATALOG.filter(m => enabled(m.method_key));
  const active = selected && enabled(selected) ? selected : null;
  const logos: Partial<Record<AuthMethodKey, string>> = { phantom: "/auth-phantom.png", solana: "/auth-solana.png", metamask: "/auth-metamask.png", pi: PI_NETWORK_AUTH_LOGO, telegram: "/auth-telegram.svg" };

  return (
    <div className="dark flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <ArcConnectDialog open={connectOpen} onOpenChange={setConnectOpen} onSelect={provider => void handleWalletSelect(provider)} />
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Secure wallet access</span>
          <h1 className="mt-4 text-3xl font-semibold">OpenPay Pro</h1>
          <p className="mt-2 text-sm text-muted-foreground">{search.mode === "signup" ? "Create your account" : "Sign in to your account"}</p>
          <p className="mt-3 text-sm font-medium text-primary">Powered by OpenPay · OpenPay Arc</p>
          {enabled("arc") && !flags.isError && <Button variant="link" disabled={busy} onClick={() => void continueWith("arc")} className="mt-2"><Wallet className="h-4 w-4" />{busy ? "Awaiting wallet approval…" : "Connect wallet"}</Button>}
          <div className="mt-4 flex justify-center gap-2" role="group" aria-label="Account access">
            <Button variant={search.mode !== "signup" ? "secondary" : "ghost"} asChild><Link to="/auth" search={{ ...search, mode: "signin" }}>Sign in</Link></Button>
            <Button variant={search.mode === "signup" ? "secondary" : "ghost"} asChild><Link to="/auth" search={{ ...search, mode: "signup" }}>Create account</Link></Button>
          </div>
          {search.mode === "signup" && <p className="mt-4 text-xs text-muted-foreground">Already have an account? Sign in first to link your wallet and keep your balances. Wallet-only accounts use wallet recovery, not email.</p>}
        </header>
        {flags.isPending ? <div className="grid h-32 place-items-center"><Loader2 aria-label="Loading sign-in methods" className="h-6 w-6 animate-spin" /></div> : flags.isError ? <div className="space-y-4 text-center"><p className="text-sm text-destructive">Sign-in options could not be loaded.</p><Button variant="outline" onClick={() => void flags.refetch()}>Try again</Button></div> : active ? <div className="space-y-5">
          <Button variant="ghost" disabled={busy} onClick={() => setSelected(null)}><ArrowLeft className="h-4 w-4" /> All sign-in options</Button>
          <h2 className="text-center text-lg font-semibold">{AUTH_METHOD_CATALOG.find(m => m.method_key === active)?.label}</h2>
          {active === "email" && <EmailAuthPanel busy={busy} setBusy={setBusy} initialMode={search.mode === "signup" ? "signup" : "signin"} />}
          {(active === "phantom" || active === "metamask") && <AuthProviderPanel method={active} busy={busy} setBusy={setBusy} />}
          {active === "privy" && <p role="status" className="text-center text-sm text-muted-foreground">Privy sign-in is temporarily unavailable. Please choose another sign-in method.</p>}
          {active === "pi" && <Button className="h-12 w-full" disabled={busy} onClick={() => void continueWith("pi")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue with Pi Network"}</Button>}
          {(active === "arc" || active === "openpay" || active === "solana" || active === "walletconnect" || active === "telegram") && <Button className="h-12 w-full" disabled={busy} onClick={() => void continueWith(active)}>Continue</Button>}
        </div> : <div className="space-y-2">
          {methods.map(method => <Button key={method.method_key} variant="outline" disabled={busy} onClick={() => void continueWith(method.method_key)} className="h-auto min-h-16 w-full justify-start gap-4 rounded-lg border-border bg-card px-4 py-3 text-left hover:bg-muted">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">{logos[method.method_key] ? <img src={logos[method.method_key]} alt="" className="h-8 w-8 object-contain" /> : method.method_key === "email" ? <Mail className="h-5 w-5" /> : method.method_key === "telegram" ? <Send className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}</span>
            <span className="min-w-0 flex-1 whitespace-normal"><span className="block text-sm font-semibold">{method.label}</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">{method.description}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>)}
          {!methods.length && <p role="status" className="py-6 text-center text-sm text-muted-foreground">Sign-in is temporarily unavailable.</p>}
        </div>}
        <p className="mt-7 text-center text-xs leading-relaxed text-muted-foreground">By continuing you agree to OpenPay’s <Link to="/terms" className="text-foreground hover:underline">Terms</Link>, <Link to="/privacy" className="text-foreground hover:underline">Privacy Policy</Link>, <Link to="/regulatory" className="text-foreground hover:underline">Regulatory Status</Link>, and <Link to="/legal" className="text-foreground hover:underline">Software License</Link>.</p>
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
