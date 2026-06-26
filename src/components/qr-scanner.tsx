import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  onResult: (text: string) => void;
  trigger?: React.ReactNode;
};

export function QrScannerButton({ onResult, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const scannerRef = useRef<any>(null);
  const elId = "qr-reader-region";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let instance: any = null;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      instance = new Html5Qrcode(elId, { verbose: false });
      scannerRef.current = instance;
      try {
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => {
            onResult(decoded);
            stop();
            setOpen(false);
          },
          () => {},
        );
      } catch (e) {
        console.error("Camera error", e);
      }
    })();

    async function stop() {
      try {
        if (scannerRef.current?.isScanning) await scannerRef.current.stop();
        await scannerRef.current?.clear?.();
      } catch {}
      scannerRef.current = null;
    }

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, onResult]);

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
          <DialogTitle className="flex items-center gap-2"><Camera className="h-4 w-4" /> Scan QR code</DialogTitle>
        </DialogHeader>
        <div id={elId} className="overflow-hidden rounded-2xl border border-border bg-black" />
        <p className="text-center text-xs text-muted-foreground">Point your camera at a wallet QR code</p>
        <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
          <X className="mr-1.5 h-4 w-4" /> Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
