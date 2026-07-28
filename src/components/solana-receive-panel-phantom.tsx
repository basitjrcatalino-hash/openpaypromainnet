"use client";

import { AddressType, useAccounts, usePhantom } from "@phantom/react-sdk";

import { SolanaReceivePanelBody } from "@/components/solana-receive-panel-body";
import {
  SOLANA_MERCHANT_WALLET,
} from "@/lib/solana-payment";
import { shortAddress } from "@/lib/wallet-utils";

/** Loaded only after Phantom client is ready (keeps @phantom off the SSR graph). */
export default function SolanaReceivePanelWithPhantom() {
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
