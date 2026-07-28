"use client";

import { lazy, Suspense } from "react";

import { usePhantomClientReady } from "@/components/phantom-provider";
import { SolanaReceivePanelBody } from "@/components/solana-receive-panel-body";
import { SOLANA_MERCHANT_WALLET } from "@/lib/solana-payment";

const SolanaReceivePanelWithPhantom = lazy(
  () => import("@/components/solana-receive-panel-phantom"),
);

/**
 * Receive-via-Solana panel using Commerce Kit PaymentButton.
 * Phantom hooks only run when AppPhantomProvider is ready.
 */
export function SolanaReceivePanel() {
  const ready = usePhantomClientReady();
  if (!ready) {
    return (
      <SolanaReceivePanelBody
        merchantWallet={SOLANA_MERCHANT_WALLET || null}
        sourceLabel={null}
      />
    );
  }
  return (
    <Suspense
      fallback={
        <SolanaReceivePanelBody
          merchantWallet={SOLANA_MERCHANT_WALLET || null}
          sourceLabel={null}
        />
      }
    >
      <SolanaReceivePanelWithPhantom />
    </Suspense>
  );
}
