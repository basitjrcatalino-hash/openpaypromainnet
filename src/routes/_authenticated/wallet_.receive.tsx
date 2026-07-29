/**
 * Receive crypto — Phantom-style QR + address for Circle wallet.
 * Route: /wallet/receive
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Copy, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { shortAddress } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/wallet_/receive")({
  head: () => ({ meta: [{ title: "Receive — OpenPay Pro" }] }),
  component: WalletReceivePage,
});

function WalletReceivePage() {
  const { wallet, loading, error, refreshWallet } = useWallet();

  async function copyAddress() {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      toast.success("Address copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="ot-phantom mx-auto w-full max-w-lg animate-page-in pb-10">
      <header className="mb-6 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link to="/wallet">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Receive</h1>
          <p className="ph-caption">
            {wallet?.blockchain ?? "Network"}
          </p>
        </div>
      </header>

      {loading && !wallet ? (
        <div className="grid place-items-center py-24 text-sm text-muted-foreground">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
          Loading wallet…
        </div>
      ) : error && !wallet ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button className="mt-4 rounded-full" onClick={() => void refreshWallet()}>
            Retry
          </Button>
        </div>
      ) : wallet ? (
        <div className="space-y-5">
          <div className="rounded-3xl border border-border bg-card p-6 text-center">
            <p className="ph-label">Current network</p>
            <p className="mt-1 text-lg font-extrabold tracking-tight">{wallet.blockchain}</p>

            <div className="mx-auto mt-5 grid h-52 w-52 place-items-center rounded-2xl border border-border bg-white p-3">
              {wallet.address ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(wallet.address)}`}
                  alt="Receive QR"
                  className="h-full w-full"
                />
              ) : (
                <QrCode className="h-16 w-16 text-muted-foreground" />
              )}
            </div>

            <p className="mt-5 break-all font-mono text-sm font-semibold tracking-tight text-foreground">{wallet.address}</p>
            <p className="ph-caption mt-1">
              ({shortAddress(wallet.address, 8, 8)})
            </p>

            <Button
              type="button"
              className="mt-4 w-full rounded-full"
              onClick={() => void copyAddress()}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy address
            </Button>
          </div>

          <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground">
            Only send assets on <strong className="text-foreground">{wallet.blockchain}</strong> to
            this address. Sending from the wrong network may result in permanent loss.
          </p>
        </div>
      ) : null}
    </div>
  );
}
