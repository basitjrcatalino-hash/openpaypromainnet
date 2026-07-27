import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Plus,
  ArrowLeftRight,
  TrendingUp,
  DollarSign,
  ChevronsUpDown,
  Sparkles,
  QrCode,
  Eye,
  EyeOff,
  ScanLine,
  Copy,
  Check,
  CheckCircle2,
  Blocks,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatNumber, formatPct, generateAddress, shortAddress } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TransactionDetailSheet, TxRowButton, type TxRow } from "@/components/transaction-detail";
import { OusdIcon } from "@/components/ousd-icon";
import { OpenNftCollectiblesPanel } from "@/components/open-nft-collectibles";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Wallet — OpenPay Pro" }] }),
  component: Dashboard,
});

type HoldingRow = {
  balance: number;
  tokens: {
    id: string;
    name: string;
    symbol: string;
    price_usd: number | null;
    change_24h: number | null;
    logo_url: string | null;
  } | null;
};

type WalletRow = Tables<"wallets">;

const ACTIONS = [
  { label: "Fund", icon: Plus, to: "/topup" },
  { label: "Send", icon: Send, to: "/send" },
  { label: "Receive", icon: QrCode, to: "/receive" },
  { label: "Swap", icon: ArrowLeftRight, to: "/swap" },
  { label: "OpenToken", icon: Sparkles, to: "/opentoken" },
  { label: "Earn", icon: TrendingUp, to: "/ousd" },
  { label: "Sell", icon: DollarSign, to: "/swap" },
  {
    label: "Blockchain",
    icon: Blocks,
    href: "https://www.openpyledger.space/pro",
  },
] as const;

