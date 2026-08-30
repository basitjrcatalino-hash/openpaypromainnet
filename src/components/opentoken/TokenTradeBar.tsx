import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { useFooterVisible } from "@/hooks/chrome-visible";
import { formatOUSD, formatPct } from "@/lib/wallet-utils";

import { cn } from "@/lib/utils";

type TokenTradeBarProps = {
  price: number;
  change: number;
  onBuy: () => void;
};

/**
 * Mobile Buy CTA — portaled to body so layout/transform ancestors never break
 * position:fixed. Sits above the tabbar; slides with chrome visibility.
 */
export function TokenTradeBar({ price, change, onBuy }: TokenTradeBarProps) {
  const [mounted, setMounted] = useState(false);
  const footerVisible = useFooterVisible();
  const up = change >= 0;


  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "ph-trade-bar border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl lg:hidden",
        "transition-[transform,bottom] duration-300 ease-out",
        footerVisible ? "translate-y-0" : "translate-y-full",
      )}
      data-chrome={footerVisible ? "visible" : "hidden"}

    >
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold tabular-nums">
            {formatOUSD(price, { price: true })}
          </div>
          <div className={cn("text-xs font-semibold", up ? "text-success" : "text-destructive")}>
            {formatPct(change)}
          </div>
        </div>
        <Button
          type="button"
          className="h-11 min-w-28 rounded-full bg-primary px-8 font-bold text-primary-foreground"
          onClick={onBuy}
        >
          Buy
        </Button>
      </div>
    </div>,
    document.body,
  );
}

type TokenTradeSheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Full-screen trade sheet for mobile, portaled above tabbar/chrome. */
export function TokenTradeSheet({ open, onClose, children }: TokenTradeSheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-60 flex flex-col justify-end lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-background/70"
        aria-label="Close trade"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-card px-4 pb-[max(2rem,env(safe-area-inset-bottom,0px))] pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/40" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
