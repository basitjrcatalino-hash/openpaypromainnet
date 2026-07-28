import {
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Sparkles,
  ShoppingCart,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Tables } from "@/integrations/supabase/types";
import type { ActivityItem } from "@/lib/activity";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber, formatUSD, shortAddress } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { OpenLedgerLink, OPENLEDGER_BASE } from "@/components/openledger-link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type TxRow = Tables<"transactions"> | ActivityItem;

export function txIcon(type: string) {
  if (type === "receive" || type === "buy") return ArrowDownLeft;
  if (type === "swap") return RefreshCw;
  if (type === "mint") return Sparkles;
  if (type === "sell") return ShoppingCart;
  return ArrowUpRight;
}

function activityTitle(tx: TxRow) {
  const item = tx as ActivityItem;
  if (item.source === "opentoken") {
    return `${tx.type === "sell" ? "Sell" : "Buy"} ${tx.token_symbol ?? ""}`;
  }
  if (tx.type === "swap") {
    return `Swap ${tx.token_symbol ?? ""}`;
  }
  return `${tx.type} ${tx.token_symbol ?? ""}`;
}

export function TxRowButton({ tx, onOpen }: { tx: TxRow; onOpen: (tx: TxRow) => void }) {
  const Icon = txIcon(tx.type);
  const item = tx as ActivityItem;
  const logo = item.logo_url;
  const isOpenToken = item.source === "opentoken";
  const isOpenDex =
    (tx.counterparty ?? "").toLowerCase() === "opendex" ||
    (tx.memo ?? "").toLowerCase().includes("opendex");

  return (
    <button
      type="button"
      onClick={() => onOpen(tx)}
      className="flex w-full items-center gap-3 py-3.5 text-left text-sm press hover:bg-muted/40"
    >
      {logo ? (
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={logo} alt={tx.token_symbol ?? ""} />
          <AvatarFallback className="bg-primary/15 text-primary">
            <Icon className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold capitalize">{activityTitle(tx)}</span>
          {isOpenToken && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
              OpenToken
            </span>
          )}
          {isOpenDex && (
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-600 dark:text-violet-300">
              OpenDEX
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {tx.status}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {isOpenToken
            ? `${item.token_name ?? "Bonding curve"} · `
            : isOpenDex
              ? `${tx.memo?.replace(/^OpenDEX swap\s+/i, "") ?? "Spot swap"} · `
              : tx.counterparty
                ? `${shortAddress(tx.counterparty)} · `
                : ""}
          {new Date(tx.created_at).toLocaleString()}
        </div>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <div className="font-semibold">
          {isOpenToken && tx.type === "buy" ? "+" : isOpenToken && tx.type === "sell" ? "−" : ""}
          {formatNumber(tx.amount, 6)}
        </div>
        <div className="text-xs text-muted-foreground">
          {isOpenToken || isOpenDex
            ? `${formatNumber(tx.usd_value, 4)} OUSD`
            : formatUSD(tx.usd_value)}
        </div>
      </div>
    </button>
  );
}

export function TransactionDetailSheet({
  tx,
  open,
  onOpenChange,
}: {
  tx: TxRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const { data: ledgerEntry, isFetched: ledgerFetched } = useQuery({
    queryKey: ["ledger-entry-by-tx", tx?.id],
    enabled: open && !!tx?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_entries")
        .select("id, sequence, tx_hash, tx_id")
        .eq("tx_id", tx!.id)
        .maybeSingle();
      return data;
    },
  });

  if (!tx) return null;

  const Icon = txIcon(tx.type);
  const isIn = tx.type === "receive" || tx.type === "buy";
  const openLedgerHash = ledgerEntry?.tx_hash || tx.tx_hash;

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success("Copied");
      setTimeout(() => setCopied(null), 1200);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto rounded-t-3xl border-border/60 px-5 pb-8 pt-4 duration-200 data-[state=closed]:duration-150 data-[state=open]:duration-200"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
        <SheetHeader className="space-y-1 text-left">
          <div className="mb-2 flex items-center gap-3">
            <span
              className={cn(
                "grid h-12 w-12 place-items-center rounded-full",
                isIn ? "bg-success/15 text-success" : "bg-primary/15 text-primary",
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <SheetTitle className="capitalize">
                {tx.type} {tx.token_symbol ?? ""}
              </SheetTitle>
              <SheetDescription className="capitalize">{tx.status}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-2 rounded-2xl border border-border/60 bg-card p-5 text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Amount</div>
          <div className="mt-1 text-3xl font-bold tabular-nums">
            {isIn ? "+" : "−"}
            {formatNumber(tx.amount, 6)} {tx.token_symbol ?? ""}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{formatUSD(tx.usd_value)}</div>
        </div>

        <dl className="mt-4 space-y-3 rounded-2xl border border-border/60 bg-card/60 p-4 text-sm">
          <DetailRow label="Date" value={new Date(tx.created_at).toLocaleString()} />
          <DetailRow label="Status" value={tx.status} />
          <DetailRow label="Type" value={tx.type} className="capitalize" />
          {tx.token_symbol && <DetailRow label="Asset" value={tx.token_symbol} />}
          {tx.counterparty && (
            <DetailRow
              label="Counterparty"
              value={shortAddress(tx.counterparty, 10, 8)}
              action={
                <button
                  type="button"
                  onClick={() => copy("counterparty", tx.counterparty!)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Copy counterparty"
                >
                  {copied === "counterparty" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              }
            />
          )}
          {tx.tx_hash && (
            <DetailRow
              label="Tx hash"
              value={shortAddress(tx.tx_hash, 10, 8)}
              action={
                <button
                  type="button"
                  onClick={() => copy("hash", tx.tx_hash!)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Copy hash"
                >
                  {copied === "hash" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              }
            />
          )}
          {ledgerEntry?.sequence != null && (
            <DetailRow label="Ledger #" value={`#${ledgerEntry.sequence}`} />
          )}
          {tx.memo && <DetailRow label="Note" value={tx.memo} />}
          <DetailRow
            label="ID"
            value={shortAddress(tx.id, 8, 6)}
            action={
              <button
                type="button"
                onClick={() => copy("id", tx.id)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Copy id"
              >
                {copied === "id" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            }
          />
        </dl>

        <div className="mt-4 space-y-2">
          <OpenLedgerLink
            hash={openLedgerHash}
            proEntryId={ledgerEntry?.id}
            proSequence={ledgerEntry?.sequence}
          />
          {ledgerFetched && !ledgerEntry && (
            <Button variant="outline" className="w-full rounded-xl" asChild>
              <a href={`${OPENLEDGER_BASE}/pro`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" /> Browse OpenLedger Pro
              </a>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({
  label,
  value,
  action,
  className,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("flex min-w-0 items-center gap-1 text-right font-medium", className)}>
        <span className="truncate">{value}</span>
        {action}
      </dd>
    </div>
  );
}
