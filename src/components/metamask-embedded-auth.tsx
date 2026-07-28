import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthTokenInfo, useWeb3AuthConnect } from "@web3auth/modal/react";
import { AUTH_CONNECTION, WALLET_CONNECTORS } from "@web3auth/modal";

import { Button } from "@/components/ui/button";
import { completeWeb3AuthSupabaseSession } from "@/lib/web3auth-auth";
import { METAMASK_EMBEDDED_BRAND, WEB3AUTH_CLIENT_ID } from "@/lib/web3auth-config";
import { cn } from "@/lib/utils";

type SocialKey =
  | "google"
  | "twitter"
  | "apple"
  | "github"
  | "reddit"
  | "discord"
  | "facebook";

const SOCIALS: { id: SocialKey; label: string; connection: (typeof AUTH_CONNECTION)[keyof typeof AUTH_CONNECTION] }[] =
  [
    { id: "google", label: "Google", connection: AUTH_CONNECTION.GOOGLE },
    { id: "twitter", label: "X", connection: AUTH_CONNECTION.TWITTER },
    { id: "apple", label: "Apple", connection: AUTH_CONNECTION.APPLE },
    { id: "github", label: "GitHub", connection: AUTH_CONNECTION.GITHUB },
    { id: "discord", label: "Discord", connection: AUTH_CONNECTION.DISCORD },
    { id: "facebook", label: "Facebook", connection: AUTH_CONNECTION.FACEBOOK },
  ];

export function MetaMaskEmbeddedAuthPanel({
  busy,
  setBusy,
  accent = METAMASK_EMBEDDED_BRAND,
  accentFg = "#ffffff",
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  accent?: string;
  accentFg?: string;
}) {
  const { connect, connectTo, loading, isConnected, error } = useWeb3AuthConnect();
  const { getAuthTokenInfo } = useAuthTokenInfo();
  const [localBusy, setLocalBusy] = useState(false);
  const blocked = busy || localBusy || loading;

  async function finishSession() {
    const idToken = await getAuthTokenInfo();
    if (!idToken) {
      throw new Error("Could not read MetaMask Embedded identity token");
    }
    await completeWeb3AuthSupabaseSession(idToken, { redirectTo: "/dashboard" });
  }

  async function run(action: () => Promise<unknown>) {
    if (blocked) return;
    if (!WEB3AUTH_CLIENT_ID) {
      toast.error("MetaMask Embedded is not configured (missing client ID)");
      return;
    }
    setLocalBusy(true);
    setBusy(true);
    try {
      if (!isConnected) {
        await action();
      }
      await finishSession();
    } catch (err) {
      const message = (err as Error).message || "MetaMask Embedded sign-in failed";
      if (!/reject|cancel|denied/i.test(message)) {
        toast.error(message);
      }
      setBusy(false);
      setLocalBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={blocked}
        onClick={() => void run(() => connect())}
        className="h-12 w-full rounded-xl text-base font-semibold"
        style={{ backgroundColor: accent, color: accentFg }}
      >
        {blocked ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {isConnected ? "Continue to OpenPay Pro" : "Continue with MetaMask"}
      </Button>

      <div className="grid grid-cols-3 gap-1.5">
        {SOCIALS.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={blocked}
            onClick={() =>
              void run(() =>
                connectTo(WALLET_CONNECTORS.AUTH, {
                  authConnection: s.connection,
                }),
              )
            }
            className={cn(
              "rounded-xl border border-border/70 bg-muted/30 px-2 py-2 text-[11px] font-semibold text-foreground press",
              "hover:bg-muted/50 disabled:opacity-50",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {(error || !WEB3AUTH_CLIENT_ID) && (
        <p className="text-center text-[11px] text-destructive">
          {!WEB3AUTH_CLIENT_ID
            ? "Missing VITE_WEB3AUTH_CLIENT_ID"
            : error?.message || "Connection error"}
        </p>
      )}
      <p className="text-center text-[10px] text-muted-foreground">
        Social logins via MetaMask Embedded Wallets. Enable providers in the{" "}
        <a
          href="https://developer.metamask.io"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          dashboard
        </a>
        .
      </p>
    </div>
  );
}
