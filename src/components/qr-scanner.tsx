import { useEffect, useId, useState, type ReactNode } from "react";
import { Camera, ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { scanQrFromFile, useQrCamera } from "@/lib/qr-camera";

type Props = {
  onResult: (text: string) => void;
  trigger?: ReactNode;
  /** Hint under the viewfinder */
  hint?: string;
};

export function QrScannerButton({
  onResult,
  trigger,
  hint = "Scan OpenPay Pro wallet, OpenPay OP account, or pay link",
}: Props) {
  const reactId = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const [camKey, setCamKey] = useState(0);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const elId = `qr-reader-${reactId}-${camKey}`;
  const fileRefId = `qr-file-${reactId}`;

  useEffect(() => {
    if (!open) return;
    setStarting(true);
    setError(null);
  }, [open, camKey]);

  useQrCamera({
    elementId: elId,
    active: open,
    onResult: (text) => {
      onResult(text);
      setOpen(false);
    },
    onError: (message) => {
      setError(message);
      setStarting(false);
    },
    onReady: () => {
      setError(null);
      setStarting(false);
    },
  });

  async function onPickImage(file: File) {
    try {
      const decoded = await scanQrFromFile(file);
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
          setCamKey((k) => k + 1);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCamKey((k) => k + 1);
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
      <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0">
        <div className="space-y-3 p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-4 w-4" /> Scan QR code
            </DialogTitle>
          </DialogHeader>

          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
            {/* Keep node mounted while open so camera can attach after dialog layout */}
            {open ? (
              <div
                id={elId}
                className="absolute inset-0 h-full w-full [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:max-w-none [&_video]:object-cover"
              />
            ) : null}
            {starting && !error && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-black/70">
                <Loader2 className="h-7 w-7 animate-spin text-white" />
              </div>
            )}
            {error && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 px-4 text-center">
                <p className="text-sm text-red-300">{error}</p>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setCamKey((k) => k + 1)}
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
