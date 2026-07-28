"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import "@/lib/buffer-polyfill";

import {
  SOLANA_MERCHANT_NAME,
  SOLANA_PAYMENT_NETWORK,
  SOLANA_PAYMENT_THEME,
  SOLANA_RPC_URL,
  isSolanaMerchantConfigured,
  resolveSolanaMerchantWallet,
} from "@/lib/solana-payment";
import { cn } from "@/lib/utils";

type PaymentButtonComponent = ComponentType<{
  config: {
    merchant: { name: string; wallet: string };
    mode: "tip" | "cart" | "buyNow";
    network?: "mainnet" | "devnet" | "testnet";
    rpcUrl?: string;
    showQR?: boolean;
    theme?: Record<string, unknown>;
    showMerchantInfo?: boolean;
  };
  paymentConfig?: unknown;
  children?: ReactNode;
  onPaymentStart?: () => void;
  onPaymentSuccess?: (signature: string) => void;
  onPaymentError?: (error: Error) => void;
  onCancel?: () => void;
}>;

export type SolanaPaymentButtonProps = {
  /** Solana address that receives funds. Falls back to VITE_SOLANA_MERCHANT_WALLET. */
  merchantWallet?: string | null;
  merchantName?: string;
  mode?: "tip" | "cart" | "buyNow";
  showQR?: boolean;
  className?: string;
  children?: ReactNode;
  onPaymentSuccess?: (signature: string) => void;
  onPaymentError?: (error: Error) => void;
  paymentConfig?: unknown;
};

/**
 * Client-only Solana Commerce Kit PaymentButton.
 * Dynamically imports the kit after mount so Nitro/workerd SSR never resolves it.
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
  const [PaymentButton, setPaymentButton] = useState<PaymentButtonComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("@solana-commerce/kit")
      .then((mod) => {
        if (!cancelled) setPaymentButton(() => mod.PaymentButton as PaymentButtonComponent);
      })
      .catch((err) => {
        if (!cancelled) setLoadError((err as Error).message || "Failed to load Solana payments");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const wallet = resolveSolanaMerchantWallet(merchantWallet);

  if (loadError) {
    return (
      <div
        className={cn(
          "rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-center text-xs text-destructive",
          className,
        )}
      >
        {loadError}
      </div>
    );
  }

  if (!PaymentButton) {
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
