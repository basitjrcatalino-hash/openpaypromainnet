import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Image, Flashlight, FlashlightOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/scan")({
  ssr: false,
  head: () => ({ meta: [{ title: "Scan — OpenPay Pro" }] }),
  component: ScanPage,
});

function parseScanned(text: string): { to: string; amount?: string; asset?: "OUSD" | "PI" } {
  try {
    if (text.startsWith("openpay:") || text.startsWith("ethereum:") || text.includes("?")) {
      const [scheme, rest] = text.split(":");
      const body = rest ?? scheme;
      const [addr, query] = body.split("?");
      const params = new URLSearchParams(query ?? "");
      const asset = (params.get("asset") as "OUSD" | "PI") ?? undefined;
      const amount = params.get("amount") ?? params.get("value") ?? undefined;
      return { to: addr.replace(/^\/\//, ""), amount: amount ?? undefined, asset };
    }
  } catch {
    // fall through
  }
  return { to: text.trim() };
}

function ScanPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const scannerRef = useRef<{
    isScanning?: boolean;
    stop: () => Promise<void>;
    clear?: () => Promise<void>;
    getRunningTrackCameraCapabilities?: () => { torch?: { value?: boolean } };
    applyVideoConstraints?: (c: MediaTrackConstraints) => Promise<void>;
  } | null>(null);
  const handled = useRef(false);
  const elId = "phantom-qr-reader";
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const instance = new Html5Qrcode(elId, { verbose: false });
        scannerRef.current = instance as unknown as typeof scannerRef.current;

        await instance.start(
          { facingMode: "environment" },
          {
            fps: 12,
            qrbox: (viewW, viewH) => {
              const edge = Math.floor(Math.min(viewW, viewH) * 0.72);
              return { width: edge, height: edge };
            },
            aspectRatio: 1,
            disableFlip: false,
          },
          (decoded: string) => {
            if (handled.current || cancelled) return;
            handled.current = true;
            void handleResult(decoded);
          },
          () => {},
        );

        try {
          const caps = instance.getRunningTrackCameraCapabilities?.();
          setTorchSupported(Boolean(caps && "torch" in (caps as object)));
        } catch {
          setTorchSupported(false);
        }
      } catch (e) {
        setError((e as Error).message || "Camera permission denied");
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    async function stop() {
      try {
        if (scannerRef.current?.isScanning) await scannerRef.current.stop();
        await scannerRef.current?.clear?.();
      } catch {
        // ignore stop errors
      }
      scannerRef.current = null;
    }

    return () => {
      cancelled = true;
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResult(text: string) {
    try {
      if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    } catch {
      // ignore
    }
    const parsed = parseScanned(text);
    toast.success("QR scanned");
    void navigate({
      to: "/send",
      search: {
        to: parsed.to,
        amount: parsed.amount,
        asset: parsed.asset,
      },
    });
  }

  async function toggleTorch() {
    if (!scannerRef.current?.applyVideoConstraints) return;
    try {
      const next = !torchOn;
      await scannerRef.current.applyVideoConstraints({
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
      const { Html5Qrcode } = await import("html5-qrcode");
      const tmpId = "phantom-qr-file";
      let holder = document.getElementById(tmpId);
      if (!holder) {
        holder = document.createElement("div");
        holder.id = tmpId;
        holder.className = "hidden";
        document.body.appendChild(holder);
      }
      const reader = new Html5Qrcode(tmpId, { verbose: false });
      const decoded = await reader.scanFile(file, true);
      await reader.clear();
      if (handled.current) return;
      handled.current = true;
      await handleResult(decoded);
    } catch {
      toast.error("No QR code found in image");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      {/* Camera feed */}
      <div className="absolute inset-0">
        <div
          id={elId}
          className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />
        {starting && (
          <div className="absolute inset-0 grid place-items-center bg-black">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Dim overlay with clear viewfinder hole via box-shadow trick */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="flex-1 bg-black/55" />
        <div className="flex justify-center">
          <div className="relative h-[min(72vw,320px)] w-[min(72vw,320px)]">
            <div className="absolute inset-0 rounded-[28px] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
            {/* Phantom-style corner brackets */}
            <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-[3px] border-t-[3px] border-white" />
            <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-[3px] border-t-[3px] border-white" />
            <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-[3px] border-l-[3px] border-white" />
            <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-[3px] border-r-[3px] border-white" />
          </div>
        </div>
        <div className="flex-1 bg-black/55" />
      </div>

      {/* Top chrome */}
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

      {/* Bottom actions */}
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
