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
  useSolana,
} from "@phantom/react-sdk";
import { startPhantomConnectSignIn, startSolanaSignIn, hasSolanaWallet } from "@/lib/solana-auth";
import { getPhantomRedirectUrl, markPhantomOAuthPending, ensureTopLevelAuthWindow } from "@/lib/phantom";
import { Button } from "@/components/ui/button";

function phantomErrorMessage(err: unknown): string {
  const message = (err as Error)?.message || String(err || "Phantom connect failed");
  if (/failed to fetch|networkerror|load failed|cors/i.test(message)) {
    const origin = typeof window !== "undefined" ? window.location.origin : "this site";
    return `Phantom blocked this origin. In Phantom Portal → Set Up, add Allowed Origin "${origin}" and Redirect URL "${getPhantomRedirectUrl()}".`;
  }
  return message;
}

async function bridgePhantomSession(opts: {
  address: string;
  solana: {
    signMessage: (message: string | Uint8Array) => Promise<{
      signature: Uint8Array;
      publicKey?: string;
    }>;
    publicKey?: string | null;
  };
}): Promise<void> {
  // Prefer extension SIWS when available; otherwise sign via Phantom Connect SDK.
  // Docs: https://docs.phantom.com/sdks/react-sdk/sign-messages
  if (hasSolanaWallet()) {
    try {
      await startSolanaSignIn({ redirectTo: "/dashboard" });
      return;
    } catch (err) {
      // Fall through to Connect signMessage (embedded Google/Apple wallets).
      if (/reject|cancel|denied/i.test((err as Error)?.message || "")) throw err;
    }
  }

  await startPhantomConnectSignIn({
    address: opts.address,
    redirectTo: "/dashboard",
    signMessage: async (message) => {
      const result = await opts.solana.signMessage(message);
      return result.signature instanceof Uint8Array
        ? result.signature
        : new Uint8Array(result.signature as ArrayLike<number>);
    },
  });
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
  const { solana } = useSolana();
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

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      toast.error("Phantom sign-in timed out. Try again or use Solana.");
      bridgingRef.current = false;
      setBridging(false);
      setBusy(false);
    }, 45_000);

    (async () => {
      try {
        await bridgePhantomSession({ address: solanaAddress, solana });
      } catch (err) {
        if (cancelled) return;
        const message = (err as Error).message || "Phantom sign-in failed";
        if (!/reject|cancel|denied/i.test(message)) toast.error(phantomErrorMessage(err));
        bridgingRef.current = false;
        setBridging(false);
        setBusy(false);
      } finally {
        window.clearTimeout(timeout);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [isConnected, solanaAddress, bridging, setBusy, solana]);

  // Connected but no Solana address yet — don't spin forever.
  useEffect(() => {
    if (!busy || !isConnected || solanaAddress || bridging || isConnecting) return;
    const t = window.setTimeout(() => {
      toast.error("Phantom connected but no Solana address was returned. Try again.");
      setBusy(false);
    }, 8_000);
    return () => window.clearTimeout(t);
  }, [busy, isConnected, solanaAddress, bridging, isConnecting, setBusy]);

  const waiting = busy || isConnecting || bridging || (isConnected && phantomLoading && !solanaAddress);

  return (
    <Button
      type="button"
      disabled={waiting}
      onClick={async () => {
        if (!ensureTopLevelAuthWindow()) return;
        setBusy(true);
        try {
          // https://docs.phantom.com/sdks/react-sdk/connect
          if (extensionInstalled) {
            await connect({ provider: "injected" });
            return;
          }
          markPhantomOAuthPending();
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
        if (!ensureTopLevelAuthWindow()) return;
        try {
          markPhantomOAuthPending();
          open();
        } catch (err) {
          toast.error(phantomErrorMessage(err));
        }
      }}
      className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
    >
      Or continue with Google / Apple
    </button>
  );
}
