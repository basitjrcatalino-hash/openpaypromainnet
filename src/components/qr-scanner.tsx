import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Camera, ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { scanQrFromFile, usePhantomQrScanner } from "@/lib/qr-camera";
import { parsePaymentQr } from "@/lib/parse-payment-qr";
import { cn } from "@/lib/utils";

type Props = {
  onResult: (text: string) => void;
  trigger?: ReactNode;
  /** Hint under the viewfinder */
  hint?: string;
};

/**
 * Send-flow QR scanner — same native BarcodeDetector + html5 fallback as /scan.
 * Parses before closing so invalid codes keep the dialog open.
 */
export function QrScannerButton({
  onResult,
  trigger,
  hint = "Scan OpenPay Pro receive QR — any Pro token or OpenToken",
}: Props) {
  const reactId = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackElId = `qr-send-fallback-${reactId}`;
  const fileRefId = `qr-file-${reactId}`;
  const handled = useRef(false);
  const unlockRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!open) {
      handled.current = false;
    }
  }, [open]);

  const scanner = usePhantomQrScanner({
    videoRef,
    fallbackElId,
    active: open,
    onResult: (text) => {
      if (handled.current) return;
      const parsed = parsePaymentQr(text);
      if (!parsed.to) {
        toast.error("Invalid QR — no address or account found");
        unlockRef.current();
        return;
      }
      handled.current = true;
      onResult(text);
      setOpen(false);
    },
  });
  unlockRef.current = scanner.unlock;

  async function onPickImage(file: File) {
    try {
      const decoded = await scanQrFromFile(file);
      const parsed = parsePaymentQr(decoded);
      if (!parsed.to) {
        toast.error("Invalid QR — no address or account found");
        return;
      }
      onResult(decoded);
      setOpen(false);
    } catch {
      toast.error("No QR code found in image");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          handled.current = false;
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handled.current = false;
            setOpen(true);
          }
        }}
        className="inline-flex"
      >
        {trigger ?? (
          <Button type="button" variant="outline" size="sm" className="rounded-xl">
            <Camera className="mr-1.5 h-3.5 w-3.5" /> Scan
          </Button>
        )}
      </div>
      <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0 [&>button]:hidden">
        <div className="space-y-3 p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-4 w-4" /> Scan QR code
            </DialogTitle>
          </DialogHeader>

          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
            {open ? (
              <>
                <video
                  ref={videoRef}
                  className={cn(
                    "absolute inset-0 z-0 h-full w-full object-cover",
                    scanner.mode !== "native" && "invisible",
                    scanner.starting && "opacity-0",
                  )}
                  playsInline
                  muted
                  autoPlay
                />
                <div
                  id={fallbackElId}
                  className={cn(
                    "absolute inset-0 z-0 h-full w-full overflow-hidden bg-black [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:max-w-none [&_video]:object-cover",
                    scanner.mode !== "fallback" && "invisible pointer-events-none",
                  )}
                  aria-hidden
                />
              </>
            ) : null}
            {scanner.starting && !scanner.error && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-black/70">
                <Loader2 className="h-7 w-7 animate-spin text-white" />
              </div>
            )}
            {scanner.error && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 px-4 text-center">
                <p className="text-sm text-red-300">{scanner.error}</p>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    handled.current = false;
                    scanner.restart();
                  }}
                >
                  Try again
                </Button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground">{hint}</p>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 rounded-full"
              onClick={() => document.getElementById(fileRefId)?.click()}
            >
              <ImageIcon className="mr-1.5 h-4 w-4" />
              Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-full"
              onClick={() => setOpen(false)}
            >
              <X className="mr-1.5 h-4 w-4" /> Close
            </Button>
          </div>
        </div>

        <input
          id={fileRefId}
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
      </DialogContent>
    </Dialog>
  );
}
