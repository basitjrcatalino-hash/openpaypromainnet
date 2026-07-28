"use client";

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  AddressType,
  ConnectBox,
  useAccounts,
  usePhantom,
} from "@phantom/react-sdk";
import {
  clearPhantomOAuthPending,
  getPhantomRedirectUrl,
} from "@/lib/phantom";
import { startSolanaSignIn } from "@/lib/solana-auth";
import { Button } from "@/components/ui/button";

function PhantomCallbackBridge() {
  const { isConnected, isLoading, addresses } = usePhantom();
  const accounts = useAccounts();
  const bridging = useRef(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  const walletAddresses = accounts?.length ? accounts : addresses;
  const solanaAddress = walletAddresses?.find(
    (a) => a.addressType === AddressType.solana || String(a.addressType) === "Solana",
  )?.address;

  useEffect(() => {
    if (!isConnected || !solanaAddress || bridging.current) return;
    bridging.current = true;
    setBridgeError(null);

    void (async () => {
      try {
        await startSolanaSignIn({ redirectTo: "/dashboard" });
        clearPhantomOAuthPending();
      } catch (err) {
        bridging.current = false;
        const message = (err as Error)?.message || "Could not finish Phantom sign-in";
        setBridgeError(message);
        if (!/reject|cancel|denied/i.test(message)) toast.error(message);
      }
    })();
  }, [isConnected, solanaAddress]);

  if (bridgeError) {
    return (
      <div className="mt-4 max-w-sm space-y-3 text-center">
        <p className="text-sm text-destructive">{bridgeError}</p>
        <Button type="button" variant="outline" asChild>
          <Link to="/authpi">Back to sign-in</Link>
        </Button>
      </div>
    );
  }

  if (isConnected || isLoading) {
    return (
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {isLoading ? "Finishing Phantom connection…" : "Creating your OpenPay session…"}
      </p>
    );
  }

  return null;
}

export function PhantomAuthCallbackInner({
  mode,
  searchError,
  searchErrorDescription,
}: {
  mode: "connect" | "recover";
  searchError?: string;
  searchErrorDescription?: string;
}) {
  const navigate = useNavigate();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirect = getPhantomRedirectUrl();

  if (mode === "recover") {
    return (
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Unable to complete login</h1>
        <p className="text-sm text-muted-foreground">
          {searchErrorDescription ||
            searchError ||
            "Missing expected OAuth state for callback validation. Start Phantom again from this same site in a normal browser tab (not an embedded preview), and allowlist this origin in Phantom Portal."}
        </p>
        <p className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-left text-[11px] text-muted-foreground">
          Allowed Origin: <span className="font-mono text-foreground">{origin}</span>
          <br />
          Redirect URL: <span className="font-mono text-foreground">{redirect}</span>
        </p>
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={() => navigate({ to: "/authpi" })}>
            Back to sign-in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <ConnectBox maxWidth={380} />
      <PhantomCallbackBridge />
      <button
        type="button"
        className="mt-6 text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => {
          clearPhantomOAuthPending();
          navigate({ to: "/authpi" });
        }}
      >
        Cancel and go back
      </button>
    </div>
  );
}
