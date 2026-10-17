import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AppPhantomProvider } from "@/components/phantom-provider";
import { PhantomContinueButton, PhantomGoogleAppleLink } from "@/components/phantom-auth-lazy";
import { AppWeb3AuthProvider } from "@/components/web3auth-provider";

const MetaMaskPanel = lazy(() => import("@/components/metamask-embedded-auth").then(m => ({ default: m.MetaMaskEmbeddedAuthPanel })));

export function AuthProviderPanel({ method, busy, setBusy }: { method: "phantom" | "metamask"; busy: boolean; setBusy: (value: boolean) => void }) {
  if (method === "phantom") return <AppPhantomProvider><PhantomContinueButton busy={busy} setBusy={setBusy} accent="var(--primary)" accentFg="var(--primary-foreground)" /><PhantomGoogleAppleLink busy={busy} /></AppPhantomProvider>;
  return <AppWeb3AuthProvider><Suspense fallback={<Loader2 className="mx-auto h-5 w-5 animate-spin" />}><MetaMaskPanel busy={busy} setBusy={setBusy} accent="var(--primary)" accentFg="var(--primary-foreground)" /></Suspense></AppWeb3AuthProvider>;
}