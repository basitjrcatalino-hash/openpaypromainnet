import type { ReactNode } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type TxConfirmRow = {
  label: string;
  value: ReactNode;
  mono?: boolean;
};

export type TxConfirmModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Token / asset avatar(s) above the amount */
  icon?: ReactNode;
  /** Primary amount line, e.g. "12.5 SOL" */
  amount?: ReactNode;
  /** Secondary line under amount, e.g. "$42.10" */
  subtitle?: ReactNode;
  rows: TxConfirmRow[];
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  /** Visual accent for the confirm CTA */
  variant?: "default" | "destructive" | "openpay" | "success";
  onConfirm: () => void | Promise<void>;
};

function ConfirmBody({
  title,
  description,
  icon,
  amount,
  subtitle,
  rows,
  confirmLabel,
  cancelLabel,
  busy,
  disabled,
  variant,
  onConfirm,
  onClose,
  showClose,
}: Omit<TxConfirmModalProps, "open" | "onOpenChange"> & {
  onClose: () => void;
  showClose?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="relative text-center">
        {showClose ? (
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="absolute -right-1 -top-1 grid h-9 w-9 place-items-center rounded-full text-muted-foreground press hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        ) : null}

        {icon ? <div className="mb-3 flex justify-center">{icon}</div> : null}

        <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}

        {amount != null ? (
          <div className="mt-4">
            <div className="text-[1.75rem] font-bold leading-tight tracking-tight tabular-nums text-foreground">
              {amount}
            </div>
            {subtitle != null ? (
              <div className="mt-1 text-sm font-medium text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl bg-muted/45">
          {rows.map((row, i) => (
            <div
              key={`${row.label}-${i}`}
              className={cn(
                "flex items-start justify-between gap-4 px-4 py-3.5 text-sm",
                i < rows.length - 1 && "border-b border-border/60",
              )}
            >
              <span className="shrink-0 text-muted-foreground">{row.label}</span>
              <span
                className={cn(
                  "max-w-[65%] text-right font-semibold text-foreground break-all",
                  row.mono && "font-mono text-xs font-medium",
                )}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
        <Button
          type="button"
          disabled={busy || disabled}
          onClick={() => void onConfirm()}
          className={cn(
            "h-14 w-full rounded-full text-base font-bold text-primary-foreground",
            variant === "destructive" && "bg-red-500 hover:bg-red-500/90",
            variant === "openpay" && "bg-[#0070BA] hover:opacity-90",
            variant === "success" && "bg-emerald-500 text-black hover:bg-emerald-400",
            (!variant || variant === "default") && "bg-primary",
          )}
        >
          {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          {confirmLabel ?? "Confirm"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={onClose}
          className="h-11 w-full rounded-full text-sm font-semibold text-muted-foreground"
        >
          {cancelLabel ?? "Cancel"}
        </Button>
      </div>
    </div>
  );
}

/** Phantom-style transaction confirmation — bottom sheet on mobile, dialog on desktop. */
export function TxConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  icon,
  amount,
  subtitle,
  rows,
  confirmLabel,
  cancelLabel,
  busy,
  disabled,
  variant = "default",
  onConfirm,
}: TxConfirmModalProps) {
  const isMobile = useIsMobile();

  const body = (
    <ConfirmBody
      title={title}
      description={description}
      icon={icon}
      amount={amount}
      subtitle={subtitle}
      rows={rows}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      busy={busy}
      disabled={disabled}
      variant={variant}
      onConfirm={onConfirm}
      onClose={() => onOpenChange(false)}
      showClose={!isMobile}
    />
  );

  if (isMobile) {
    return (
      <Sheet
        open={open}
        onOpenChange={(v) => {
          if (busy && !v) return;
          onOpenChange(v);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] overflow-y-auto rounded-t-[1.75rem] border-border/50 bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 [&>button.absolute]:hidden"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/35" />
          <SheetHeader className="sr-only">
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy && !v) return;
        onOpenChange(v);
      }}
    >
      <DialogContent
        hideClose
        className="max-w-sm gap-0 overflow-hidden rounded-[1.75rem] border-border/50 bg-card p-5 sm:rounded-[1.75rem]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

/** Overlapping dual token icons for swap-style confirms. */
export function TxConfirmTokenPair({
  from,
  to,
}: {
  from: ReactNode;
  to: ReactNode;
}) {
  return (
    <div className="relative mx-auto flex h-14 w-19 items-center justify-center">
      <div className="absolute left-0 top-0 grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-muted ring-4 ring-card">
        {from}
      </div>
      <div className="absolute right-0 top-0 z-10 grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-muted ring-4 ring-card">
        {to}
      </div>
    </div>
  );
}
