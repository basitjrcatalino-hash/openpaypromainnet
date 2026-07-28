import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  OPENPAY_BRAND_BLUE,
  OPENPAY_LOGO_WHITE,
  startOpenPaySignIn,
} from "@/lib/openpay-auth";
import { SOLANA_BRAND_PURPLE, startSolanaSignIn } from "@/lib/solana-auth";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/authpi")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — OpenPay Pro Wallet" }] }),
  component: AuthPiPage,
});

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

function AuthPiPage() {
  const navigate = useNavigate();
  const [openPayBusy, setOpenPayBusy] = useState(false);
  const [solanaBusy, setSolanaBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only redirect if already signed in — never auto-start OpenPay auth
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 -z-10 opacity-40" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-primary blur-3xl opacity-20" />
        <div className="absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-primary-glow blur-3xl opacity-15" />
      </div>

      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-card p-7 shadow-card">
          <div className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              Premium Web3 wallet
            </div>
            <h1 className="text-2xl font-semibold">Welcome to OpenPay Pro</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with OpenPay or Solana to access OUSD, tokens & NFTs
            </p>
          </div>

          <div className="space-y-3">
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
              disabled={openPayBusy || solanaBusy}
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

            <Button
              type="button"
              onClick={async () => {
                setSolanaBusy(true);
                try {
                  await startSolanaSignIn({ redirectTo: "/dashboard" });
                } catch (err) {
                  const message = (err as Error).message || "Solana sign-in failed";
                  if (!/reject|cancel|denied/i.test(message)) {
                    toast.error(message);
                  }
                  setSolanaBusy(false);
                }
              }}
              disabled={openPayBusy || solanaBusy}
              className="h-12 w-full rounded-xl text-base font-semibold text-white hover:opacity-95"
              style={{ backgroundColor: SOLANA_BRAND_PURPLE }}
            >
              {solanaBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="inline-flex items-center gap-2.5">
                  <SolanaMark className="h-5 w-5" />
                  Sign in with Solana
                </span>
              )}
            </Button>
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
