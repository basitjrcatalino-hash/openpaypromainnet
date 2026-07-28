"use client";

import "@/lib/buffer-polyfill";
import { useState } from "react";
import { AddressType, useAccounts, useDisconnect, usePhantom } from "@phantom/react-sdk";
import { Link2Off, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { usePhantomClientReady } from "@/components/phantom-provider";
import { shortAddress } from "@/lib/wallet-utils";

/** Settings rows for Phantom Connect — only renders when the client provider is ready. */
export function PhantomSettingsRows() {
  const ready = usePhantomClientReady();
  if (!ready) return null;
  return <PhantomSettingsRowsInner />;
}

function PhantomSettingsRowsInner() {
  const { isConnected } = usePhantom();
  const accounts = useAccounts();
  const { disconnect, isDisconnecting } = useDisconnect();
  const [busy, setBusy] = useState(false);

  const solanaAddress = accounts?.find(
    (a) => a.addressType === AddressType.solana || String(a.addressType) === "Solana",
  )?.address;

  if (!isConnected || !solanaAddress) return null;

  return (
    <>
      <li className="border-b border-border/60">
        <div className="flex w-full items-center gap-3 px-4 py-3.5">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#AB9FF2]/20 text-[#AB9FF2]">
            <Wallet className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">Phantom</span>
            <span className="block truncate text-xs text-muted-foreground">
              Connected · {shortAddress(solanaAddress)}
            </span>
          </span>
        </div>
      </li>
      <li className="border-b border-border/60">
        <button
          type="button"
          disabled={busy || isDisconnecting}
          onClick={async () => {
            setBusy(true);
            try {
              await disconnect();
              toast.success("Phantom disconnected");
            } catch (err) {
              toast.error((err as Error).message || "Could not disconnect Phantom");
            } finally {
              setBusy(false);
            }
          }}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left press hover:bg-muted/40 disabled:opacity-60"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground">
            {busy || isDisconnecting ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <Link2Off className="h-4.5 w-4.5" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">Disconnect Phantom</span>
            <span className="block text-xs text-muted-foreground">
              Disconnect wallet session (does not sign you out of OpenPay)
            </span>
          </span>
        </button>
      </li>
    </>
  );
}
