import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AssetMark } from "@/components/deposit/DepositAssetPicker";
import { cn } from "@/lib/utils";

export function DepositReminderSheet({
  open,
  onOpenChange,
  symbol,
  networkName,
  logoUrl,
  minDeposit,
  estArrival,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  networkName: string;
  logoUrl?: string | null;
  minDeposit: string;
  estArrival: string;
  onContinue: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] overflow-y-auto rounded-t-[1.75rem] border-border/50 bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 [&>button.absolute]:hidden"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/35" />
        <SheetHeader className="text-center">
          <SheetTitle className="text-lg font-bold">Deposit reminder</SheetTitle>
          <SheetDescription className="sr-only">
            Confirm network before depositing {symbol}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Check and ensure you only deposit{" "}
              <span className="font-bold">{symbol}</span> via the{" "}
              <span className="font-bold">{networkName}</span> network from the withdrawal
              platform to avoid losing your funds.
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-2.5">
              <AssetMark symbol={symbol} logoUrl={logoUrl} className="h-8 w-8" />
              <span className="text-base font-bold">{symbol}</span>
            </div>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Minimum deposit</span>
                <span className="font-semibold tabular-nums">{minDeposit}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Est arrival in</span>
                <span className="font-semibold">{estArrival}</span>
              </div>
            </div>
          </div>

          <SlideToContinue onComplete={onContinue} />

          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full rounded-full text-sm font-semibold text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SlideToContinue({ onComplete }: { onComplete: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const doneRef = useRef(false);
  const knob = 44;

  const maxX = () => Math.max(0, (trackRef.current?.clientWidth ?? 0) - knob - 8);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const next = Math.min(maxX(), Math.max(0, e.clientX - rect.left - knob / 2));
      setX(next);
      if (next >= maxX() * 0.92 && !doneRef.current) {
        doneRef.current = true;
        setDragging(false);
        setX(maxX());
        onComplete();
      }
    };
    const onUp = () => {
      setDragging(false);
      if (!doneRef.current) setX(0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, onComplete]);

  return (
    <div
      ref={trackRef}
      className="relative h-14 w-full overflow-hidden rounded-full bg-muted/70"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-muted-foreground">
        Slide to continue
      </div>
      <button
        type="button"
        aria-label="Slide to continue"
        className={cn(
          "absolute left-1 top-1 z-10 grid h-11 w-11 place-items-center rounded-full bg-background text-foreground shadow-md",
          dragging && "cursor-grabbing",
        )}
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={(e) => {
          e.preventDefault();
          doneRef.current = false;
          setDragging(true);
        }}
      >
        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
