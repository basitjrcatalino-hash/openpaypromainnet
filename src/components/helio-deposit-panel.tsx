"use client";

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MoonpayCommerceDeposit } from "@heliofi/deposit-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getHelioDepositSession } from "@/lib/helio-deposit.functions";
import type { HelioDepositProduct } from "@/lib/helio-deposit";
import { cn } from "@/lib/utils";

type Props = {
  /** Helio deposit product: multi-asset crypto or USDC Pay */
  product?: HelioDepositProduct;
  /** Prefill Helio on-ramp amount (USD). */
  amountUsd?: number;
  className?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

/**
 * Inline MoonPay Commerce (Helio) deposit widget for Buy / top-up.
 * Token is created per user via Helio deposit-customers API when keys are set.
 */
export function HelioDepositPanel({
  product = "crypto",
  amountUsd,
  className,
  onSuccess,
  onError,
}: Props) {
  const getSession = useServerFn(getHelioDepositSession);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef(amountUsd);
  amountRef.current = amountUsd;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    setToken(null);
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const amt = amountRef.current;
        const session = await getSession({
          data: {
            product,
            defaultOnrampAmount:
              typeof amt === "number" && amt >= 1 ? Math.round(amt) : undefined,
          },
        });
        if (cancelled) return;
        setToken(session.depositCustomerToken);
      } catch (e) {
        if (cancelled) return;
        const msg = (e as Error).message || "Could not start Helio deposit";
        setError(msg);
        onErrorRef.current?.(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getSession, product]);

  if (loading) {
    return (
      <div
        className={cn(
          "flex min-h-[280px] items-center justify-center rounded-2xl bg-muted/40",
          className,
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !token) {
    return (
      <div
        className={cn(
          "rounded-2xl bg-destructive/10 px-4 py-3 text-center text-xs text-destructive",
          className,
        )}
      >
        {error || "Deposit widget unavailable"}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl bg-card", className)}>
      <MoonpayCommerceDeposit
        config={{
          depositCustomerToken: token,
          network: "main",
          display: "inline",
          themeMode: "light",
          onReady: () => {
            /* widget mounted */
          },
          onSuccess: () => {
            toast.success(
              product === "usdc"
                ? "USDC deposit submitted — OUSD credits when confirmed"
                : "Deposit submitted — OUSD credits when confirmed",
            );
            onSuccess?.();
          },
          onError: (err) => {
            const msg = err?.message || "Deposit error";
            toast.error(msg);
            onError?.(msg);
          },
        }}
      />
    </div>
  );
}
