"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PaymentButton, type PaymentButtonProps } from "@solana-commerce/kit";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  SOLANA_MERCHANT_NAME,
  SOLANA_PAYMENT_NETWORK,
  SOLANA_PAYMENT_THEME,
  SOLANA_RPC_URL,
  isSolanaMerchantConfigured,
  resolveSolanaMerchantWallet,
} from "@/lib/solana-payment";
import { cn } from "@/lib/utils";

export type SolanaPaymentButtonProps = {
  /** Solana address that receives funds. Falls back to VITE_SOLANA_MERCHANT_WALLET. */
  merchantWallet?: string | null;
  merchantName?: string;
  mode?: "tip" | "cart" | "buyNow";
  showQR?: boolean;
  className?: string;
  children?: ReactNode;
  onPaymentSuccess?: PaymentButtonProps["onPaymentSuccess"];
  onPaymentError?: PaymentButtonProps["onPaymentError"];
  paymentConfig?: PaymentButtonProps["paymentConfig"];
};

/**
 * Client-only Solana Commerce Kit PaymentButton.
 * Handles wallet connect, token selection, and tip/pay UI out of the box.
 */
export function SolanaPaymentButton({
  merchantWallet,
  merchantName = SOLANA_MERCHANT_NAME,
  mode = "tip",
  showQR = true,
  className,
  children,
  onPaymentSuccess,
  onPaymentError,
  paymentConfig,
}: SolanaPaymentButtonProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const wallet = resolveSolanaMerchantWallet(merchantWallet);

  if (!ready) {
    return (
      <div
        className={cn(
          "flex h-12 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!isSolanaMerchantConfigured(wallet)) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        Connect Phantom or set <code className="font-mono">VITE_SOLANA_MERCHANT_WALLET</code> to
        accept Solana payments.
      </div>
    );
  }

  return (
    <div className={cn("solana-payment-button", className)}>
      <PaymentButton
        config={{
          merchant: {
            name: merchantName,
            wallet,
          },
          mode,
          network: SOLANA_PAYMENT_NETWORK,
          rpcUrl: SOLANA_RPC_URL,
          showQR,
          theme: SOLANA_PAYMENT_THEME,
          showMerchantInfo: true,
        }}
        paymentConfig={paymentConfig}
        onPaymentStart={() => {
          toast.message("Solana payment started");
        }}
        onPaymentSuccess={(signature) => {
          toast.success("Solana payment confirmed");
          onPaymentSuccess?.(signature);
        }}
        onPaymentError={(error) => {
          toast.error(error.message || "Solana payment failed");
          onPaymentError?.(error);
        }}
        onCancel={() => {
          toast.message("Payment cancelled");
        }}
      >
        {children}
      </PaymentButton>
    </div>
  );
}
