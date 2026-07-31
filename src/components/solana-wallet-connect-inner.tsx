"use client";

import { useState } from "react";
import { useConnector } from "@solana-commerce/connector";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

/** Renders under SolanaCommerceProvider / ConnectorProvider. */
export default function SolanaWalletConnectInner({ className }: { className?: string }) {
  const { wallets, connected, connecting, accounts, selectedAccount, select, disconnect } =
    useConnector();
  const [busy, setBusy] = useState<string | null>(null);
  const address = selectedAccount || accounts[0]?.address || null;

  async function connect(name: string) {
    setBusy(name);
    try {
      await select(name);
      toast.success(`Connected ${name}`);
    } catch (err) {
      toast.error((err as Error).message || "Connection failed");
    } finally {
      setBusy(null);
    }
  }

  if (connected && address) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3",
          className,
        )}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Solana wallet
          </p>
          <p className="mt-0.5 truncate font-mono text-sm font-semibold">{shortAddress(address)}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={connecting}
          onClick={() => void disconnect()}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  const list = wallets.filter((w) => w.connectable !== false);

  return (
    <div className={cn("space-y-2", className)}>
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Connect a Solana wallet
      </p>
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          <Wallet className="mx-auto mb-2 h-5 w-5 opacity-70" />
          No Wallet Standard wallets found. Install Phantom, Solflare, or Backpack.
        </div>
      ) : (
        list.map((wallet) => (
          <button
            key={wallet.name}
            type="button"
            disabled={connecting || busy === wallet.name}
            onClick={() => void connect(wallet.name)}
            className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-left press hover:bg-muted/40 disabled:opacity-60"
          >
            {wallet.icon ? (
              <img src={wallet.icon} alt="" className="h-8 w-8 rounded-lg object-contain" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted">
                <Wallet className="h-4 w-4" />
              </span>
            )}
            <span className="flex-1 text-sm font-semibold">{wallet.name}</span>
            {busy === wallet.name || connecting ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <span className="text-xs font-semibold text-primary">Connect</span>
            )}
          </button>
        ))
      )}
    </div>
  );
}
