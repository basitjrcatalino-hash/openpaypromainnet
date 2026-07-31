"use client";

import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { SolanaPaymentButton } from "@/components/solana-payment-button";
import { SolanaPayQrPanel } from "@/components/solana-pay-qr-panel";
import { SolanaWalletConnect } from "@/components/solana-wallet-connect";
import { creditSolanaPayTopup } from "@/lib/solana-topup.functions";
import {
  SOLANA_MERCHANT_WALLET,
  isSolanaMerchantConfigured,
} from "@/lib/solana-payment";
import { cn } from "@/lib/utils";

export function SolanaReceivePanelBody({
  merchantWallet,
  sourceLabel,
  amountUsd,
  mode = "tip",
  creditOnSuccess = false,
  showWalletConnect = true,
  showSolanaPayQr = true,
  className,
}: {
  merchantWallet: string | null;
  sourceLabel: string | null;
  /** Fixed USD amount for buyNow / tip credit. */
  amountUsd?: number;
  mode?: "tip" | "buyNow";
  /** Credit OUSD 1:1 after PaymentButton success (top-up). */
  creditOnSuccess?: boolean;
  showWalletConnect?: boolean;
  showSolanaPayQr?: boolean;
  className?: string;
}) {
  const configured = isSolanaMerchantConfigured(merchantWallet);
  const credit = useServerFn(creditSolanaPayTopup);
  const qc = useQueryClient();
  const paidAmountRef = useRef<number | null>(amountUsd ?? null);
  const [crediting, setCrediting] = useState(false);

  async function handleSuccess(signature: string) {
    if (!creditOnSuccess) return;
    const amount = paidAmountRef.current ?? amountUsd;
    if (amount == null || !(amount > 0)) {
      toast.message("Payment confirmed — set an amount to auto-credit OUSD");
      return;
    }
    setCrediting(true);
    try {
      const r = await credit({ data: { amount, signature } });
      if (r.alreadyCredited) {
        toast.message("This Solana payment was already credited");
      } else {
        toast.success(`${r.amount.toFixed(2)} OUSD credited`);
      }
      void qc.invalidateQueries({ queryKey: ["active-wallet"] });
      void qc.invalidateQueries({ queryKey: ["wallets"] });
      void qc.invalidateQueries({ queryKey: ["txs"] });
      void qc.invalidateQueries({ queryKey: ["ledger-entries"] });
      void qc.invalidateQueries({ queryKey: ["wallet-portfolio-totals"] });
    } catch (err) {
      toast.error((err as Error).message || "Could not credit Solana payment");
    } finally {
      setCrediting(false);
    }
  }

  return (
    <div className={cn("space-y-5", className)}>
      <div className="text-center">
        <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-[#9945FF]/15 text-[#9945FF]">
          <WalletIcon className="h-6 w-6" />
        </span>
        <p className="text-lg font-semibold text-foreground">Solana Commerce</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Wallet Standard connect · PaymentButton · Solana Pay QR
        </p>
        {sourceLabel ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">{sourceLabel}</p>
        ) : null}
        {amountUsd != null && amountUsd > 0 ? (
          <p className="mt-2 text-sm font-semibold tabular-nums">
            ${amountUsd.toFixed(2)} → OUSD
          </p>
        ) : null}
      </div>

      {showWalletConnect ? <SolanaWalletConnect /> : null}

      {configured ? (
        <SolanaPaymentButton
          merchantWallet={merchantWallet}
          mode={mode}
          showQR
          position="overlay"
          paymentConfig={
            mode === "buyNow" && amountUsd != null && amountUsd > 0
              ? {
                  products: [
                    {
                      id: "openpay-ousd-topup",
                      name: `${amountUsd.toFixed(2)} OUSD`,
                      price: amountUsd,
                      quantity: 1,
                    },
                  ],
                }
              : undefined
          }
          onPayment={(amount) => {
            paidAmountRef.current = amount;
          }}
          onPaymentSuccess={(sig) => void handleSuccess(sig)}
          className="flex w-full justify-center"
        >
          <button
            type="button"
            disabled={crediting}
            className="solana-pay-cta flex h-14 w-full max-w-sm items-center justify-center gap-2.5 rounded-full px-6 text-base font-bold text-white press disabled:opacity-60"
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-[15px] font-black leading-none"
              aria-hidden
            >
              ◎
            </span>
            {crediting
              ? "Crediting…"
              : mode === "buyNow"
                ? "Pay with Solana"
                : "Tip / Pay with Solana"}
          </button>
        </SolanaPaymentButton>
      ) : (
        <div className="space-y-3 rounded-2xl bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Connect Phantom in Settings, or set{" "}
            <code className="font-mono text-[11px]">VITE_SOLANA_MERCHANT_WALLET</code> to receive
            Solana payments.
          </p>
          <Link
            to="/settings"
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Open Settings
          </Link>
        </div>
      )}

      {showSolanaPayQr ? (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Solana Pay QR
          </p>
          <SolanaPayQrPanel merchantWallet={merchantWallet} />
        </div>
      ) : null}
    </div>
  );
}

/** Re-export merchant wallet for callers that only need the fallback body. */
export { SOLANA_MERCHANT_WALLET };
