import { useState, type ReactNode } from "react";
import { Camera, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQrCamera } from "@/lib/qr-camera";

type Props = {
  onResult: (text: string) => void;
  trigger?: ReactNode;
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
        <div
          id={elId}
          className="relative min-h-60 overflow-hidden rounded-2xl border border-border bg-black [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:max-w-none [&_video]:object-cover"
        />
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
