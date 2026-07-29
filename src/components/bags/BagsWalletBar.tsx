"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ensureBuffer } from "@/lib/buffer-polyfill";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  onAddress?: (address: string | null) => void;
};

export function BagsWalletBar({ className, onAddress }: Props) {
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      await ensureBuffer();
      const { getBagsWalletAddress } = await import("@/lib/bags-sign");
      const addr = await getBagsWalletAddress();
      setAddress(addr);
      onAddress?.(addr);
    } catch {
      setAddress(null);
      onAddress?.(null);
    }
  }, [onAddress]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureBuffer();
        if (!cancelled) setReady(true);
        await refresh();
      } catch {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function connect() {
    setBusy(true);
    try {
      await ensureBuffer();
      const { connectBagsWallet } = await import("@/lib/bags-sign");
      const addr = await connectBagsWallet();
      setAddress(addr);
      onAddress?.(addr);
      toast.success("Phantom connected for Bags");
    } catch (err) {
      const msg = (err as Error).message || "Could not connect wallet";
      const friendly = /reading 'from'|Buffer/i.test(msg)
        ? "Wallet runtime failed to load (Buffer). Refresh and try again."
        : msg;
      toast.error(friendly);
    } finally {
      setBusy(false);
    }
  }

  const short = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl bg-muted/60 px-3 py-2.5",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Solana wallet
        </div>
        <div className="truncate text-sm font-semibold tabular-nums">
          {!ready
            ? "Preparing wallet runtime…"
            : (short ?? "Connect Phantom to launch, trade, or claim")}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className="h-9 shrink-0 rounded-full px-3"
        disabled={busy || !ready}
        onClick={() => void connect()}
      >
        {busy || !ready ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Wallet className="mr-1.5 h-4 w-4" />
            {address ? "Switch" : "Connect"}
          </>
        )}
      </Button>
    </div>
  );
}
