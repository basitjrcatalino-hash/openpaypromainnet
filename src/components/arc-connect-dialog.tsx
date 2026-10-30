// Arc "Connect Wallet" — the ConnectKit + wagmi v2 modal used by OpenPay Arc.
// The kit is lazy-loaded in the browser only so it never runs on the server.
import { lazy, Suspense, useEffect, useState } from "react";
import type { EIP1193Provider } from "viem";

const ArcConnectKit = lazy(() => import("@/components/arc-connectkit"));

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (provider: EIP1193Provider) => void;
  busy?: boolean;
};

function isMobileWithoutWallet() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const mobile = /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  return mobile && !(window as unknown as { ethereum?: unknown }).ethereum;
}

// Universal links that open this page inside the wallet's own browser, where the
// wallet is injected directly. Reliable on iOS Safari and native app webviews.
function walletLinks() {
  const url = window.location.href;
  const hostPath = url.replace(/^https?:\/\//, "");
  return [
    { name: "MetaMask", href: `https://metamask.app.link/dapp/${hostPath}` },
    { name: "Trust", href: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(url)}` },
    { name: "Coinbase", href: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}` },
    { name: "OKX", href: `https://www.okx.com/download?deeplink=${encodeURIComponent(`okx://wallet/dapp/url?dappUrl=${encodeURIComponent(url)}`)}` },
  ];
}

export function ArcConnectDialog({ open, onOpenChange, onSelect }: Props) {
  const [mounted, setMounted] = useState(false);
  const [mobileHelp, setMobileHelp] = useState(false);
  useEffect(() => { if (open) setMounted(true); }, [open]);
  useEffect(() => { setMobileHelp(open && isMobileWithoutWallet()); }, [open]);
  if (!mounted) return null;
  return (
    <>
      <Suspense
        fallback={open ? (
          <div className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : null}
      >
        <ArcConnectKit open={open} onOpenChange={onOpenChange} onSelect={onSelect} />
      </Suspense>
      {mobileHelp && (
        <div className="fixed inset-x-3 bottom-3 z-[2147483647] rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-2xl" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Wallet stuck loading? Open in your wallet app</p>
            <button type="button" aria-label="Close" className="px-2 text-muted-foreground" onClick={() => setMobileHelp(false)}>✕</button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {walletLinks().map((w) => (
              <a key={w.name} href={w.href} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-secondary px-2 py-2 text-center text-xs font-medium text-secondary-foreground">
                {w.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
