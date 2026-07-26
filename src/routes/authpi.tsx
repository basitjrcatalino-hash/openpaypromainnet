import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { signInWithPi } from "@/lib/pi-network";
import {
  OPENPAY_BRAND_BLUE,
  OPENPAY_LOGO_WHITE,
  startOpenPaySignIn,
} from "@/lib/openpay-auth";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/authpi")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — OpenPay Pro Wallet" }] }),
  component: AuthPiPage,
});

function AuthPiPage() {
  const navigate = useNavigate();
  const [piBusy, setPiBusy] = useState(false);
  const [openPayBusy, setOpenPayBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  const handlePiSignIn = async () => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const isPiBrowser =
      /PiBrowser/i.test(ua) ||
      (typeof window !== "undefined" && Boolean((window as unknown as { Pi?: unknown }).Pi));

    if (!isPiBrowser) {
      try {
        startPiOAuthRedirect();
      } catch (err) {
        toast.error((err as Error).message || "Pi sign-in failed");
      }
      return;
    }

    setPiBusy(true);
    try {
      const { username } = await signInWithPi();
      toast.success(`Signed in as @${username} via Pi Network`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message || "Pi sign-in failed");
    } finally {
      setPiBusy(false);
    }
  };

  // Only redirect if already signed in — never auto-start Pi/OpenPay auth
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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background bg-hero-glow px-4 py-10">
      <div className="absolute inset-0 -z-10 opacity-50" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-primary blur-3xl opacity-20" />
        <div className="absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-primary-glow blur-3xl opacity-15" />
      </div>

      <div className="w-full max-w-md">
        <div className="glass rounded-3xl p-7">
          <div className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-3 py-1 text-xs font-medium text-accent-foreground">
              <Sparkles className="h-3 w-3" /> Premium Web3 wallet
            </div>
            <h1 className="text-2xl font-semibold">Welcome to OpenPay Pro</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with Pi Network or OpenPay to access OUSD, tokens & NFTs
            </p>
          </div>

          <Button
            type="button"
            onClick={() => handlePiSignIn()}
            disabled={piBusy || openPayBusy}
            className="h-12 w-full rounded-xl bg-gradient-primary text-base font-semibold text-white shadow-glow hover:opacity-95"
          >
            {piBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="inline-flex items-center gap-2.5">
                <img
                  src="https://images.seeklogo.com/logo-png/44/2/pi-network-lvquy-logo-png_seeklogo-440686.png"
                  width={22}
                  height={22}
                  alt=""
                  className="rounded-full"
                />
                Continue with Pi Network
              </span>
            )}
          </Button>

          <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            onClick={async () => {
              setOpenPayBusy(true);
              try {
                await startOpenPaySignIn({ redirectTo: "/dashboard" });
              } catch (err) {
                toast.error((err as Error).message || "OpenPay sign-in failed");
                setOpenPayBusy(false);
              }
            }}
            disabled={piBusy || openPayBusy}
            className="h-12 w-full rounded-xl text-base font-semibold text-white hover:opacity-95"
            style={{ backgroundColor: OPENPAY_BRAND_BLUE }}
          >
            {openPayBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="inline-flex items-center gap-2.5">
                <img src={OPENPAY_LOGO_WHITE} width={20} height={20} alt="" />
                Sign in with OpenPay
              </span>
            )}
          </Button>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            By continuing you agree to OpenPay's Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
