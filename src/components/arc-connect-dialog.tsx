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

export function ArcConnectDialog({ open, onOpenChange, onSelect }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { if (open) setMounted(true); }, [open]);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <ArcConnectKit open={open} onOpenChange={onOpenChange} onSelect={onSelect} />
    </Suspense>
  );
}
