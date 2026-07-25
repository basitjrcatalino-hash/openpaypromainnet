import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { signInWithPi } from "@/lib/pi-network";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — OpenPay Pro Wallet" }] }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
  displayName: z.string().trim().min(1).max(60).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const [piBusy, setPiBusy] = useState(false);

  const PI_CLIENT_ID = import.meta.env.VITE_PI_CLIENT_ID as string | undefined;

  function startPiOAuthRedirect() {
    if (!PI_CLIENT_ID) {
      toast.error("Pi sign-in is not configured (missing client ID).");
      return;
    }
    const state = (crypto as Crypto & { randomUUID?: () => string }).randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("pi_oauth_state", state);
    sessionStorage.setItem("pi_oauth_redirect", "/dashboard");
    const redirectUri = `${window.location.origin}/auth/pi/callback`;
    const url =
      `https://accounts.pinet.com/oauth/authorize` +
      `?response_type=token` +
      `&client_id=${encodeURIComponent(PI_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent("username wallet_address")}` +
      `&state=${encodeURIComponent(state)}`;
    window.location.href = url;
  }

  const handlePiSignIn = async (silent = false) => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const isPiBrowser = /PiBrowser/i.test(ua) || (typeof window !== "undefined" && Boolean((window as unknown as { Pi?: unknown }).Pi));

    // Outside Pi Browser, use the standard Pi Sign-In OAuth implicit flow.
    if (!isPiBrowser) {
      try { startPiOAuthRedirect(); }
      catch (err) { if (!silent) toast.error((err as Error).message || "Pi sign-in failed"); }
      return;
    }

    setPiBusy(true);
    try {
      const { username } = await signInWithPi();
      toast.success(`Signed in as @${username} via Pi Network`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      if (!silent) toast.error((err as Error).message || "Pi sign-in failed");
      else console.warn("[Pi] auto sign-in skipped:", (err as Error).message);
    } finally {
      setPiBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        navigate({ to: "/dashboard" });
        return;
      }
      // Auto-trigger Pi authentication ONLY inside the Pi Browser.
      // Regular browsers don't have the Pi SDK and would surface noisy errors.
      const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
      const isPiBrowser = /PiBrowser/i.test(ua);
      if (isPiBrowser) {
        handlePiSignIn(true).catch((err) => console.warn("[Pi] auto sign-in skipped:", err));
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      email,
      password,
      displayName: mode === "signup" ? displayName : undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: parsed.data.displayName },
          },
        });
        if (error) throw error;
        toast.success("Welcome to OpenPay Pro Wallet!");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error((err as Error).message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (

    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background bg-hero-glow px-4 py-10">

      <div className="absolute inset-0 -z-10 opacity-50" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-primary blur-3xl opacity-20" />
        <div className="absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-primary-glow blur-3xl opacity-15" />
      </div>

      <div className="w-full max-w-md">
        <div className="glass rounded-3xl p-7">
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-3 py-1 text-xs font-medium text-accent-foreground">
              <Sparkles className="h-3 w-3" /> Premium Web3 wallet
            </div>
            <h1 className="text-2xl font-semibold">Welcome to OpenPay Pro</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your gateway to OUSD, tokens & NFTs</p>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <TabsContent value="signup" className="mt-0 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Display name</Label>
                  <Input id="name" placeholder="Satoshi" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
                </div>
              </TabsContent>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={72} />
              </div>

              <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl bg-gradient-primary text-base font-semibold text-primary-foreground shadow-glow hover:opacity-95">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signup" ? "Create wallet account" : "Open my wallet"}
              </Button>
            </form>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => handlePiSignIn(false)}
            disabled={piBusy}
            className="h-11 w-full rounded-xl border-2 border-primary bg-primary/10 text-base font-semibold text-primary hover:bg-primary/20"
          >
            {piBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>π&nbsp;&nbsp;Continue with Pi Network</>}
          </Button>


          <p className="mt-5 text-center text-xs text-muted-foreground">
            By continuing you agree to OpenPay's Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
