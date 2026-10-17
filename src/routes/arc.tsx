import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

const ArcWalletPanel = lazy(() => import("@/components/arc-wallet-panel"));
export const Route = createFileRoute("/arc")({
  head: () => ({ meta: [
    { title: "Arc Wallet — OpenPay Pro" },
    { name: "description", content: "Connect your Arc wallet, read OpenPay Arc USDC and savings balances, and approve transfers or bridge with Circle App Kit." },
    { property: "og:title", content: "Arc Wallet — OpenPay Pro" },
    { property: "og:description", content: "OpenPay Arc balances and wallet-approved USDC transfers on Arc Mainnet." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ArcPage,
});
function ArcPage() {
  return <main className="mx-auto min-h-dvh max-w-2xl px-5 py-10 text-foreground sm:py-16">
    <Link to="/authpi" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />OpenPay Pro</Link>
    <header className="my-8"><p className="text-sm font-medium text-primary">Powered by Arc · OpenPay Arc · Circle App Kit</p><h1 className="mt-3 text-3xl font-semibold">Arc Wallet</h1></header>
    <ClientOnly fallback={<Loader2 className="h-6 w-6 animate-spin" />}><Suspense fallback={<Loader2 className="h-6 w-6 animate-spin" />}><ArcWalletPanel /></Suspense></ClientOnly>
  </main>;
}