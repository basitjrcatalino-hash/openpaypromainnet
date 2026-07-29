/**
 * Crypto wallet dashboard — Phantom-style overview for Circle Programmable Wallets.
 * Route: /wallet
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  History,
  Loader2,
  QrCode,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { cn } from "@/lib/utils";
import { formatNumber, shortAddress, timeAgo } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Crypto Wallet — OpenPay Pro" }] }),
  component: CryptoWalletPage,
});

function CryptoWalletPage() {
  const { wallet, balance, transactions, loading, error, configured, refreshWallet } =
    useWallet();

  async function copyAddress() {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      toast.success("Address copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  const totalHint = balance[0]
    ? `${balance[0].amount} ${balance[0].symbol}`
    : "0.00";

  return (
    <div className="ot-phantom mx-auto w-full max-w-lg animate-page-in pb-10 md:max-w-xl">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Crypto Wallet</h1>
            <p className="ph-caption">
              {wallet ? wallet.blockchain : "Circle · multi-chain ready"}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => void refreshWallet()}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </header>

      {loading && !wallet ? (
        <div className="grid place-items-center py-24 text-sm text-muted-foreground">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
          Provisioning wallet…
        </div>
      ) : error && !wallet ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          {!configured && (
            <p className="mt-2 text-xs text-muted-foreground">
              Set <code className="text-foreground">CIRCLE_API_KEY</code>,{" "}
              <code className="text-foreground">CIRCLE_ENTITY_SECRET</code>, and{" "}
              <code className="text-foreground">CIRCLE_WALLET_SET_ID</code> on the server.
            </p>
          )}
          <Button className="mt-4 rounded-full" onClick={() => void refreshWallet()}>
            Retry
          </Button>
        </div>
      ) : wallet ? (
        <>
          {/* Balance hero */}
          <section className="mb-6 rounded-3xl border border-border bg-card p-6 text-center">
            <p className="ph-label">Balance</p>
            <p className="ph-display mt-2">{totalHint}</p>
            <button
              type="button"
              onClick={() => void copyAddress()}
              className="ph-caption mt-3 inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1.5 font-semibold hover:bg-muted hover:text-foreground"
            >
              {shortAddress(wallet.address, 6, 6)}
              <Copy className="h-3.5 w-3.5" />
            </button>
            <p className="ph-label mt-3 opacity-80">
              {wallet.blockchain} · {wallet.provider}
            </p>
          </section>

          {/* Action cards */}
          <div className="mb-8 grid grid-cols-4 gap-2">
            <ActionCard
              to="/wallet/receive"
              icon={QrCode}
              label="Receive"
              primary
            />
            <ActionCard to="/send" icon={ArrowUpRight} label="Send" />
            <ActionCard to="/activity" icon={History} label="History" />
            <ActionCard to="/tokens" icon={ArrowDownLeft} label="Assets" />
          </div>

          {/* Supported tokens / balances */}
          <section className="mb-8">
            <h2 className="ph-label mb-3">Assets</h2>
            <ul className="overflow-hidden rounded-2xl border border-border bg-card">
              {balance.length === 0 ? (
                <li className="px-4 py-8 text-center">
                  <p className="ph-callout">No tokens yet</p>
                  <p className="ph-caption mt-1">Buy some tokens to get started</p>
                </li>
              ) : (
                balance.map((b, i) => (
                  <li
                    key={`${b.symbol}-${i}`}
                    className={cn(
                      "flex items-center justify-between px-4 py-3",
                      i > 0 && "border-t border-border",
                    )}
                  >
                    <div>
                      <div className="ph-row-title">{b.symbol}</div>
                      <div className="ph-row-sub">{b.token}</div>
                    </div>
                    <div className="ph-amount text-[15px]">{b.amount}</div>
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* History */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="ph-label">Activity</h2>
              <Link to="/wallet/receive" className="text-xs font-bold text-primary">
                Receive
              </Link>
            </div>
            <ul className="overflow-hidden rounded-2xl border border-border bg-card">
              {transactions.length === 0 ? (
                <li className="px-4 py-8 text-center">
                  <p className="ph-callout">No transactions yet</p>
                </li>
              ) : (
                transactions.map((tx, i) => (
                  <li
                    key={tx.id}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-3",
                      i > 0 && "border-t border-border",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "ph-row-title capitalize",
                            tx.direction === "deposit"
                              ? "text-emerald-500"
                              : "text-amber-500",
                          )}
                        >
                          {tx.direction}
                        </span>
                        <span className="ph-row-sub truncate">{tx.token}</span>
                      </div>
                      <div className="ph-row-sub">
                        {timeAgo(tx.created_at)} · {tx.status}
                        {tx.tx_hash ? ` · ${shortAddress(tx.tx_hash, 4, 4)}` : ""}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "shrink-0 text-[15px] font-bold tabular-nums tracking-tight",
                        tx.direction === "deposit" ? "text-emerald-500" : "text-foreground",
                      )}
                    >
                      {tx.direction === "deposit" ? "+" : "-"}
                      {formatNumber(tx.amount, 4)}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

function ActionCard({
  to,
  icon: Icon,
  label,
  primary,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card px-2 py-3 text-center press transition hover:bg-muted/40"
    >
      <span
        className={cn(
          "grid h-11 w-11 place-items-center rounded-2xl",
          primary ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="ph-caption font-semibold text-foreground">{label}</span>
    </Link>
  );
}
