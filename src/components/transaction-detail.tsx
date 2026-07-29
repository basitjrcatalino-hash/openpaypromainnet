import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Coins,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Tables } from "@/integrations/supabase/types";
import type { ActivityItem } from "@/lib/activity";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber, formatUSD, shortAddress, timeAgo } from "@/lib/wallet-utils";
import { useCurrency } from "@/lib/currency";
import { resolveTokenLogoUrl } from "@/lib/token-logos";
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
import { TokenAvatar } from "@/components/wallet/TokenAvatar";

export type TxRow = Tables<"transactions"> | ActivityItem;

export function txIcon(type: string) {
  if (type === "receive" || type === "buy") return ArrowDownLeft;
  if (type === "swap") return ArrowLeftRight;
  if (type === "mint") return Coins;
  if (type === "sell") return ArrowUpRight;
  return ArrowUpRight;
}

function isIncoming(type: string) {
  return type === "receive" || type === "buy" || type === "reward";
}

function isOpenDexTx(tx: TxRow) {
  return (
    (tx.counterparty ?? "").toLowerCase() === "opendex" ||
    (tx.memo ?? "").toLowerCase().includes("opendex") ||
    tx.type === "swap"
  );
}

function isOpenTokenTx(tx: TxRow) {
  const item = tx as ActivityItem;
  return (
    item.source === "opentoken" ||
    (tx.counterparty ?? "").toLowerCase() === "opentoken" ||
    (tx.memo ?? "").toLowerCase().includes("opentoken")
  );
}

export function activityTitle(tx: TxRow) {
  const symbol = (tx.token_symbol ?? "").trim();
  const ot = isOpenTokenTx(tx);
  if (ot) {
    return `${tx.type === "sell" ? "Sold" : "Bought"} ${symbol || "token"}`;
  }
  if (tx.type === "swap" || isOpenDexTx(tx)) {
    return `Swapped ${symbol || "tokens"}`;
  }
  if (tx.type === "receive") return `Received ${symbol || "OUSD"}`;
  if (tx.type === "send") return `Sent ${symbol || "OUSD"}`;
  if (tx.type === "buy") return `Bought ${symbol || "OUSD"}`;
  if (tx.type === "sell") return `Sold ${symbol || "OUSD"}`;
  if (tx.type === "mint") return `Minted ${symbol || "NFT"}`;
  if (tx.type === "reward") return `Reward ${symbol || ""}`.trim();
  return `${tx.type} ${symbol}`.trim();
}

function activitySubtitle(tx: TxRow) {
  const item = tx as ActivityItem;
  const ot = isOpenTokenTx(tx);
  const odx = isOpenDexTx(tx);
  if (ot) return item.token_name ? `OpenToken · ${item.token_name}` : "OpenToken";
  if (odx) return "OpenDEX";
  if (tx.counterparty) return shortAddress(tx.counterparty);
  return timeAgo(tx.created_at);
}

function resolveLogo(tx: TxRow): string | null {
  const item = tx as ActivityItem;
  return resolveTokenLogoUrl(item.logo_url, tx.token_symbol);
}

/** Phantom-style activity row — compact title, soft amount colors, direction badge. */
export function TxRowButton({ tx, onOpen }: { tx: TxRow; onOpen: (tx: TxRow) => void }) {
  useCurrency();
  const Icon = txIcon(tx.type);
  const logo = resolveLogo(tx);
  const incoming = isIncoming(tx.type);
  const failed = tx.status === "failed";
  const pending = tx.status === "pending";
  const ot = isOpenTokenTx(tx);

  return (
    <button
      type="button"
      onClick={() => onOpen(tx)}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left press hover:bg-muted/50"
    >
      <span className="relative shrink-0">
        <TokenAvatar
          logoUrl={logo}
          name={(tx as ActivityItem).token_name}
          symbol={tx.token_symbol}
          size="md"
        />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 z-10 grid h-5 w-5 place-items-center rounded-full border-2 border-card",
            failed
              ? "bg-destructive text-destructive-foreground"
              : incoming
                ? "bg-emerald-500 text-white"
                : "bg-foreground text-background",
          )}
          aria-hidden
        >
          <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
        </span>
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-foreground">
          {activityTitle(tx)}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{activitySubtitle(tx)}</span>
          {(failed || pending) && (
            <>
              <span aria-hidden>·</span>
              <span
                className={cn(
                  "font-medium capitalize",
                  failed ? "text-destructive" : "text-amber-600 dark:text-amber-400",
                )}
              >
                {tx.status}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right tabular-nums">
        <div
          className={cn(
            "text-[15px] font-semibold",
            incoming && !failed ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
          )}
        >
          {incoming ? "+" : ot && tx.type === "sell" ? "−" : tx.type === "send" ? "−" : ""}
          {formatNumber(tx.amount, tx.amount >= 1_000_000 ? 2 : 4)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {formatUSD(tx.usd_value)}
        </div>
      </div>
    </button>
  );
}

/** Group label like Phantom: Today / Yesterday / Month Day */
export function activityDateGroupLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday.getTime() - startThat.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
  });
}

export function groupActivityByDate<T extends { created_at: string }>(
  items: T[],
): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  const index = new Map<string, number>();
  const now = new Date();
  for (const item of items) {
    const label = activityDateGroupLabel(item.created_at, now);
    const existing = index.get(label);
    if (existing == null) {
      index.set(label, groups.length);
      groups.push({ label, items: [item] });
    } else {
      groups[existing].items.push(item);
    }
  }
  return groups;
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
  const incoming = isIncoming(tx.type);
  const openLedgerHash = ledgerEntry?.tx_hash || tx.tx_hash;
  const logo = resolveLogo(tx);

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
        className="max-h-[88vh] overflow-y-auto rounded-t-3xl border-border/60 bg-background px-5 pb-8 pt-4 duration-200 data-[state=closed]:duration-150 data-[state=open]:duration-200"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
        <SheetHeader className="space-y-1 text-left">
          <div className="mb-2 flex items-center gap-3">
            <span className="relative shrink-0">
              <TokenAvatar
                logoUrl={logo}
                name={(tx as ActivityItem).token_name}
                symbol={tx.token_symbol}
                size="md"
                className="h-12 w-12"
              />
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 z-10 grid h-5 w-5 place-items-center rounded-full border-2 border-background",
                  incoming ? "bg-emerald-500 text-white" : "bg-foreground text-background",
                )}
              >
                <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
              </span>
            </span>
            <div>
              <SheetTitle>{activityTitle(tx)}</SheetTitle>
              <SheetDescription className="capitalize">{tx.status}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-2 rounded-2xl bg-card p-5 text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Amount</div>
          <div
            className={cn(
              "mt-1 text-3xl font-bold tabular-nums",
              incoming ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
            )}
          >
            {incoming ? "+" : "−"}
            {formatNumber(tx.amount, 6)} {tx.token_symbol ?? ""}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{formatUSD(tx.usd_value)}</div>
        </div>

        <dl className="mt-4 space-y-3 rounded-2xl bg-card/80 p-4 text-sm">
          <DetailRow label="Date" value={new Date(tx.created_at).toLocaleString()} />
          <DetailRow label="Status" value={tx.status} className="capitalize" />
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
  action?: ReactNode;
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
