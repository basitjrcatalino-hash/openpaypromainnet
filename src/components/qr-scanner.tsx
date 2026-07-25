import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Html5QrcodeLike = {
  isScanning?: boolean;
  start: (
    camera: MediaTrackConstraints | string,
    config: Record<string, unknown>,
    onSuccess: (decoded: string) => void,
    onFailure?: (err: string) => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear?: () => Promise<void>;
  scanFile: (file: File, showImage?: boolean) => Promise<string>;
  getRunningTrackCameraCapabilities?: () => { torch?: unknown };
  applyVideoConstraints?: (c: MediaTrackConstraints) => Promise<void>;
};

/** Same camera config used by Send — proven to decode Receive QR codes. */
export const QR_SCAN_CONFIG = {
  fps: 10,
  qrbox: { width: 240, height: 240 },
} as const;

export async function stopQrInstance(instance: Html5QrcodeLike | null | undefined) {
  if (!instance) return;
  try {
    if (instance.isScanning) await instance.stop();
    await instance.clear?.();
  } catch {
    // ignore stop/clear races
  }
}

type UseQrCameraArgs = {
  elementId: string;
  active: boolean;
  onResult: (text: string) => void;
  onError?: (message: string) => void;
  onReady?: (instance: Html5QrcodeLike) => void;
};

/** Shared Html5Qrcode lifecycle — identical start options for Send dialog and /scan. */
export function useQrCamera({ elementId, active, onResult, onError, onReady }: UseQrCameraArgs) {
  const scannerRef = useRef<Html5QrcodeLike | null>(null);
  const handledRef = useRef(false);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  onResultRef.current = onResult;
  onErrorRef.current = onError;
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    handledRef.current = false;

    (async () => {
      // Wait until the target div is mounted and has layout (Dialog portal + /scan).
      let el: HTMLElement | null = null;
      for (let i = 0; i < 30; i++) {
        el = document.getElementById(elementId);
        if (el && el.offsetParent !== null) break;
        // offsetParent is null for fixed/hidden; also accept non-zero size
        if (el && (el.clientWidth > 0 || el.clientHeight > 0)) break;
        if (el && i > 2) break; // element exists in DOM (e.g. fixed full-screen)
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;
      }
      if (cancelled) return;

      el = document.getElementById(elementId);
      if (!el) {
        onErrorRef.current?.("Scanner element missing");
        return;
      }
      el.innerHTML = "";

      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const instance = new Html5Qrcode(elementId, {
          verbose: false,
        }) as unknown as Html5QrcodeLike;
        scannerRef.current = instance;

        await instance.start(
          { facingMode: "environment" },
          { ...QR_SCAN_CONFIG },
          (decoded: string) => {
            if (cancelled || handledRef.current) return;
            handledRef.current = true;
            const text = decoded.trim();
            if (!text) return;
            onResultRef.current(text);
          },
          () => {},
        );

        if (cancelled) {
          await stopQrInstance(instance);
          return;
        }
        onReadyRef.current?.(instance);
      } catch (e) {
        if (!cancelled) {
          onErrorRef.current?.((e as Error).message || "Camera permission denied");
        }
      }
    })();

    return () => {
      cancelled = true;
      const inst = scannerRef.current;
      scannerRef.current = null;
      void stopQrInstance(inst);
    };
  }, [active, elementId]);

  return scannerRef;
}

export async function scanQrFromFile(file: File): Promise<string> {
  const { Html5Qrcode } = await import("html5-qrcode");
  const tmpId = "openpay-qr-file-reader";
  let holder = document.getElementById(tmpId);
  if (!holder) {
    holder = document.createElement("div");
    holder.id = tmpId;
    holder.className = "hidden";
    document.body.appendChild(holder);
  }
  holder.innerHTML = "";
  const reader = new Html5Qrcode(tmpId, { verbose: false }) as unknown as Html5QrcodeLike;
  try {
    const decoded = await reader.scanFile(file, true);
    return decoded.trim();
  } finally {
    await stopQrInstance(reader);
  }
}

type Props = {
  onResult: (text: string) => void;
  trigger?: React.ReactNode;
};

export function QrScannerButton({ onResult, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const elId = "qr-reader-region";

  useQrCamera({
    elementId: elId,
    active: open,
    onResult: (text) => {
      onResult(text);
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)} className="inline-flex">
        {trigger ?? (
          <Button type="button" variant="outline" size="sm" className="rounded-xl">
            <Camera className="mr-1.5 h-3.5 w-3.5" /> Scan
          </Button>
        )}
      </div>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> Scan QR code
          </DialogTitle>
        </DialogHeader>
        <div id={elId} className="overflow-hidden rounded-2xl border border-border bg-black" />
        <p className="text-center text-xs text-muted-foreground">
          Point your camera at a wallet QR code
        </p>
        <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
          <X className="mr-1.5 h-4 w-4" /> Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
