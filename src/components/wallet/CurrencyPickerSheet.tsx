import { useMemo, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CURRENCIES,
  currencyListLabel,
  type CurrencyCode,
  type CurrencyMeta,
} from "@/lib/currency";
import { useIsMobile } from "@/hooks/use-mobile";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: CurrencyCode;
  onSelect: (code: CurrencyCode) => void;
};

function CurrencyList({
  value,
  query,
  onSelect,
}: {
  value: CurrencyCode;
  query: string;
  onSelect: (code: CurrencyCode) => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter((c) => {
      const hay = `${c.code} ${c.name} ${c.symbol}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  if (filtered.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">No currencies found</p>
    );
  }

  return (
    <ul className="divide-y divide-white/6 overflow-hidden rounded-2xl bg-[#121212]">
      {filtered.map((c) => (
        <CurrencyRow
          key={c.code}
          currency={c}
          selected={c.code === value}
          onSelect={() => onSelect(c.code)}
        />
      ))}
    </ul>
  );
}

function CurrencyRow({
  currency,
  selected,
  onSelect,
}: {
  currency: CurrencyMeta;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left press"
      >
        <span className="min-w-0 truncate text-[15px] font-medium text-foreground">
          {currencyListLabel(currency)}
        </span>
        <span
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
            selected
              ? "border-primary bg-primary"
              : "border-muted-foreground/40 bg-transparent",
          )}
          aria-hidden
        >
          {selected ? <span className="h-2 w-2 rounded-full bg-primary-foreground" /> : null}
        </span>
      </button>
    </li>
  );
}

function PickerBody({
  value,
  onSelect,
  onBack,
}: {
  value: CurrencyCode;
  onSelect: (code: CurrencyCode) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-foreground press"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <h2 className="text-lg font-bold tracking-tight text-foreground">Currency</h2>
      </div>

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="h-11 rounded-full border-0 bg-muted pl-10 text-[15px] placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/40"
          autoFocus={false}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
        <CurrencyList
          value={value}
          query={query}
          onSelect={(code) => {
            onSelect(code);
          }}
        />
      </div>
    </div>
  );
}

/**
 * Phantom-style currency picker — full-height bottom sheet on mobile, dialog on desktop.
 */
export function CurrencyPickerSheet({ open, onOpenChange, value, onSelect }: Props) {
  const isMobile = useIsMobile();

  const handleSelect = (code: CurrencyCode) => {
    onSelect(code);
    onOpenChange(false);
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[92dvh] max-h-[92dvh] flex-col gap-0 rounded-t-[1.75rem] border-border/40 bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 [&>button.absolute]:hidden"
        >
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/35" />
          <SheetHeader className="sr-only">
            <SheetTitle>Currency</SheetTitle>
            <SheetDescription>Choose a display currency</SheetDescription>
          </SheetHeader>
          <PickerBody
            value={value}
            onSelect={handleSelect}
            onBack={() => onOpenChange(false)}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-0 overflow-hidden rounded-3xl border-border/60 bg-background p-5 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Currency</DialogTitle>
          <DialogDescription>Choose a display currency</DialogDescription>
        </DialogHeader>
        <PickerBody
          value={value}
          onSelect={handleSelect}
          onBack={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