function Dashboard() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets", user.id],
    queryFn: async (): Promise<WalletRow[]> => {
      const { data } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: holdings = [] } = useQuery({
    queryKey: ["holdings", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async (): Promise<HoldingRow[]> => {
      const { data } = await supabase
        .from("token_holdings")
        .select("balance, tokens:token_id(id, name, symbol, price_usd, change_24h, logo_url)")
        .eq("wallet_id", wallet!.id);
      return (data ?? []) as HoldingRow[];
    },
  });

  const { data: recentTxs = [] } = useQuery({
    queryKey: ["recent-txs", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async (): Promise<TxRow[]> =>
      (
        await supabase
          .from("transactions")
          .select("*")
          .eq("wallet_id", wallet!.id)
          .order("created_at", { ascending: false })
          .limit(8)
      ).data ?? [],
  });

  useEffect(() => {
    if (walletLoading || wallet) return;
    (async () => {
      const { data, error } = await supabase
        .from("wallets")
        .insert({
          user_id: user.id,
          name: "Main Wallet",
          address: generateAddress(),
          is_active: true,
          ousd_balance: 0,
          pi_balance: 0,
        })
        .select()
        .single();
      if (!error && data) {
        qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
        qc.invalidateQueries({ queryKey: ["wallets", user.id] });
        toast.success("Your wallet is ready");
      }
    })();
  }, [wallet, walletLoading, user.id, qc]);

  const [hideBalance, setHideBalance] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TxRow | null>(null);
  const { code: currency, cycle: cycleCurrency } = useCurrency();
  const [copied, setCopied] = useState(false);

  const ousdBalance = Number(wallet?.ousd_balance ?? 0);
  const holdingsUsd = holdings.reduce(
    (sum, h) => sum + Number(h.balance ?? 0) * Number(h.tokens?.price_usd ?? 0),
    0,
  );
  const totalUsd = holdingsUsd + ousdBalance;
  const hasAssets = holdings.length > 0 || ousdBalance > 0;

  async function copyAddress() {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function switchWallet(id: string) {
    if (id === wallet?.id) {
      setSwitchOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await supabase.from("wallets").update({ is_active: false }).eq("user_id", user.id);
      await supabase.from("wallets").update({ is_active: true }).eq("id", id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["wallets", user.id] }),
        qc.invalidateQueries({ queryKey: ["active-wallet", user.id] }),
        qc.invalidateQueries({ queryKey: ["holdings"] }),
        qc.invalidateQueries({ queryKey: ["recent-txs"] }),
        qc.invalidateQueries({ queryKey: ["my-nfts"] }),
        qc.invalidateQueries({ queryKey: ["openpay-collectibles"] }),
      ]);
      toast.success("Wallet switched");
      setSwitchOpen(false);
    } catch (err) {
      toast.error((err as Error).message || "Could not switch wallet");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between md:hidden">
        <button
          type="button"
          onClick={() => navigate({ to: "/scan" })}
          className="rounded-lg p-1.5 text-primary hover:bg-sidebar-accent"
          aria-label="Scan QR code"
        >
          <ScanLine className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setSwitchOpen(true)}
          className="inline-flex items-center gap-1 text-base font-semibold"
        >
          {wallet?.name ?? "Main Wallet"}{" "}
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={cycleCurrency}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-sidebar-accent"
            aria-label="Change currency"
          >
            {currency}
          </button>
          <button
            type="button"
            onClick={() => setHideBalance((v) => !v)}
            className="rounded-lg p-1.5 text-primary hover:bg-sidebar-accent"
            aria-label="Toggle balance"
          >
            {hideBalance ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Big gradient balance card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 text-white shadow-glow md:hidden">
        <div className="absolute inset-0 opacity-40" aria-hidden>
          <div className="absolute -left-16 -top-10 h-56 w-56 rounded-full bg-mint blur-3xl" />
          <div className="absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-primary-glow blur-3xl" />
        </div>
        <div className="relative flex min-h-45 flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={cycleCurrency}
            className="flex items-center gap-2 text-5xl font-bold tracking-tight text-white tabular-nums"
          >
            {hideBalance ? "••••" : formatCurrency(totalUsd, currency)}
            <ChevronsUpDown className="h-5 w-5 text-white/70" />
          </button>
          <button
            type="button"
            onClick={copyAddress}
            className="mt-4 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] transition-colors hover:bg-white/20"
            aria-label="Copy address"
          >
            <span className="grid h-4 w-4 place-items-center rounded-full bg-white/20">◆</span>
            <span className="opacity-90">{shortAddress(wallet?.address ?? null, 6, 6)}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5 opacity-80" />
            )}
          </button>
        </div>
      </div>

      {/* Actions bar */}
      <div className="grid grid-cols-4 gap-2 md:grid-cols-4 lg:grid-cols-8 md:gap-3">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          const className =
            "group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card px-2 py-3 text-xs font-semibold transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow md:px-3 md:py-4";
          const inner = (
            <>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-accent text-primary transition-colors group-hover:bg-gradient-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <span>{a.label}</span>
            </>
          );
          if ("href" in a && a.href) {
            return (
              <a key={a.label} href={a.href} target="_blank" rel="noreferrer" className={className}>
                {inner}
              </a>
            );
          }
          if ("to" in a && a.to) {
            return (
              <Link key={a.label} to={a.to} className={className}>
                {inner}
              </Link>
            );
          }
          return null;
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <header className="mb-3 flex items-center justify-between">
            <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold">
              Assets <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </header>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            {!hasAssets ? (
              <EmptyRow />
            ) : (
              <ul className="divide-y divide-border/60">
                {ousdBalance > 0 && (
                  <li>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/ousd" })}
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-center gap-3">
                        <OusdIcon />
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            OpenPay OUSD
                            <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                              Earn
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {formatCurrency(1, currency)} · Stablecoin
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">
                          {formatNumber(ousdBalance, 2)} OUSD
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(ousdBalance, currency)}
                        </div>
                      </div>
                    </button>
                  </li>
                )}
                {holdings.map((h) => {
                  const usd = Number(h.balance) * Number(h.tokens?.price_usd ?? 0);
                  const pct = Number(h.tokens?.change_24h ?? 0);
                  const tokenId = h.tokens?.id;
                  return (
                    <li key={h.tokens?.id}>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            tokenId
                              ? { to: "/opentoken/$tokenId", params: { tokenId } }
                              : { to: "/opentoken" },
                          )
                        }
                        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
                            {(h.tokens?.symbol ?? "?").slice(0, 3)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              {h.tokens?.name}
                              <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                                APY 3.9%
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {formatCurrency(Number(h.tokens?.price_usd ?? 0), currency)} ·{" "}
                              <span className={cn(pct >= 0 ? "text-success" : "text-destructive")}>
                                ↑ {formatPct(pct)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold tabular-nums">
                            {formatNumber(h.balance, 4)} {h.tokens?.symbol}
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {formatCurrency(usd, currency)}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              to="/opentoken"
              className="flex items-center justify-center gap-2 border-t border-border/60 py-3 text-sm font-semibold text-primary hover:bg-sidebar-accent/40"
            >
              <span className="grid h-4 w-4 place-items-center rounded-sm border border-current">
                ▦
              </span>
              Show All Assets{" "}
              <span className="text-muted-foreground">
                {holdings.length + (ousdBalance > 0 ? 1 : 0)}
              </span>
            </Link>
          </div>
        </section>

        <section>
          <header className="mb-3 flex items-center justify-between">
            <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold">
              Collectibles <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <Link to="/nfts" className="text-xs font-semibold text-primary hover:underline">
              See all
            </Link>
          </header>

          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <OpenNftCollectiblesPanel userId={user.id} limit={6} compact />
          </div>

          <Link
            to="/opentoken"
            className="mt-4 flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition hover:border-primary/40 hover:shadow-glow"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">OpenToken</div>
              <div className="text-xs text-muted-foreground">
                Launch & trade fair community coins
              </div>
            </div>
            <span className="text-xs font-semibold text-primary">Open</span>
          </Link>
        </section>
      </div>

      <section>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent activity</h2>
          <Link to="/activity" className="text-xs font-semibold text-primary hover:underline">
            See all
          </Link>
        </header>
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          {recentTxs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No activity yet — fund, send, or receive to see history here.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 px-4">
              {recentTxs.map((t) => (
                <li key={t.id}>
                  <TxRowButton tx={t} onOpen={setSelectedTx} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <TransactionDetailSheet
        tx={selectedTx}
        open={!!selectedTx}
        onOpenChange={(o) => {
          if (!o) setSelectedTx(null);
        }}
      />

      {!hasAssets && recentTxs.length === 0 && (
        <section className="rounded-3xl border border-border/60 bg-card px-6 py-16">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
            <div className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="h-10 w-10" />
            </div>
            <div className="text-lg font-bold">You have just created a new wallet</div>
            <p className="text-sm text-muted-foreground">
              Send, receive, and trade tokens and collectibles.
            </p>
          </div>
        </section>
      )}

      {/* Wallet switcher */}
      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Switch wallet</DialogTitle>
            <DialogDescription>Choose which wallet to use</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1">
            {wallets.map((w) => {
              const active = w.id === wallet?.id;
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    disabled={switching}
                    onClick={() => switchWallet(w.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                      active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-primary text-sm font-bold text-primary-foreground">
                        {(w.name?.[0] ?? "W").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{w.name}</span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {shortAddress(w.address, 6, 4)}
                      </span>
                    </span>
                    <span className="text-right text-sm font-semibold tabular-nums">
                      {formatCurrency(Number(w.ousd_balance ?? 0), currency)}
                    </span>
                    {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            to="/settings"
            onClick={() => setSwitchOpen(false)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-semibold text-primary hover:bg-sidebar-accent/40"
          >
            <Plus className="h-4 w-4" /> Add wallet
          </Link>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-sidebar-accent text-xs font-bold text-muted-foreground">
          —
        </div>
        <div>
          <div className="text-sm font-semibold text-muted-foreground">No assets yet</div>
          <div className="text-xs text-muted-foreground">Fund your wallet to get started</div>
        </div>
      </div>
    </div>
  );
}
