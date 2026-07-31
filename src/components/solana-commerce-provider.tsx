"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

type ConnectorProviderComponent = (props: {
  children: ReactNode;
  config?: { autoConnect?: boolean; debug?: boolean };
}) => ReactNode;

/**
 * Wallet Standard connector for Solana Commerce Kit.
 * Docs: https://solana.com/docs/tools/commerce-kit/quickstart/wallet-connection
 *
 * Kept client-only and scoped to payment surfaces so it does not replace
 * OpenPay Pro SIWS / Phantom Connect auth.
 */
export function SolanaCommerceProvider({
  children,
  autoConnect = true,
}: {
  children: ReactNode;
  autoConnect?: boolean;
}) {
  const [Provider, setProvider] = useState<ConnectorProviderComponent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("@solana-commerce/connector")
      .then((mod) => {
        if (!cancelled) setProvider(() => mod.ConnectorProvider as ConnectorProviderComponent);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message || "Failed to load Solana connector");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-center text-xs text-destructive">
        {error}
      </div>
    );
  }

  if (!Provider) {
    return (
      <div className="flex h-24 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return <Provider config={{ autoConnect }}>{children}</Provider>;
}
