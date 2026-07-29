import { useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatUSD, shortAddress } from "@/lib/wallet-utils";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { WalletAvatar } from "@/components/wallet/WalletAvatar";

export type ManageWallet = {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
  ousd_balance?: number | null;
  pi_balance?: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: ManageWallet[];
  recoveryFlags?: Record<string, boolean>;
  switching?: boolean;
  onSelect: (walletId: string) => void | Promise<void>;
  onAdd: () => void;
  onRename: (wallet: ManageWallet) => void;
  onCopy: (wallet: ManageWallet) => void;
  onRemove: (wallet: ManageWallet) => void;
};

/**
 * Phantom-style wallet picker drawer for Settings → Manage wallets.
 * Tap a row to switch; open ··· for rename / copy / remove.
 */
export function ManageWalletsSheet({
  open,
  onOpenChange,
  wallets: walletsProp,
  recoveryFlags = {},
  switching = false,
  onSelect,
  onAdd,
  onRename,
  onCopy,
  onRemove,
}: Props) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [actionsWallet, setActionsWallet] = useState<ManageWallet | null>(null);
  const wallets = Array.isArray(walletsProp) ? walletsProp : [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return wallets;
    return wallets.filter(
      (w) =>
        (w.name ?? "").toLowerCase().includes(q) ||
        (w.address ?? "").toLowerCase().includes(q),
    );
  }, [wallets, query]);

  const active = wallets.find((w) => w.is_active) ?? wallets[0];

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
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      )}

      {active ? (
        <div className="mb-3 rounded-2xl bg-muted/45 px-4 py-3">
          <p className="ph-label">Active wallet</p>
          <div className="mt-2 flex items-center gap-3">
            <WalletAvatar address={active.address} name={active.name} size="md" active />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{active.name}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {shortAddress(active.address, 6, 4)}
              </p>
            </div>
            <p className="text-base font-extrabold tabular-nums tracking-tight">
              {formatUSD(Number(active.ousd_balance ?? 0))}
            </p>
          </div>
        </div>
      ) : null}

      <div className="ph-group max-h-[min(52vh,22rem)] overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {wallets.length === 0 ? "No wallets yet" : "No wallets match your search"}
          </p>
        ) : (
          <ul>
            {filtered.map((wallet) => {
              const ousd = Number(wallet.ousd_balance ?? 0);
              const pi = Number(wallet.pi_balance ?? 0);
              const needsBackup = !recoveryFlags[wallet.id];
              const isActive = wallet.is_active;
              return (
                <li
                  key={wallet.id}
                  className="flex items-stretch border-b border-border/40 last:border-0"
                >
                  <button
                    type="button"
                    disabled={switching}
                    onClick={() => {
                      void onSelect(wallet.id);
                      if (!isActive) onOpenChange(false);
                    }}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left press",
                      isActive ? "bg-primary/12" : "hover:bg-muted/50",
                      switching && "opacity-70",
                    )}
                  >
                    <WalletAvatar
                      address={wallet.address}
                      name={wallet.name}
                      size="md"
                      active={isActive}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{wallet.name}</span>
                        {isActive ? (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                            Active
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {shortAddress(wallet.address, 6, 4)}
                      </span>
                      <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
                        {formatUSD(ousd)}
                        {pi > 0 ? ` · ${pi.toLocaleString()} π` : ""}
                        {needsBackup ? " · needs backup" : ""}
                      </span>
                    </span>
                    {isActive ? (
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="h-6 w-6 shrink-0" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    className="grid w-11 shrink-0 place-items-center text-muted-foreground hover:bg-muted/50 hover:text-foreground press"
                    aria-label={`Manage ${wallet.name}`}
                    onClick={() => setActionsWallet(wallet)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          onOpenChange(false);
          onAdd();
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary/15 py-3.5 text-sm font-bold text-primary hover:bg-primary/20 press"
      >
        <Plus className="h-4 w-4" />
        Add / Import wallet
      </button>
    </div>
  );

  const shell = isMobile ? (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) setActionsWallet(null);
        onOpenChange(v);
      }}
    >
      <SheetContent
        side="bottom"
        className="rounded-t-[1.75rem] border-border/60 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <SheetHeader className="mb-4 space-y-1 text-left">
          <SheetTitle className="text-lg">Your wallets</SheetTitle>
          <SheetDescription>Tap to switch · ··· to manage</SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setActionsWallet(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md gap-0 rounded-3xl border-border/60 bg-card p-5">
        <DialogHeader className="mb-4 space-y-1 text-left">
          <DialogTitle className="text-lg">Your wallets</DialogTitle>
          <DialogDescription>Tap to switch · ··· to manage</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {shell}
      <WalletActionsSheet
        wallet={actionsWallet}
        needsBackup={actionsWallet ? !recoveryFlags[actionsWallet.id] : false}
        onOpenChange={(v) => {
          if (!v) setActionsWallet(null);
        }}
        onRename={() => {
          if (!actionsWallet) return;
          const w = actionsWallet;
          setActionsWallet(null);
          onRename(w);
        }}
        onCopy={() => {
          if (!actionsWallet) return;
          onCopy(actionsWallet);
        }}
        onSelect={() => {
          if (!actionsWallet) return;
          const id = actionsWallet.id;
          setActionsWallet(null);
          void onSelect(id);
          onOpenChange(false);
        }}
        onRemove={() => {
          if (!actionsWallet) return;
          const w = actionsWallet;
          setActionsWallet(null);
          onRemove(w);
        }}
      />
    </>
  );
}

function WalletActionsSheet({
  wallet,
  needsBackup,
  onOpenChange,
  onRename,
  onCopy,
  onSelect,
  onRemove,
}: {
  wallet: ManageWallet | null;
  needsBackup: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onCopy: () => void;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const isMobile = useIsMobile();
  const open = !!wallet;

  const content = wallet ? (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-muted/45 px-3 py-3">
        <WalletAvatar
          address={wallet.address}
          name={wallet.name}
          size="md"
          active={wallet.is_active}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{wallet.name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {shortAddress(wallet.address, 8, 6)}
          </p>
          {needsBackup ? (
            <p className="mt-0.5 text-[11px] font-medium text-amber-500">Needs backup</p>
          ) : null}
        </div>
        <p className="text-sm font-bold tabular-nums">
          {formatUSD(Number(wallet.ousd_balance ?? 0))}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-muted/35">
        {!wallet.is_active ? (
          <ActionRow
            icon={<Check className="h-4 w-4" />}
            label="Set as active"
            onClick={onSelect}
          />
        ) : null}
        <ActionRow icon={<Pencil className="h-4 w-4" />} label="Rename" onClick={onRename} />
        <ActionRow icon={<Copy className="h-4 w-4" />} label="Copy address" onClick={onCopy} />
        <ActionRow
          icon={<Trash2 className="h-4 w-4" />}
          label="Remove wallet"
          danger
          onClick={onRemove}
        />
      </div>
    </div>
  ) : null;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-[1.75rem] border-border/60 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
          <SheetHeader className="mb-4 space-y-1 text-left">
            <SheetTitle>Wallet options</SheetTitle>
            <SheetDescription>Manage this OpenPay Pro ledger</SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 rounded-3xl border-border/60 bg-card p-5">
        <DialogHeader className="mb-4 space-y-1 text-left">
          <DialogTitle>Wallet options</DialogTitle>
          <DialogDescription>Manage this OpenPay Pro ledger</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border/40 px-4 py-3.5 text-left text-sm font-semibold last:border-0 press hover:bg-muted/50",
        danger ? "text-destructive" : "text-foreground",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full",
          danger ? "bg-destructive/15 text-destructive" : "bg-background text-foreground",
        )}
      >
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
