import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImageIcon, Flashlight, FlashlightOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { parsePaymentQr } from "@/lib/parse-payment-qr";
import { scanQrFromFile, stopQrInstance, useQrCamera } from "@/lib/qr-camera";

export const Route = createFileRoute("/_authenticated/scan")({
  ssr: false,
  head: () => ({ meta: [{ title: "Scan — OpenPay Pro" }] }),
  component: ScanPage,
});

const SCAN_EL_ID = "openpay-qr-reader";

function ScanPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [camKey, setCamKey] = useState(0);
  const scanElId = `${SCAN_EL_ID}-${camKey}`;
  const handled = useRef(false);
  const alive = useRef(true);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const finishRef = useRef<(text: string) => Promise<void>>(async () => undefined);

  const scannerRef = useQrCamera({
    elementId: scanElId,
    active: true,
    onError: (message) => {
      if (!alive.current) return;
      setError(message);
      setStarting(false);
    },
    onReady: (instance) => {
      if (!alive.current) return;
      setError(null);
      setStarting(false);
      try {
        const caps = instance.getRunningTrackCameraCapabilities?.();
        setTorchSupported(Boolean(caps && "torch" in (caps as object)));
      } catch {
        setTorchSupported(false);
      }
    },
    onResult: (text) => {
      if (handled.current) return;
      handled.current = true;
      void finishRef.current(text);
    },
  });

  // Reset UI when retry remounts the camera element.
  useEffect(() => {
    setStarting(true);
    setError(null);
    setTorchOn(false);
    setTorchSupported(false);
    handled.current = false;
  }, [camKey]);

  finishRef.current = async (text: string) => {
    await stopQrInstance(scannerRef.current);
    scannerRef.current = null;

    const parsed = parsePaymentQr(text);
    if (!parsed.to) {
      handled.current = false;
      if (alive.current) toast.error("Invalid QR code");
      // Restart camera so user can try another code
      if (alive.current) setCamKey((k) => k + 1);
      return;
    }

    if (alive.current) {
      toast.success(
        parsed.rail === "openpay"
          ? "OpenPay account scanned"
          : parsed.kind === "pro_wallet"
            ? "OpenPay Pro wallet scanned"
            : "QR scanned",
      );
    }
    void navigate({
      to: "/send",
      search: {
        to: parsed.to,
        rail: parsed.rail,
        ...(parsed.amount ? { amount: parsed.amount } : {}),
        ...(parsed.asset ? { asset: parsed.asset } : { asset: "OUSD" as const }),
      },
    });
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function toggleTorch() {
    const inst = scannerRef.current;
    if (!inst?.applyVideoConstraints) return;
    try {
      const next = !torchOn;
      await inst.applyVideoConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      } as MediaTrackConstraints);
      if (alive.current) setTorchOn(next);
    } catch {
      toast.error("Flashlight not available");
    }
  }

  async function onPickImage(file: File) {
    try {
      const decoded = await scanQrFromFile(file);
      if (handled.current) return;
      handled.current = true;
      await finishRef.current(decoded);
    } catch {
      toast.error("No QR code found in image");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      {/* Full-bleed camera — must fill the viewport so the viewfinder isn't black */}
      <div
        id={scanElId}
        className="absolute inset-0 h-full w-full overflow-hidden bg-black [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:max-w-none [&_video]:object-cover"
      />

      {starting && (
        <div className="absolute inset-0 z-5 grid place-items-center bg-black/80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Dimmed mask + viewfinder corners */}
      <div className="pointer-events-none absolute inset-0 z-6 flex flex-col">
        <div className="flex-1 bg-black/55" />
        <div className="flex justify-center">
          <div className="relative h-60 w-60 shrink-0">
            <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-[3px] border-t-[3px] border-white" />
            <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-[3px] border-t-[3px] border-white" />
            <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-[3px] border-l-[3px] border-white" />
            <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-[3px] border-r-[3px] border-white" />
          </div>
        </div>
        <div className="flex-1 bg-black/55" />
      </div>

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate({ to: "/dashboard" })}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur-md"
          aria-label="Close scanner"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-sm font-semibold tracking-wide">Scan a QR code</div>
        <div className="w-10" />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <p className="mb-6 text-center text-sm text-white/70">
          Scan OpenPay Pro wallet, OpenPay OP / @username, or pay link
        </p>
        <div className="mx-auto flex max-w-xs items-center justify-center gap-8">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 text-xs font-medium text-white/90"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 backdrop-blur-md">
              <ImageIcon className="h-5 w-5" />
            </span>
            Photos
          </button>
          {torchSupported && (
            <button
              type="button"
              onClick={toggleTorch}
              className="flex flex-col items-center gap-2 text-xs font-medium text-white/90"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 backdrop-blur-md">
                {torchOn ? (
                  <FlashlightOff className="h-5 w-5" />
                ) : (
                  <Flashlight className="h-5 w-5" />
                )}
              </span>
              {torchOn ? "Light off" : "Light"}
            </button>
          )}
        </div>
        {error && (
          <div className="mt-4 space-y-3 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => setCamKey((k) => k + 1)}
              className="rounded-full bg-white/15 px-4 py-2 text-xs font-medium text-white"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPickImage(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
