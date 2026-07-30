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
  QrCode,
  Eye,
  EyeOff,
  ScanLine,
  Blocks,
  Ellipsis,
  Shield,
  X,
  Wallet,
  BadgeCheck,
  BookOpen,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatNumber, formatPct, createFreshRecoveryWallet, fetchActiveWallet, listUserWallets, shortAddress, stashRecoveryPhrase } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import { formatCurrency, formatTokenPrice, useCurrency } from "@/lib/currency";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TransactionDetailSheet, TxRowButton, type TxRow } from "@/components/transaction-detail";
import { OusdIcon } from "@/components/ousd-icon";
import { OpenNftCollectiblesPanel } from "@/components/open-nft-collectibles";
import { fetchWalletActivity } from "@/lib/activity";
import { ActionCircle } from "@/components/wallet/ActionCircle";
import { ExploreDock } from "@/components/wallet/ExploreDock";
import { SegmentedTabs } from "@/components/wallet/SegmentedTabs";
import { WalletBalanceHero } from "@/components/wallet/WalletBalanceHero";
import { TokenAvatar } from "@/components/wallet/TokenAvatar";
import { WalletSwitcherDialog } from "@/components/wallet/WalletSwitcherDialog";
import { CurrencyPickerSheet } from "@/components/wallet/CurrencyPickerSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { MAJOR_TOKENS, fetchMajorMarkets, majorMarketById } from "@/lib/major-tokens";
import { readMajorBalance } from "@/lib/ledger-majors";

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
    is_verified: boolean | null;
  } | null;
};

type WalletRow = Tables<"wallets">;

const PRIMARY_ACTIONS = [
  { label: "Receive", icon: QrCode, to: "/receive" },
  { label: "Send", icon: Send, to: "/send" },
  { label: "Buy", icon: Plus, to: "/topup" },
  { label: "Swap", icon: ArrowLeftRight, to: "/swap" },
] as const;

