"use client";

import { AddressType, useAccounts, usePhantom } from "@phantom/react-sdk";
import { Link } from "@tanstack/react-router";
import { Wallet as WalletIcon } from "lucide-react";

import { usePhantomClientReady } from "@/components/phantom-provider";
import { SolanaPaymentButton } from "@/components/solana-payment-button";
import {
  SOLANA_MERCHANT_WALLET,
  isSolanaMerchantConfigured,
} from "@/lib/solana-payment";
import { shortAddress } from "@/lib/wallet-utils";

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
  return <SolanaReceivePanelWithPhantom />;
}

function SolanaReceivePanelWithPhantom() {
  const { isConnected } = usePhantom();
  const accounts = useAccounts();
  const phantomSolanaAddress = accounts?.find(
    (a) => a.addressType === AddressType.solana || String(a.addressType) === "Solana",
  )?.address;

  const merchantWallet =
    (isConnected && phantomSolanaAddress) || SOLANA_MERCHANT_WALLET || null;
  const sourceLabel =
    isConnected && phantomSolanaAddress
      ? `Phantom · ${shortAddress(phantomSolanaAddress)}`
      : SOLANA_MERCHANT_WALLET
        ? `Merchant · ${shortAddress(SOLANA_MERCHANT_WALLET)}`
        : null;

  return <SolanaReceivePanelBody merchantWallet={merchantWallet} sourceLabel={sourceLabel} />;
}

function SolanaReceivePanelBody({
  merchantWallet,
  sourceLabel,
}: {
  merchantWallet: string | null;
  sourceLabel: string | null;
}) {
  const configured = isSolanaMerchantConfigured(merchantWallet);

  return (
    <div className="space-y-5">
      <div className="text-center">
        <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-[#AB9FF2]/15 text-[#AB9FF2]">
          <WalletIcon className="h-6 w-6" />
        </span>
        <p className="text-lg font-semibold text-foreground">Accept Solana payments</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop-in tip button — wallet connect, tokens, and Solana Pay QR
        </p>
        {sourceLabel ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">{sourceLabel}</p>
        ) : null}
      </div>

      {configured ? (
        <SolanaPaymentButton
          merchantWallet={merchantWallet}
          mode="tip"
          showQR
          className="flex justify-center"
        >
          <button
            type="button"
            className="flex h-14 w-full max-w-sm items-center justify-center rounded-full bg-[#AB9FF2] px-6 text-base font-semibold text-[#1a1a2e] press"
          >
            Pay with Solana
          </button>
        </SolanaPaymentButton>
      ) : (
        <div className="space-y-3 rounded-2xl bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Connect Phantom in Settings, or set{" "}
            <code className="font-mono text-[11px]">VITE_SOLANA_MERCHANT_WALLET</code> to receive
            tips on Solana.
          </p>
          <Link
            to="/settings"
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Open Settings
          </Link>
        </div>
      )}
    </div>
  );
}
