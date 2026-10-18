import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Gift, Link as LinkIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PiAuthProvider, usePiAuth } from "@/contexts/PiAuthContext";
import ClaimTestPiButton from "@/components/pi/ClaimTestPiButton";
import { fetchWalletProgress, type WalletProgress } from "@/lib/piApi";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/testnet-reward")({
  head: () => ({
    meta: [
      { title: "Claim Test Pi — OpenPay Pro" },
      {
        name: "description",
        content: "Claim a Pi Testnet reward to help OpenPay Pro qualify for Pi Mainnet listing.",
      },
      { property: "og:title", content: "Claim Test Pi — OpenPay Pro" },
      {
        property: "og:description",
        content: "Claim a Pi Testnet reward and help OpenPay Pro qualify for Mainnet.",
      },
      { property: "og:url", content: "https://openpaypro.space/testnet-reward" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/testnet-reward" }],
  }),
  component: () => (
    <PiAuthProvider>
      <TestnetRewardInner />
    </PiAuthProvider>
  ),
});

function TestnetRewardInner() {
  const { session, signIn, inPiBrowser, sdkReady, loading, authError } = usePiAuth();
  const [progress, setProgress] = useState<WalletProgress | null>(null);

  useEffect(() => { void fetchWalletProgress().then(setProgress).catch(() => null); }, []);

  return (
    <div className="min-h-screen bg-background bg-hero-glow px-4 py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="glass rounded-3xl p-8 text-center">
          <Gift className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">Claim Test Pi</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Help OpenPay Pro qualify for Pi Mainnet by claiming a small Testnet reward in Pi Browser.
          </p>

          {!inPiBrowser && (
            <div className="mt-6 flex items-start gap-2 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-left text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
              <span>Open this page inside <strong>Pi Browser</strong> to authenticate and receive Test Pi.</span>
            </div>
          )}

          {inPiBrowser && !session && (
            <Button
              onClick={() => void signIn()}
              disabled={loading || !sdkReady}
              className="mt-6 h-11 w-full rounded-2xl"
            >
              {loading ? "Loading…" : "Sign in with Pi"}
            </Button>
          )}

          {inPiBrowser && session && (
            <div className="mt-6 space-y-3">
              <p className="text-sm">Signed in as <strong>{session.username || session.uid}</strong></p>
              <ClaimTestPiButton />
            </div>
          )}

          {authError && <p className="mt-3 text-sm text-destructive">{authError}</p>}

          {progress && (
            <div className="mt-6 rounded-2xl border border-border bg-card/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Testnet progress</p>
              <p className="mt-1 text-lg font-semibold">{progress.progress_label}</p>
            </div>
          )}
        </div>

        <Link
          to="/admin/testnet-progress"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <LinkIcon className="h-3 w-3" /> View admin dashboard
        </Link>
      </div>
    </div>
  );
}