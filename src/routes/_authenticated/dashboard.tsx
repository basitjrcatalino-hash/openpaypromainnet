import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  CheckCircle2,
  Blocks,
  Ellipsis,
  Shield,
  X,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TransactionDetailSheet, TxRowButton, type TxRow } from "@/components/transaction-detail";
import { OusdIcon } from "@/components/ousd-icon";
import { OpenNftCollectiblesPanel } from "@/components/open-nft-collectibles";
import { fetchWalletActivity } from "@/lib/activity";
import { ActionCircle } from "@/components/wallet/ActionCircle";
import { ExploreDock } from "@/components/wallet/ExploreDock";
import { SegmentedTabs } from "@/components/wallet/SegmentedTabs";
import { WalletBalanceHero } from "@/components/wallet/WalletBalanceHero";
import { Skeleton } from "@/components/ui/skeleton";

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

const PRIMARY_ACTIONS = [
  { label: "Receive", icon: QrCode, to: "/receive" },
  { label: "Send", icon: Send, to: "/send" },
  { label: "Swap", icon: ArrowLeftRight, to: "/swap" },
  { label: "Buy", icon: Plus, to: "/topup" },
] as const;

const MORE_ACTIONS = [
  { label: "OpenToken", icon: Sparkles, to: "/opentoken" },
  { label: "Earn", icon: TrendingUp, to: "/ousd" },
  { label: "Sell", icon: DollarSign, to: "/swap" },
  { label: "Blockchain", icon: Blocks, href: "https://www.openpyledger.space/pro" },
] as const;

