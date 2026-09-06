"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatOUSD } from "@/lib/wallet-utils";
import { PAYPAL_FUNDING, type PaypalFundingMethod } from "@/lib/paypal";
import {
  capturePaypalTopup,
  createPaypalTopupOrder,
  getPaypalConfig,
} from "@/lib/paypal.functions";

type PaypalButtonsApi = {
  Buttons: (opts: Record<string, unknown>) => {
    isEligible?: () => boolean;
    render: (el: HTMLElement) => Promise<void>;
    close?: () => void;
  };
  FUNDING: Record<string, string>;
};

declare global {
  interface Window {
    paypal?: PaypalButtonsApi;
  }
}

let sdkPromise: Promise<PaypalButtonsApi> | null = null;

function loadPaypalSdk(clientId: string): Promise<PaypalButtonsApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("No browser"));
  if (window.paypal) return Promise.resolve(window.paypal);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<PaypalButtonsApi>((resolve, reject) => {
    const script = document.createElement("script");
    const params = new URLSearchParams({
      "client-id": clientId,
      currency: "USD",
      intent: "capture",
      components: "buttons,messages",
      "enable-funding": "card",
    });
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.onload = () =>
      window.paypal
        ? resolve(window.paypal)
        : reject(new Error("PayPal SDK loaded without buttons"));
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("PayPal SDK failed to load — check ad blockers"));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export function PaypalDepositPanel({
  amountUsd,
  walletId,
  className,
  onSuccess,
}: {
  amountUsd: number;
  walletId?: string | undefined;
  className?: string;
  onSuccess?: () => void;
}) {
  const cfgFn = useServerFn(getPaypalConfig);
  const createFn = useServerFn(createPaypalTopupOrder);
  const captureFn = useServerFn(capturePaypalTopup);

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [funding, setFunding] = useState<PaypalFundingMethod>("paypal");

  const host = useRef<HTMLDivElement | null>(null);
  const amountRef = useRef(amountUsd);
  amountRef.current = amountUsd;

  const createRef = useRef(createFn);
  createRef.current = createFn;
  const captureRef = useRef(captureFn);
  captureRef.current = captureFn;
  const successRef = useRef(onSuccess);
  successRef.current = onSuccess;
  const walletRef = useRef(walletId);
  walletRef.current = walletId;

  const [clientId, setClientId] = useState<string>("");

  useEffect(() => {
    let alive = true;
    void cfgFn({})
      .then((cfg) => {
        if (!alive) return;
        setConfigured(cfg.configured);
        setClientId(cfg.clientId);
      })
      .catch(() => alive && setConfigured(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mount = useCallback(async () => {
    if (!clientId || !host.current) return;
    setError(null);
    setReady(false);
    const container = host.current;
    container.innerHTML = "";
    try {
      const sdk = await loadPaypalSdk(clientId);
      const fundingSource = sdk.FUNDING?.[funding.toUpperCase()] ?? funding;
      const buttons = sdk.Buttons({
        fundingSource,
        style: { layout: "vertical", shape: "pill", height: 48, label: "pay" },
        createOrder: async () => {
          const res = await createRef.current({ data: { amountUsd: amountRef.current } });
          return res.orderId;
        },
        onApprove: async (data: { orderID?: string; orderId?: string }) => {
          const orderId = String(data.orderID || data.orderId || "");
          const res = await captureRef.current({
            data: {
              orderId,
              method: funding,
              ...(walletRef.current ? { walletId: walletRef.current } : {}),
            },
          });
          if (res.paid) {
            setPaid(true);
            toast.success("Payment received — OUSD credited");
            successRef.current?.();
          } else {
            toast.error("PayPal has not confirmed this payment yet");
          }
        },
        onCancel: () => toast.message("PayPal checkout cancelled"),
        onError: (err: unknown) => {
          setError((err as Error)?.message || "PayPal checkout failed");
        },
      });
      if (buttons.isEligible && !buttons.isEligible()) {
        setError("This PayPal method isn’t available on your device or region.");
        return;
      }
      await buttons.render(container);
      setReady(true);
    } catch (e) {
      setError((e as Error).message || "Could not load PayPal");
    }
  }, [clientId, funding]);

  useEffect(() => {
    if (paid) return;
    void mount();
  }, [mount, paid]);

  if (configured === false) {
    return (
      <div className={cn("rounded-2xl bg-card px-4 py-4 text-sm text-muted-foreground", className)}>
        PayPal isn’t configured yet. Add the PayPal client ID and secret to enable PayPal top-ups.
      </div>
    );
  }

  if (paid) {
    return (
      <div className={cn("grid place-items-center gap-2 rounded-2xl bg-card px-4 py-8", className)}>
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <p className="text-sm font-semibold">Payment received</p>
        <p className="text-xs text-muted-foreground">{formatOUSD(amountUsd)} credited</p>
      </div>
    );
  }

  const active = PAYPAL_FUNDING.find((f) => f.id === funding) ?? PAYPAL_FUNDING[0];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-2xl bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">You pay</p>
        <p className="text-xl font-bold tabular-nums">${amountUsd.toFixed(2)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          1 OUSD = $1.00 · credited automatically after approval
        </p>
      </div>

      <div>
        <p className="mb-2 px-1 text-xs text-muted-foreground">Choose how you’ll pay with PayPal.</p>
        <div className="grid grid-cols-2 gap-2">
          {PAYPAL_FUNDING.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFunding(f.id)}
              className={cn(
                "rounded-xl border px-2 py-3 text-xs font-semibold transition press",
                f.id === funding
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 bg-card text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="mt-2 px-1 text-xs text-muted-foreground">{active.hint}</p>
      </div>

      <div className="rounded-2xl bg-card px-3 py-3">
        <div className="mx-auto w-full max-w-xl">
          <div ref={host} className="min-h-[52px]" />
        </div>
        {!ready && !error ? (
          <p className="flex items-center justify-center gap-1.5 px-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading PayPal…
          </p>
        ) : null}
        {error ? <p className="px-1 text-center text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
