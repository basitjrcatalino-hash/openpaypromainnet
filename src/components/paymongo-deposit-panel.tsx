"use client";

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatOUSD } from "@/lib/wallet-utils";
import { QRPH_PROVIDERS } from "@/lib/paymongo";
import {
  createPaymongoQrTopup,
  confirmPaymongoTopup,
  getPaymongoConfig,
} from "@/lib/paymongo.functions";

type Props = {
  amountUsd: number;
  walletId?: string;
  className?: string;
  onSuccess?: () => void;
};

/** PayMongo QR Ph cash-in: pick the app you'll scan with, then pay one QR Ph code. */
export function PaymongoDepositPanel({ amountUsd, walletId, className, onSuccess }: Props) {
  const createFn = useServerFn(createPaymongoQrTopup);
  const confirmFn = useServerFn(confirmPaymongoTopup);
  const configFn = useServerFn(getPaymongoConfig);

  const createRef = useRef(createFn);
  const confirmRef = useRef(confirmFn);
  const successRef = useRef(onSuccess);
  createRef.current = createFn;
  confirmRef.current = confirmFn;
  successRef.current = onSuccess;

  const [providerId, setProviderId] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [phpRate, setPhpRate] = useState(62.72);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<{ url: string; intentId: string; php: number } | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    configFn()
      .then((c) => {
        if (cancelled) return;
        setConfigured(c.configured);
        setPhpRate(c.phpPerUsd);
      })
      .catch(() => !cancelled && setConfigured(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll every 4s while a QR is open.
  useEffect(() => {
    if (!qr || paid) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await confirmRef.current({
          data: { intentId: qr.intentId, ...(walletId ? { walletId } : {}) },
        });
        if (!stop && res.paid) {
          setPaid(true);
          toast.success("Payment received — OUSD credited");
          successRef.current?.();
        }
      } catch {
        /* keep polling */
      }
    };
    const id = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [qr, paid, walletId]);

  const active = QRPH_PROVIDERS.find((p) => p.id === providerId) ?? QRPH_PROVIDERS[0];

  const start = async () => {
    setBusy(true);
    try {
      const res = await createRef.current({
        data: {
          amountUsd,
          ...(active.id ? { provider: active.id, providerName: active.label } : {}),
        },
      });
      setPaid(false);
      setQr({ url: res.qrImageUrl!, intentId: res.intentId, php: res.phpAmount });
    } catch (e) {
      toast.error((e as Error).message || "Could not create the QR code");
    } finally {
      setBusy(false);
    }
  };

  const downloadQr = async () => {
    if (!qr) return;
    try {
      const response = await fetch(qr.url);
      if (!response.ok) throw new Error("Could not download QR code");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `openpay-qrph-${qr.intentId}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("QR code saved to your device");
    } catch {
      toast.error("Could not save the QR code. Press and hold the image to save it.");
    }
  };

  if (configured === false) {
    return (
      <div className={cn("rounded-2xl bg-card px-4 py-4 text-sm text-muted-foreground", className)}>
        PayMongo isn’t configured yet. Add the PayMongo secret key to enable QR Ph top-ups.
      </div>
    );
  }

  if (paid) {
    return (
      <div className={cn("grid place-items-center gap-2 rounded-2xl bg-card px-4 py-8", className)}>
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <p className="text-sm font-semibold">Payment received</p>
        <p className="text-sm text-muted-foreground">{formatOUSD(amountUsd)} credited</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {qr ? (
        <div className="space-y-3 rounded-2xl bg-card px-4 py-4 text-center">
          <img
            src={qr.url}
            alt="QR Ph code"
            width={240}
            height={240}
            className="mx-auto h-60 w-60 rounded-xl bg-white p-2"
          />
          <p className="text-sm font-semibold tabular-nums">
            ₱{qr.php.toLocaleString(undefined, { minimumFractionDigits: 2 })} ·{" "}
            {formatOUSD(amountUsd)}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">{active.hint}</p>
          <div className="mx-auto max-w-sm rounded-xl bg-muted/50 px-4 py-3 text-left">
            <p className="text-sm font-semibold text-foreground">How to pay</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>Save the QR code, or scan it using another device.</li>
              <li>Open GCash, Maya, or any QR Ph-supported banking app.</li>
              <li>Choose Scan QR, select the saved image, and confirm the exact amount.</li>
              <li>Keep this page open while your OUSD is credited automatically.</li>
            </ol>
          </div>
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for payment…
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={downloadQr}
          >
            <Download className="mr-2 h-4 w-4" /> Save QR code
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm"
            onClick={() => setQr(null)}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> New QR code
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">You pay</p>
            <p className="text-xl font-bold tabular-nums">
              ₱{(amountUsd * phpRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              1 OUSD = $1.00 · ₱{phpRate} per USD
            </p>
          </div>
          <div>
            <p className="mb-2 px-1 text-sm leading-relaxed text-muted-foreground">
              Pick the app you’ll open to scan. Every option uses the same QR Ph code.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {QRPH_PROVIDERS.map((p) => (
                <button
                  key={p.id || "qrph"}
                  type="button"
                  onClick={() => setProviderId(p.id)}
                  className={cn(
                    "rounded-xl border px-2 py-3 text-sm font-semibold transition press",
                    p.id === providerId
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-card text-muted-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            type="button"
            className="h-12 w-full rounded-full font-bold"
            disabled={busy || amountUsd <= 0}
            onClick={start}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Pay with {active.label} · {formatOUSD(amountUsd, { suffix: false })} OUSD
          </Button>
        </>
      )}
    </div>
  );
}
