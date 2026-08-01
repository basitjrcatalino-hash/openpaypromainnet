import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { BadgeCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { fmtAmount } from "@/lib/p2p";
import { cn } from "@/lib/utils";

const CONFETTI_COLORS = [
  "#11C66D",
  "#F5C518",
  "#3B82F6",
  "#F04438",
  "#A855F7",
  "#F97316",
  "#EC4899",
];

type Props = {
  open: boolean;
  onClose: () => void;
  isBuyer: boolean;
  asset: string;
  amount: number | string;
  totalFiat: number;
  fiatCode: string;
  counterparty: string;
};

export function P2pTradeCompleteOverlay({
  open,
  onClose,
  isBuyer,
  asset,
  amount,
  totalFiat,
  fiatCode,
  counterparty,
}: Props) {
  const [entered, setEntered] = useState(false);
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        left: `${(i * 17 + 7) % 100}%`,
        delay: `${(i % 12) * 0.08}s`,
        duration: `${2.2 + (i % 5) * 0.25}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: `${(i * 37) % 360}deg`,
        size: 6 + (i % 5) * 2,
        shape: i % 3 === 0 ? "circle" : "rect",
      })),
    [],
  );

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, [open]);

  if (!open) return null;

  const verb = isBuyer ? "bought" : "sold";
  const fiatVerb = isBuyer ? "Paid" : "Received";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="p2p-trade-complete-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {pieces.map((p) => (
          <span
            key={p.id}
            className="p2p-confetti absolute top-[-12%] opacity-0"
            style={
              {
                left: p.left,
                width: p.size,
                height: p.shape === "circle" ? p.size : p.size * 1.4,
                background: p.color,
                borderRadius: p.shape === "circle" ? "999px" : "2px",
                "--p2p-rot": p.rotate,
                animationDelay: p.delay,
                animationDuration: p.duration,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div
        className={cn(
          "relative z-10 mx-4 mb-[max(1rem,env(safe-area-inset-bottom))] w-full max-w-sm overflow-hidden rounded-2xl border border-border/60 bg-background p-6 shadow-2xl transition-all duration-500 sm:mb-0",
          entered ? "translate-y-0 scale-100 opacity-100" : "translate-y-8 scale-95 opacity-0",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted/50"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div
            className={cn(
              "relative grid h-20 w-20 place-items-center rounded-full bg-[#11C66D]/15 transition-transform duration-700",
              entered ? "scale-100" : "scale-50",
            )}
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-[#11C66D]/20 [animation-duration:1.6s]" />
            <BadgeCheck
              className={cn(
                "relative h-12 w-12 text-[#11C66D] transition-all duration-700",
                entered ? "scale-100 opacity-100" : "scale-50 opacity-0",
              )}
              strokeWidth={1.75}
            />
          </div>

          <p
            id="p2p-trade-complete-title"
            className="mt-4 text-lg font-extrabold tracking-tight text-[#11C66D]"
          >
            Trade verified
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Escrow released · order complete
          </p>

          <div className="mt-5 w-full rounded-[12px] border border-border/50 bg-muted/25 px-4 py-4 text-left">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              You {verb}
            </p>
            <p className="mt-1 text-[26px] font-extrabold leading-none tabular-nums tracking-tight">
              {fmtAmount(amount)}{" "}
              <span className="text-base font-bold text-muted-foreground">{asset}</span>
            </p>
            <p className="mt-3 text-[13px] font-semibold tabular-nums">
              {fiatVerb}{" "}
              <span className="text-foreground">
                {formatCurrency(Number(totalFiat), fiatCode as never, { compact: false })}
              </span>
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {isBuyer ? "From" : "To"} {counterparty}
            </p>
          </div>

          <Button
            className="mt-5 h-11 w-full rounded-[8px] bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]"
            onClick={onClose}
          >
            Continue · rate trader
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes p2p-confetti-fall {
          0% { transform: translate3d(0,-10%,0) rotate(0deg); opacity: 0; }
          8% { opacity: 1; }
          100% { transform: translate3d(12px,110vh,0) rotate(var(--p2p-rot, 360deg)); opacity: 0; }
        }
        .p2p-confetti {
          animation-name: p2p-confetti-fall;
          animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
