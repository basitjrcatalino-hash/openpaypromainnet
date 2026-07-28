import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AddressType, useAccounts, useModal, usePhantom } from "@phantom/react-sdk";
import {
  OPENPAY_BRAND_BLUE,
  OPENPAY_LOGO_WHITE,
  startOpenPaySignIn,
} from "@/lib/openpay-auth";
import { startSolanaSignIn } from "@/lib/solana-auth";
import { PHANTOM_APP_ICON } from "@/lib/phantom";
import { usePhantomClientReady } from "@/components/phantom-provider";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/authpi")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — OpenPay Pro Wallet" }] }),
  component: AuthPiPage,
});

function AuthPiPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const phantomReady = usePhantomClientReady();

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
  if (!phantomReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <AuthPiContent />;
}

function AuthPiContent() {
  const { open } = useModal();
  const { isConnected, isLoading: phantomLoading, addresses } = usePhantom();
  const accounts = useAccounts();
  const [openPayBusy, setOpenPayBusy] = useState(false);
  const [phantomBusy, setPhantomBusy] = useState(false);
  const bridgingRef = useRef(false);

  const walletAddresses = accounts?.length ? accounts : addresses;
  const solanaAddress = walletAddresses?.find(
    (a) => a.addressType === AddressType.solana || String(a.addressType) === "Solana",
  )?.address;

  // After Phantom Connect, bridge into OpenPay Supabase session via SIWS
  useEffect(() => {
    if (!isConnected || !solanaAddress || bridgingRef.current || phantomBusy) return;

    let cancelled = false;
    bridgingRef.current = true;
    setPhantomBusy(true);

    (async () => {
      try {
        await startSolanaSignIn({ redirectTo: "/dashboard" });
      } catch (err) {
        if (cancelled) return;
        const message = (err as Error).message || "Phantom sign-in failed";
        if (!/reject|cancel|denied/i.test(message)) {
          toast.error(message);
        }
        bridgingRef.current = false;
        setPhantomBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isConnected, solanaAddress, phantomBusy]);

  const busy = openPayBusy || phantomBusy || phantomLoading;

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
              Sign in with OpenPay or connect Phantom to access OUSD, tokens & NFTs
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
              disabled={busy}
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
              onClick={() => {
                try {
                  open();
                } catch (err) {
                  toast.error((err as Error).message || "Could not open Phantom Connect");
                }
              }}
              disabled={busy}
              className="h-12 w-full rounded-xl bg-[#AB9FF2] text-base font-semibold text-[#1a1330] hover:opacity-95"
            >
              {phantomBusy || (isConnected && phantomLoading) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="inline-flex items-center gap-2.5">
                  <img
                    src={PHANTOM_APP_ICON}
                    width={20}
                    height={20}
                    alt=""
                    className="rounded-full"
                  />
                  Connect Phantom
                </span>
              )}
            </Button>

            {isConnected && solanaAddress && phantomBusy ? (
              <p className="text-center text-xs text-muted-foreground">
                Phantom connected · finishing sign-in…
              </p>
            ) : null}
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
