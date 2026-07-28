"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2 } from "lucide-react";
import {
  AddressType,
  useAccounts,
  useConnect,
  useIsExtensionInstalled,
  useModal,
  usePhantom,
} from "@phantom/react-sdk";
import { startSolanaSignIn } from "@/lib/solana-auth";
import { getPhantomRedirectUrl } from "@/lib/phantom";
import { Button } from "@/components/ui/button";

function phantomErrorMessage(err: unknown): string {
  const message = (err as Error)?.message || String(err || "Phantom connect failed");
  if (/failed to fetch|networkerror|load failed|cors/i.test(message)) {
    const origin = typeof window !== "undefined" ? window.location.origin : "this site";
    return `Phantom blocked this origin. In Phantom Portal → Set Up, add Allowed Origin "${origin}" and Redirect URL "${getPhantomRedirectUrl()}".`;
  }
  return message;
}

export function PhantomContinueButton({
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
      className="h-12 w-full rounded-xl text-base font-semibold transition-[background-color,color,opacity] duration-200 ease-out hover:opacity-95"
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

export function PhantomGoogleAppleLink({ busy }: { busy: boolean }) {
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