function Dashboard() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [tab, setTab] = useState<"tokens" | "collectibles">("tokens");
  const [searchOpen, setSearchOpen] = useState(false);
  const [tokenQuery, setTokenQuery] = useState("");
  const [onboardDismissed, setOnboardDismissed] = useState(() => {
    try {
      return localStorage.getItem("openpay-onboard-dismissed") === "1";
    } catch {
      return false;
    }
  });

  const { data: prefs } = useQuery({
    queryKey: ["prefs", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("user_preferences")
          .select("recovery_backed_up")
          .eq("user_id", user.id)
          .maybeSingle()
      ).data,
  });
  const needsBackup = prefs !== undefined && !prefs?.recovery_backed_up;

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

  const {
    data: holdings,
    isPending: holdingsPending,
  } = useQuery({
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

  const { data: recentTxs = [], isLoading: recentLoading, isPending: recentPending } = useQuery({
    queryKey: ["recent-txs", wallet?.id],
    enabled: !!wallet?.id,
    staleTime: 10_000,
    refetchOnMount: "always",
    queryFn: () => fetchWalletActivity(supabase, wallet!.id, 12),
  });

  /** First paint — skeletons instead of empty “No tokens” flash. */
  const showTokenSkeletons = walletLoading || (!!wallet?.id && holdingsPending);
  const showActivitySkeletons = walletLoading || (!!wallet?.id && (recentLoading || recentPending));
  const holdingsList = holdings ?? [];

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
  const holdingsUsd = holdingsList.reduce(
    (sum, h) => sum + Number(h.balance ?? 0) * Number(h.tokens?.price_usd ?? 0),
    0,
  );
  const totalUsd = holdingsUsd + ousdBalance;
  const hasAssets = holdingsList.length > 0 || ousdBalance > 0;
  const assetCount = holdingsList.length + (ousdBalance > 0 ? 1 : 0);

  const filteredHoldings = useMemo(() => {
    const qq = tokenQuery.trim().toLowerCase();
    if (!qq) return holdingsList;
    return holdingsList.filter((h) => {
      const name = h.tokens?.name?.toLowerCase() ?? "";
      const symbol = h.tokens?.symbol?.toLowerCase() ?? "";
      return name.includes(qq) || symbol.includes(qq);
    });
  }, [holdingsList, tokenQuery]);

  const showOusdRow =
    ousdBalance > 0 &&
    (!tokenQuery.trim() ||
      (() => {
        const qq = tokenQuery.trim().toLowerCase();
        return (
          "openusd ousd".includes(qq) ||
          "openpay ousd".includes(qq) ||
          "ousd".includes(qq) ||
          qq.includes("ousd") ||
          qq.includes("openusd")
        );
      })());

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
    <div className="mx-auto max-w-lg animate-page-in md:max-w-2xl">
      {/* Mobile header */}
      <div className="mb-1 flex items-center justify-between md:hidden">
        <button
          type="button"
          onClick={() => navigate({ to: "/scan" })}
          className="rounded-full p-2 text-primary hover:bg-primary/10 press"
          aria-label="Scan QR code"
        >
          <ScanLine className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setSwitchOpen(true)}
          className="inline-flex items-center gap-1 text-[15px] font-semibold press"
        >
          {walletLoading && !wallet ? (
            <Skeleton className="h-5 w-28 rounded-full" />
          ) : (
            <>
              {wallet?.name ?? "Main Wallet"}
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            </>
          )}
        </button>
        <div className="flex items-center">
          <button
            type="button"
            onClick={cycleCurrency}
            className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 press"
            aria-label="Change currency"
          >
            {currency}
          </button>
          <button
            type="button"
            onClick={() => setHideBalance((v) => !v)}
            className="rounded-full p-2 text-primary hover:bg-primary/10 press"
            aria-label="Toggle balance"
          >
            {hideBalance ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Flat balance hero */}
      {walletLoading && !wallet ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <Skeleton className="h-12 w-44 rounded-xl" />
          <Skeleton className="h-4 w-28 rounded-full" />
        </div>
      ) : (
        <WalletBalanceHero
          balanceLabel={formatCurrency(totalUsd, currency)}
          addressLabel={shortAddress(wallet?.address ?? null, 6, 6)}
          hideBalance={hideBalance}
          copied={copied}
          onCycleCurrency={cycleCurrency}
          onCopyAddress={copyAddress}
        />
      )}

      {/* Circular actions */}
      <div className="mb-6 flex items-start justify-center gap-5 sm:gap-6">
        {PRIMARY_ACTIONS.map((a) => (
          <ActionCircle key={a.label} label={a.label} icon={a.icon} to={a.to} />
        ))}
        <ActionCircle label="More" icon={Ellipsis} onClick={() => setMoreOpen(true)} />
      </div>

      {needsBackup && (
        <Link
          to="/settings"
          className="mb-4 flex items-center gap-3 rounded-2xl bg-warning/15 px-4 py-3 press"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning/25 text-warning">
            <Shield className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-semibold">Back up your recovery phrase</span>
            <span className="block text-xs text-muted-foreground">
              Protect your wallet — confirm backup in Settings
            </span>
          </span>
        </Link>
      )}

      {!showTokenSkeletons && !hasAssets && !onboardDismissed && (
        <div className="mb-4 rounded-2xl bg-card px-4 py-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold">Get started</div>
              <p className="text-xs text-muted-foreground">Fund your wallet in a few taps</p>
            </div>
            <button
              type="button"
              className="rounded-full p-1 text-muted-foreground hover:bg-muted press"
              aria-label="Dismiss"
              onClick={() => {
                setOnboardDismissed(true);
                try {
                  localStorage.setItem("openpay-onboard-dismissed", "1");
                } catch {
                  /* ignore */
                }
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ol className="space-y-2 text-sm">
            <li className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
              <span className="text-muted-foreground">1. Buy or receive OUSD</span>
              <span className="flex gap-1.5">
                <Link
                  to="/topup"
                  search={{
                    openpay_charge: undefined,
                    openpay_ref: undefined,
                    openpay_tx: undefined,
                    openpay_return: undefined,
                    openpay_cancel: undefined,
                  }}
                  className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                >
                  Buy
                </Link>
                <Link
                  to="/receive"
                  className="rounded-full bg-muted px-3 py-1 text-xs font-semibold"
                >
                  Receive
                </Link>
              </span>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
              <span className="text-muted-foreground">2. Explore tokens</span>
              <Link
                to="/opentoken"
                className="rounded-full bg-muted px-3 py-1 text-xs font-semibold"
              >
                OpenToken
              </Link>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
              <span className="text-muted-foreground">3. Secure your wallet</span>
              <Link
                to="/settings"
                className="rounded-full bg-muted px-3 py-1 text-xs font-semibold"
              >
                Backup
              </Link>
            </li>
          </ol>
        </div>
      )}

      {/* Tokens | Collectibles */}
      <SegmentedTabs
        tabs={[
          { id: "tokens", label: "Tokens" },
          { id: "collectibles", label: "Collectibles" },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-4"
      />

      {tab === "tokens" ? (
        <section>
          {showTokenSkeletons ? (
            <ul className="animate-in fade-in duration-300" aria-busy="true" aria-label="Loading tokens">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i}>
                  <TokenRowSkeleton delayMs={i * 60} />
                </li>
              ))}
            </ul>
          ) : !hasAssets ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center animate-in fade-in duration-300">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
                <Plus className="h-6 w-6" />
              </div>
              <div className="text-sm font-semibold">No tokens yet</div>
              <p className="max-w-xs text-xs text-muted-foreground">
                Buy OUSD or share your address to receive funds.
              </p>
              <div className="mt-1 flex gap-2">
                <Link
                  to="/topup"
                  search={{
                    openpay_charge: undefined,
                    openpay_ref: undefined,
                    openpay_tx: undefined,
                    openpay_return: undefined,
                    openpay_cancel: undefined,
                  }}
                  className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground press"
                >
                  Buy
                </Link>
                <Link
                  to="/receive"
                  className="rounded-full bg-muted px-5 py-2.5 text-sm font-semibold press"
                >
                  Receive
                </Link>
              </div>
            </div>
          ) : !showOusdRow && filteredHoldings.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No matching tokens</p>
          ) : (
            <ul className="animate-in fade-in duration-300">
              {showOusdRow && (
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      navigate({ to: "/asset/$tokenId", params: { tokenId: "ousd" } })
                    }
                    className="ph-row press"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <OusdIcon className="h-11 w-11 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[15px] font-semibold">
                          OpenUSD OUSD
                          <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                            Earn
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(1, currency)} ·{" "}
                          <span className="text-success">0.00%</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[15px] font-semibold tabular-nums">
                        {hideBalance ? "••••" : formatNumber(ousdBalance, 2)}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {hideBalance ? "••••" : formatCurrency(ousdBalance, currency)}
                        {!hideBalance && totalUsd > 0 && (
                          <span className="ml-1 text-muted-foreground/80">
                            · {((ousdBalance / totalUsd) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )}
              {filteredHoldings.map((h) => {
                const usd = Number(h.balance) * Number(h.tokens?.price_usd ?? 0);
                const pct = Number(h.tokens?.change_24h ?? 0);
                const share = totalUsd > 0 ? (usd / totalUsd) * 100 : 0;
                const tokenId = h.tokens?.id;
                return (
                  <li key={h.tokens?.id}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          tokenId
                            ? { to: "/asset/$tokenId", params: { tokenId } }
                            : { to: "/opentoken" },
                        )
                      }
                      className="ph-row press"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-11 w-11 shrink-0">
                          {h.tokens?.logo_url ? (
                            <AvatarImage src={h.tokens.logo_url} alt={h.tokens.name} />
                          ) : null}
                          <AvatarFallback className="bg-primary/20 text-[10px] font-bold text-primary">
                            {(h.tokens?.symbol ?? "?").slice(0, 3)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-semibold">{h.tokens?.name}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {formatCurrency(Number(h.tokens?.price_usd ?? 0), currency)} ·{" "}
                            <span className={cn(pct >= 0 ? "text-success" : "text-destructive")}>
                              {formatPct(pct)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[15px] font-semibold tabular-nums">
                          {hideBalance
                            ? "••••"
                            : `${formatNumber(h.balance, 4)} ${h.tokens?.symbol ?? ""}`}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {hideBalance ? "••••" : formatCurrency(usd, currency)}
                          {!hideBalance && (
                            <span className="ml-1 text-muted-foreground/80">
                              · {share.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            to="/tokens"
            className="mt-2 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary press"
          >
            Manage token list
            <span className="text-muted-foreground">
              {showTokenSkeletons ? (
                <Skeleton className="inline-block h-4 w-5 translate-y-0.5 rounded" />
              ) : (
                assetCount
              )}
            </span>
          </Link>
        </section>
      ) : (
        <section className="py-2">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Your NFTs</span>
            <Link to="/nfts" className="text-xs font-semibold text-primary">
              See all
            </Link>
          </div>
          <OpenNftCollectiblesPanel userId={user.id} limit={6} compact />
        </section>
      )}

      {/* Recent activity */}
      <section className="mt-8">
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent activity</h2>
          <Link to="/activity" className="text-xs font-semibold text-primary">
            See all
          </Link>
        </header>
        {showActivitySkeletons ? (
          <ul className="animate-in fade-in duration-300" aria-busy="true" aria-label="Loading activity">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i}>
                <ActivityRowSkeleton delayMs={i * 70} />
              </li>
            ))}
          </ul>
        ) : recentTxs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No activity yet</p>
        ) : (
          <ul className="animate-in fade-in duration-300">
            {recentTxs.slice(0, 5).map((t) => (
              <li key={`${t.source ?? "wallet"}-${t.id}`}>
                <TxRowButton tx={t} onOpen={setSelectedTx} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {!showTokenSkeletons && !hasAssets && recentTxs.length === 0 && onboardDismissed && (
        <section className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="text-base font-bold">Your wallet is ready</div>
          <p className="max-w-xs text-sm text-muted-foreground">
            Send, receive, and trade tokens and collectibles.
          </p>
        </section>
      )}

      <TransactionDetailSheet
        tx={selectedTx}
        open={!!selectedTx}
        onOpenChange={(o) => {
          if (!o) setSelectedTx(null);
        }}
      />

      {/* More actions sheet */}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-border/60 bg-card">
          <DialogHeader>
            <DialogTitle>More</DialogTitle>
            <DialogDescription>Additional wallet actions</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-4 py-2">
            {MORE_ACTIONS.map((a) => (
              <ActionCircle
                key={a.label}
                label={a.label}
                icon={a.icon}
                to={"to" in a ? a.to : undefined}
                href={"href" in a ? a.href : undefined}
                onClick={() => setMoreOpen(false)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Wallet switcher */}
      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-border/60 bg-card">
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
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left press",
                      active ? "bg-primary/15" : "hover:bg-muted/60",
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/20 text-sm font-bold text-primary">
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
            className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            <Plus className="h-4 w-4" /> Add wallet
          </Link>
        </DialogContent>
      </Dialog>

      <ExploreDock
        query={tokenQuery}
        onQueryChange={setTokenQuery}
        searchOpen={searchOpen}
        onSearchOpenChange={(open) => {
          setSearchOpen(open);
          if (open) setTab("tokens");
        }}
        placeholder="Search tokens"
      />
    </div>
  );
}

function TokenRowSkeleton({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div
      className="ph-row pointer-events-none"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-3 w-20 rounded-md" />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-3 w-12 rounded-md" />
      </div>
    </div>
  );
}

function ActivityRowSkeleton({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div
      className="ph-row pointer-events-none"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-4 w-14 rounded-md" />
    </div>
  );
}
