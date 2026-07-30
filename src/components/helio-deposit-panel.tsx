"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getHelioDepositSession } from "@/lib/helio-deposit.functions";
import type { HelioDepositProduct } from "@/lib/helio-deposit";
import { cn } from "@/lib/utils";

type Props = {
  /** Helio deposit product: multi-asset crypto or USDC Pay */
  product?: HelioDepositProduct;
  /** Exact USD amount the user entered — locked into the Helio session. */
  amountUsd: number;
  className?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

type DepositWidgetProps = {
  config: {
    depositCustomerToken: string;
    network?: "main" | "test";
    display?: "inline" | "button" | "new-tab" | "modal";
    themeMode?: "light" | "dark";
    onReady?: () => void;
    onSuccess?: () => void;
    onError?: (error: { message: string }) => void;
  };
};

function formatPayUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Inline MoonPay Commerce (Helio) deposit widget for Buy / top-up.
 * Widget is loaded client-only (avoids SSR crashes from @heliofi/deposit-react).
 * Re-fetches an amount-scoped deposit customer whenever `amountUsd` changes.
 */
export function HelioDepositPanel({
  product = "crypto",
  amountUsd,
  className,
  onSuccess,
  onError,
}: Props) {
  const getSession = useServerFn(getHelioDepositSession);
  const [DepositWidget, setDepositWidget] = useState<ComponentType<DepositWidgetProps> | null>(
    null,
  );
  const [token, setToken] = useState<string | null>(null);
  const [sessionAmount, setSessionAmount] = useState<number | null>(null);
  const [amountLocked, setAmountLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const lockedAmount = Number.isFinite(amountUsd) && amountUsd >= 1 ? Math.round(amountUsd) : 0;

  useEffect(() => {
    let cancelled = false;
    void import("@heliofi/deposit-react")
      .then((mod) => {
        if (cancelled) return;
        setDepositWidget(() => mod.MoonpayCommerceDeposit as ComponentType<DepositWidgetProps>);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = (e as Error).message || "Could not load MoonPay Commerce deposit widget";
        setError(msg);
        onErrorRef.current?.(msg);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (lockedAmount < 1) {
      setToken(null);
      setSessionAmount(null);
      setAmountLocked(false);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        setToken(null);
        try {
          const session = await getSession({
            data: {
              product,
              defaultOnrampAmount: lockedAmount,
            },
          });
          if (cancelled) return;
          setToken(session.depositCustomerToken);
          setSessionAmount(session.amountUsd ?? lockedAmount);
          setAmountLocked(session.mode === "api");
        } catch (e) {
          if (cancelled) return;
          const msg = (e as Error).message || "Could not start Helio deposit";
          setError(msg);
          onErrorRef.current?.(msg);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [getSession, product, lockedAmount]);

  if (lockedAmount < 1) {
    return (
      <div
        className={cn(
          "rounded-2xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        Enter an amount above to pay with {product === "usdc" ? "USDC" : "SOL / crypto"}.
      </div>
    );
  }

  if (loading || !DepositWidget) {
    return (
      <div
        className={cn(
          "flex min-h-70 flex-col items-center justify-center gap-2 rounded-2xl bg-muted/40",
          className,
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Preparing {formatPayUsd(lockedAmount)} checkout…
        </p>
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

  const payLabel = formatPayUsd(sessionAmount ?? lockedAmount);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="rounded-xl bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground">
        {product === "usdc" ? (
          <>
            Pay exactly <span className="font-semibold text-foreground">{payLabel}</span> in USDC →{" "}
            <span className="font-semibold text-foreground">{payLabel} OUSD</span> credited 1:1
            {!amountLocked
              ? " · send this exact amount in the widget"
              : " · amount locked in checkout"}
          </>
        ) : (
          <>
            Deposit <span className="font-semibold text-foreground">{payLabel}</span> worth of SOL /
            crypto → <span className="font-semibold text-foreground">{payLabel} OUSD</span> when
            confirmed
            {!amountLocked ? " · match this amount in the widget" : " · amount locked in checkout"}
          </>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl bg-card">
        <DepositWidget
          key={`${product}-${lockedAmount}-${token}`}
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
                  ? `${payLabel} USDC submitted — OUSD credits when confirmed`
                  : `${payLabel} deposit submitted — OUSD credits when confirmed`,
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
    </div>
  );
}
