import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Search, Settings2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatCurrency, type CurrencyCode } from "@/lib/currency";
import { fetchWalletPortfolioTotals } from "@/lib/wallet-portfolio";
import { shortAddress } from "@/lib/wallet-utils";
import { useIsDesktopViewport } from "@/hooks/use-mobile";
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
import { Skeleton } from "@/components/ui/skeleton";
import { WalletAvatar } from "@/components/wallet/WalletAvatar";

export type SwitcherWallet = {
  id: string;
  name: string;
  address: string;
  ousd_balance?: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: SwitcherWallet[];
  activeWalletId?: string;
  onSelect: (walletId: string) => void | Promise<void>;
  switching?: boolean;
  currency: CurrencyCode;
  hideBalance?: boolean;
  onNavigateAway?: () => void;
};

export function WalletSwitcherDialog({
  open,
  onOpenChange,
  wallets,
  activeWalletId,
  onSelect,
  switching = false,
  currency,
  hideBalance = false,
  onNavigateAway,
}: Props) {
  const isDesktop = useIsDesktopViewport();
  const [query, setQuery] = useState("");

  const walletIds = useMemo(() => wallets.map((w) => w.id), [wallets]);

  const { data: totals = {}, isPending: totalsLoading } = useQuery({
    queryKey: ["wallet-portfolio-totals", walletIds.join(",")],
    enabled: open && wallets.length > 0,
    staleTime: 30_000,
    queryFn: () => fetchWalletPortfolioTotals(supabase, wallets),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return wallets;
    return wallets.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.address.toLowerCase().includes(q),
    );
  }, [wallets, query]);

  const activeWallet = wallets.find((w) => w.id === activeWalletId);
  const activeTotal = activeWalletId ? totals[activeWalletId] : undefined;

  const body = (
    <div className="flex min-h-0 flex-col">
      {wallets.length > 4 && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search wallets"
            className="h-10 w-full rounded-xl border-0 bg-muted/60 pl-9 pr-9 text-sm outline-none ring-1 ring-border/50 placeholder:text-muted-foreground focus:ring-primary/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {activeWallet && (
        <div className="mb-3 rounded-2xl bg-muted/40 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Active wallet
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold">{activeWallet.name}</p>
          <p className="text-lg font-bold tabular-nums tracking-tight">
            {hideBalance ? "••••••" : formatCurrency(activeTotal ?? Number(activeWallet.ousd_balance ?? 0), currency)}
          </p>
        </div>
      )}

      <div className="ph-group max-h-[min(52vh,22rem)] overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No wallets match your search
          </p>
        ) : (
          <ul>
            {filtered.map((wallet) => (
              <li key={wallet.id}>
                <WalletAccountRow
                  wallet={wallet}
                  active={wallet.id === activeWalletId}
                  balance={
                    totalsLoading && totals[wallet.id] == null
                      ? null
                      : (totals[wallet.id] ?? Number(wallet.ousd_balance ?? 0))
                  }
                  currency={currency}
                  hideBalance={hideBalance}
                  disabled={switching}
                  onClick={() => onSelect(wallet.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          to="/settings"
          onClick={() => {
            onOpenChange(false);
            onNavigateAway?.();
          }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-muted/50 py-3 text-sm font-semibold text-foreground hover:bg-muted press"
        >
          <Settings2 className="h-4 w-4" />
          Manage
        </Link>
        <Link
          to="/settings"
          onClick={() => {
            onOpenChange(false);
            onNavigateAway?.();
          }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary/15 py-3 text-sm font-semibold text-primary hover:bg-primary/20 press"
        >
          <Plus className="h-4 w-4" />
          Add wallet
        </Link>
      </div>
    </div>
  );

  if (!isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-[1.75rem] border-border/60 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
          <SheetHeader className="mb-4 space-y-1 text-left">
            <SheetTitle className="text-lg">Your wallets</SheetTitle>
            <SheetDescription>Switch between accounts</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(100%-2rem,28rem)] max-w-md gap-0 rounded-[1.75rem] border-border/40 bg-card p-5 shadow-2xl">
        <DialogHeader className="mb-4 space-y-1 text-left">
          <DialogTitle className="text-lg">Your wallets</DialogTitle>
          <DialogDescription>Switch between accounts</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

type RowProps = {
  wallet: SwitcherWallet;
  active?: boolean;
  balance: number | null;
  currency: CurrencyCode;
  hideBalance?: boolean;
  disabled?: boolean;
  onClick: () => void;
  compact?: boolean;
};

export function WalletAccountRow({
  wallet,
  active = false,
  balance,
  currency,
  hideBalance = false,
  disabled = false,
  onClick,
  compact = false,
}: RowProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full min-w-0 items-center gap-2.5 text-left press",
        compact ? "px-2.5 py-2.5" : "gap-3 px-3.5 py-3",
        active ? "bg-primary/12" : "hover:bg-muted/50",
        disabled && "opacity-70",
      )}
    >
      <WalletAvatar
        address={wallet.address}
        name={wallet.name}
        size={compact ? "sm" : "md"}
        active={active}
      />
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold leading-tight">
            {wallet.name}
          </span>
          {active && !compact ? (
            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Active
            </span>
          ) : null}
        </span>
        {compact ? (
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
            {active ? (
              <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary">
                Active
              </span>
            ) : null}
            {balance == null ? (
              <Skeleton className="h-3.5 w-14 rounded-md" />
            ) : (
              <span className="truncate text-xs font-semibold tabular-nums text-muted-foreground">
                {hideBalance ? "••••" : formatCurrency(balance, currency)}
              </span>
            )}
          </span>
        ) : (
          <span className="block truncate font-mono text-[11px] text-muted-foreground">
            {shortAddress(wallet.address, 6, 4)}
          </span>
        )}
      </span>
      {!compact ? (
        <span className="flex shrink-0 items-center gap-2">
          {balance == null ? (
            <Skeleton className="h-4 w-16 rounded-md" />
          ) : (
            <span className="text-sm font-semibold tabular-nums">
              {hideBalance ? "••••" : formatCurrency(balance, currency)}
            </span>
          )}
          {active ? (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          ) : (
            <span className="h-6 w-6" aria-hidden />
          )}
        </span>
      ) : active ? (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : (
        <span className="h-5 w-5 shrink-0" aria-hidden />
      )}
    </button>
  );
}
