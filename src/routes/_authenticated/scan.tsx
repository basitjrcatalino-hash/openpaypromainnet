import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, Image, Flashlight, FlashlightOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { parsePaymentQr } from "@/lib/parse-payment-qr";
import { scanQrFromFile, stopQrInstance, useQrCamera } from "@/components/qr-scanner";

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
  const handled = useRef(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const scannerRef = useQrCamera({
    elementId: SCAN_EL_ID,
    active: true,
    onError: (message) => {
      setError(message);
      setStarting(false);
    },
    onReady: (instance) => {
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
      void finishScan(text);
    },
  });

  async function finishScan(text: string) {
    await stopQrInstance(scannerRef.current);
    scannerRef.current = null;

    const parsed = parsePaymentQr(text);
    if (!parsed.to) {
      handled.current = false;
      toast.error("Invalid QR code");
      return;
    }

    toast.success("QR scanned");
    void navigate({
      to: "/send",
      search: {
        to: parsed.to,
        ...(parsed.amount ? { amount: parsed.amount } : {}),
        ...(parsed.asset ? { asset: parsed.asset } : {}),
      },
    });
  }

  async function toggleTorch() {
    const inst = scannerRef.current;
    if (!inst?.applyVideoConstraints) return;
    try {
      const next = !torchOn;
      await inst.applyVideoConstraints({
        // @ts-expect-error torch is non-standard but supported on many mobile browsers
        advanced: [{ torch: next }],
      });
      setTorchOn(next);
    } catch {
      toast.error("Flashlight not available");
    }
  }

  async function onPickImage(file: File) {
    try {
      const decoded = await scanQrFromFile(file);
      if (handled.current) return;
      handled.current = true;
      await finishScan(decoded);
    } catch {
      toast.error("No QR code found in image");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      {/* Camera region — same sizing approach as Send scanner (no object-cover) */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div
          id={SCAN_EL_ID}
          className="w-[min(100vw,360px)] overflow-hidden bg-black [&_img]:mx-auto [&_video]:mx-auto [&_video]:max-h-[70vh] [&_video]:w-full"
        />
        {starting && (
          <div className="absolute inset-0 grid place-items-center bg-black">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Viewfinder chrome */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="flex-1 bg-black/50" />
        <div className="flex justify-center">
          <div className="relative h-[240px] w-[240px]">
            <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-[3px] border-t-[3px] border-white" />
            <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-[3px] border-t-[3px] border-white" />
            <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-[3px] border-l-[3px] border-white" />
            <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-[3px] border-r-[3px] border-white" />
          </div>
        </div>
        <div className="flex-1 bg-black/50" />
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
          Scan a wallet address or payment QR to send
        </p>
        <div className="mx-auto flex max-w-xs items-center justify-center gap-8">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 text-xs font-medium text-white/90"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 backdrop-blur-md">
              <Image className="h-5 w-5" />
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
        {error && <p className="mt-4 text-center text-sm text-red-300">{error}</p>}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
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