const MORE_ACTIONS = [
  { label: "OpenToken", icon: BookOpen, to: "/opentoken" },
  { label: "Live Chat", icon: MessageCircle, to: "/chat" },
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
    queryFn: (): Promise<WalletRow[]> => listUserWallets<WalletRow>(supabase, user.id, "*"),
  });

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () => fetchActiveWallet<WalletRow>(supabase, user.id),
  });

  const {
    data: holdings,
    isPending: holdingsPending,
    isFetching: holdingsFetching,
  } = useQuery({
    queryKey: ["holdings", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async (): Promise<HoldingRow[]> => {
      const { data } = await supabase
        .from("token_holdings")
        .select("balance, tokens:token_id(id, name, symbol, price_usd, change_24h, logo_url, is_verified)")
        .eq("wallet_id", wallet!.id);
      return ((data ?? []) as HoldingRow[]).filter((h) => h.tokens != null);
    },
  });

  const { data: recentTxs = [], isLoading: recentLoading, isPending: recentPending } = useQuery({
    queryKey: ["recent-txs", wallet?.id],
    enabled: !!wallet?.id,
    staleTime: 10_000,
    refetchOnMount: "always",
    queryFn: () => fetchWalletActivity(supabase, wallet!.id, 12),
  });

  const { data: majorMarkets } = useQuery({
    queryKey: ["major-markets"],
    staleTime: 60_000,
    queryFn: fetchMajorMarkets,
  });

  /** Skeletons on first load and while switching wallets (fetching with no rows yet). */
  const showTokenSkeletons =
    walletLoading || (!!wallet?.id && (holdingsPending || (holdingsFetching && holdings == null)));
  const showActivitySkeletons = walletLoading || (!!wallet?.id && (recentLoading || recentPending));
  const holdingsList = holdings ?? [];
  const tokensRefreshing = holdingsFetching && !showTokenSkeletons;

  type LedgerAsset = {
    id: string;
    name: string;
    symbol: string;
    balance: number;
    priceUsd: number;
    change24h: number;
    logoUrl: string | null;
    isOusd?: boolean;
    badge?: string;
  };

  const ledgerAssets = useMemo((): LedgerAsset[] => {
    if (!wallet) return [];
    const rows: LedgerAsset[] = [
      {
        id: "ousd",
        name: "OpenUSD OUSD",
        symbol: "OUSD",
        balance: Number(wallet.ousd_balance ?? 0),
        priceUsd: 1,
        change24h: 0,
        logoUrl: null,
        isOusd: true,
        badge: "Earn",
      },
    ];
    for (const id of Object.keys(MAJOR_TOKENS) as Array<keyof typeof MAJOR_TOKENS>) {
      const def = MAJOR_TOKENS[id];
      const m = majorMarketById(majorMarkets, id);
      rows.push({
        id,
        name: def.name,
        symbol: def.symbol,
        balance: readMajorBalance(wallet as Record<string, unknown>, id),
        priceUsd: m.price,
        change24h: m.change24h,
        logoUrl: def.logoUrl,
      });
    }
    return rows;
  }, [wallet, majorMarkets]);

  useEffect(() => {
    if (walletLoading || wallet) return;
    (async () => {
      try {
        const derived = await createFreshRecoveryWallet();
        let created = await supabase
          .from("wallets")
          .insert({
            user_id: user.id,
            name: "Main Wallet",
            address: derived.address,
            recovery_hash: derived.recovery_hash,
            is_active: true,
            ousd_balance: 0,
            pi_balance: 0,
          } as any)
          .select("id")
          .single();
        if (created.error && /recovery_hash/i.test(created.error.message)) {
          created = await supabase
            .from("wallets")
            .insert({
              user_id: user.id,
              name: "Main Wallet",
              address: derived.address,
              is_active: true,
              ousd_balance: 0,
              pi_balance: 0,
            })
            .select("id")
            .single();
        }
        if (!created.error && created.data) {
          stashRecoveryPhrase(created.data.id, derived.phrase);
          qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
          qc.invalidateQueries({ queryKey: ["wallets", user.id] });
          toast.success("Your wallet is ready — back up your recovery phrase in Settings");
        }
      } catch {
        /* ignore race if another tab created first */
      }
    })();
  }, [wallet, walletLoading, user.id, qc]);

  const [hideBalance, setHideBalance] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TxRow | null>(null);
  const { code: currency, setCode: setCurrency } = useCurrency();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const ledgerUsd = ledgerAssets.reduce(
    (sum, a) => sum + a.balance * (a.priceUsd > 0 ? a.priceUsd : 0),
    0,
  );
  const holdingsUsd = holdingsList.reduce(
    (sum, h) => sum + Number(h.balance ?? 0) * Number(h.tokens?.price_usd ?? 0),
    0,
  );
  const totalUsd = ledgerUsd + holdingsUsd;
  const visibleLedger = useMemo(() => {
    const qq = tokenQuery.trim().toLowerCase();
    const withBalance = ledgerAssets.filter((a) => a.balance > 0);
    if (!qq) return withBalance;
    return withBalance.filter(
      (a) =>
        a.name.toLowerCase().includes(qq) ||
        a.symbol.toLowerCase().includes(qq) ||
        (a.isOusd &&
          (qq.includes("ousd") ||
            qq.includes("openusd") ||
            qq.includes("openpay") ||
            "openusd ousd".includes(qq))),
    );
  }, [ledgerAssets, tokenQuery]);

  const filteredHoldings = useMemo(() => {
    const qq = tokenQuery.trim().toLowerCase();
    if (!qq) return holdingsList;
    return holdingsList.filter((h) => {
      const name = h.tokens?.name?.toLowerCase() ?? "";
      const symbol = h.tokens?.symbol?.toLowerCase() ?? "";
      return name.includes(qq) || symbol.includes(qq);
    });
  }, [holdingsList, tokenQuery]);

  const hasAssets = ledgerAssets.some((a) => a.balance > 0) || holdingsList.length > 0;
  const assetCount = ledgerAssets.filter((a) => a.balance > 0).length + holdingsList.length;

  async function copyAddress() {
    if (!wallet?.address) return;
    try {
      await copyText(wallet.address);
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
            onClick={() => setCurrencyOpen(true)}
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
          onCycleCurrency={() => setCurrencyOpen(true)}
          onCopyAddress={copyAddress}
        />
      )}

      {/* Circular actions */}
      <div className="mb-6 flex items-start justify-center gap-3.5 sm:gap-6">
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
            <span className="ph-callout block">Back up your recovery phrase</span>
            <span className="ph-caption block">
              Protect your wallet — confirm backup in Settings
            </span>
          </span>
        </Link>
      )}

      {!showTokenSkeletons && !hasAssets && !onboardDismissed && (
        <div className="mb-4 rounded-2xl bg-card px-4 py-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <div className="ph-callout">Get started</div>
              <p className="ph-caption">Fund your wallet in a few taps</p>
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
          { id: "tokens", label: "Holdings" },
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
              <div className="ph-callout">No tokens yet</div>
              <p className="ph-caption max-w-xs">
                Buy some tokens to get started
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
          ) : visibleLedger.length === 0 && filteredHoldings.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No matching tokens</p>
          ) : (
            <ul
              className={cn(
                "animate-in fade-in duration-300",
                tokensRefreshing && "opacity-60 transition-opacity",
              )}
              aria-busy={tokensRefreshing || undefined}
            >
              {visibleLedger.map((a) => {
                const usd = a.balance * (a.priceUsd > 0 ? a.priceUsd : 0);
                const share = totalUsd > 0 ? (usd / totalUsd) * 100 : 0;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          to: "/asset/$tokenId",
                          params: { tokenId: a.id },
                          search: {
                            openpay_charge: undefined,
                            openpay_ref: undefined,
                            openpay_tx: undefined,
                            openpay_return: undefined,
                            openpay_cancel: undefined,
                          },
                        })
                      }
                      className="ph-row press"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {a.isOusd ? (
                          <div className="relative h-11 w-11 shrink-0">
                            <OusdIcon className="h-11 w-11" />
                            <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background text-primary" />
                          </div>
                        ) : (
                          <TokenAvatar
                            logoUrl={a.logoUrl}
                            name={a.name}
                            symbol={a.symbol}
                            verified
                          />
                        )}
                        <div className="min-w-0">
                          <div className="ph-row-title flex items-center gap-2 truncate">
                            {a.name}
                            {a.badge ? (
                              <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                                {a.badge}
                              </span>
                            ) : null}
                          </div>
                          <div className="ph-row-sub tabular-nums">
                            {formatTokenPrice(a.priceUsd, currency)}{" "}
                            <span
                              className={cn(
                                a.change24h >= 0 ? "text-success" : "text-destructive",
                              )}
                            >
                              {formatPct(a.change24h)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[15px] font-bold tabular-nums tracking-tight">
                          {hideBalance
                            ? "••••"
                            : a.isOusd
                              ? formatNumber(a.balance, 2)
                              : `${formatNumber(a.balance, a.balance > 0 && a.balance < 0.01 ? 6 : 4)} ${a.symbol}`}
                        </div>
                        <div className="ph-row-sub tabular-nums">
                          {hideBalance ? "••••" : formatCurrency(usd, currency)}
                          {!hideBalance && (
                            <span className="ml-1 opacity-80">· {share.toFixed(1)}%</span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
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
                        <TokenAvatar
                          logoUrl={h.tokens?.logo_url}
                          name={h.tokens?.name}
                          symbol={h.tokens?.symbol}
                          verified={h.tokens?.is_verified}
                        />
                        <div className="min-w-0">
                          <div className="ph-row-title truncate">{h.tokens?.name}</div>
                          <div className="ph-row-sub tabular-nums">
                            {formatTokenPrice(Number(h.tokens?.price_usd ?? 0), currency)}{" "}
                            <span className={cn(pct >= 0 ? "text-success" : "text-destructive")}>
                              {formatPct(pct)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[15px] font-bold tabular-nums tracking-tight">
                          {hideBalance
                            ? "••••"
                            : `${formatNumber(h.balance, 4)} ${h.tokens?.symbol ?? ""}`}
                        </div>
                        <div className="ph-row-sub tabular-nums">
                          {hideBalance ? "••••" : formatCurrency(usd, currency)}
                          {!hideBalance && (
                            <span className="ml-1 opacity-80">
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
            <span className="text-sm font-semibold text-muted-foreground">Collectibles</span>
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
            <Wallet className="h-7 w-7" />
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
        <DialogContent hideClose className="max-w-sm rounded-3xl border-border/60 bg-card">
          <DialogHeader>
            <DialogTitle>More</DialogTitle>
            <DialogDescription>Additional wallet actions</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-4 py-2 sm:grid-cols-5">
            {MORE_ACTIONS.map((a) => (
              <ActionCircle
                key={a.label}
                label={a.label}
                icon={"icon" in a ? a.icon : undefined}
                logoUrl={"logoUrl" in a ? (a.logoUrl as string) : undefined}
                to={"to" in a ? (a.to as string) : undefined}
                href={"href" in a ? (a.href as string) : undefined}
                onClick={() => setMoreOpen(false)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <WalletSwitcherDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        wallets={wallets}
        activeWalletId={wallet?.id}
        onSelect={switchWallet}
        switching={switching}
        currency={currency}
        hideBalance={hideBalance}
      />

      <CurrencyPickerSheet
        open={currencyOpen}
        onOpenChange={setCurrencyOpen}
        value={currency}
        onSelect={setCurrency}
      />

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
