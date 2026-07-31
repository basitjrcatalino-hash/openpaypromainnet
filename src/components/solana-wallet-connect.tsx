"use client";

import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

import { SolanaCommerceProvider } from "@/components/solana-commerce-provider";
import { cn } from "@/lib/utils";

const SolanaWalletConnectInner = lazy(() => import("@/components/solana-wallet-connect-inner"));

/**
 * Wallet Standard connect UI (Commerce Kit connector).
 * Docs: https://solana.com/docs/tools/commerce-kit/quickstart/wallet-connection
 */
export function SolanaWalletConnect({ className }: { className?: string }) {
  return (
    <SolanaCommerceProvider>
      <Suspense
        fallback={
          <div className={cn("flex h-20 items-center justify-center", className)}>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <SolanaWalletConnectInner className={className} />
      </Suspense>
    </SolanaCommerceProvider>
  );
}
