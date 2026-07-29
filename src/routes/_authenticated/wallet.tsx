/**
 * Crypto wallet — Phantom-style OpenPay Pro balances + per-network receive.
 * Route: /wallet
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { OusdIcon } from "@/components/ousd-icon";
import { supabase } from "@/integrations/supabase/client";
import { MAJOR_TOKENS, MAJOR_TOKEN_IDS, fetchMajorMarkets, majorMarketById } from "@/lib/major-tokens";
import { readMajorBalance } from "@/lib/ledger-majors";
import { OUSD_LOGO_URL } from "@/lib/token-logos";
import { cn } from "@/lib/utils";
import { formatCurrency, useCurrency } from "@/lib/currency";
import { formatNumber, shortAddress } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Crypto Wallet — OpenPay Pro" }] }),
  component: CryptoWalletPage,
});

type AssetRow = {
  key: string;
  symbol: string;
  name: string;
  network: string;
  balance: number;
  priceUsd: number;
  logoUrl: string | null;
  receiveTo: string;
  isOusd?: boolean;
};

function CryptoWalletPage() {
  const { user } = Route.useRouteContext();
  const { code: currency } = useCurrency();

  const {
    data: wallet,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  const { data: holdings = [] } = useQuery({
    queryKey: ["holdings", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("token_holdings")
        .select("balance, tokens:token_id(id, name, symbol, price_usd, logo_url)")
        .eq("wallet_id", wallet!.id)
        .gt("balance", 0);
      return data ?? [];
    },
  });

  const { data: majorMarkets } = useQuery({
    queryKey: ["major-markets"],
    staleTime: 60_000,
    queryFn: fetchMajorMarkets,
  });

  const assets = useMemo((): AssetRow[] => {
    const rows: AssetRow[] = [
      {
        key: "ousd",
        symbol: "OUSD",
        name: "OpenPay USD",
        network: "OpenPay",
        balance: Number(wallet?.ousd_balance ?? 0),
        priceUsd: 1,
        logoUrl: OUSD_LOGO_URL,
        receiveTo: "/wallet/receive?network=openpay&asset=OUSD",
        isOusd: true,
      },
    ];

    for (const id of MAJOR_TOKEN_IDS) {
      const def = MAJOR_TOKENS[id];
      rows.push({
        key: id,
        symbol: def.symbol,
        name: def.name,
        network: def.network,
        balance: readMajorBalance(wallet as Record<string, unknown> | null, id),
        priceUsd: majorMarketById(majorMarkets, id).price,
        logoUrl: def.logoUrl,
        receiveTo: `/wallet/receive?network=${id}&asset=${def.symbol}`,
      });
    }

    for (const h of holdings) {
      const t = h.tokens as {
        id?: string;
        name?: string;
        symbol?: string;
        price_usd?: number;
        logo_url?: string | null;
      } | null;
      if (!t?.id || !t.symbol) continue;
      rows.push({
        key: t.id,
        symbol: t.symbol,
        name: t.name || t.symbol,
        network: "OpenPay",
        balance: Number(h.balance ?? 0),
        priceUsd: Number(t.price_usd ?? 0),
        logoUrl: t.logo_url ?? null,
        receiveTo: `/wallet/receive?network=openpay&token=${t.id}`,
      });
    }

    return rows;
  }, [wallet, holdings, majorMarkets]);

  const totalUsd = useMemo(
    () => assets.reduce((sum, a) => sum + a.balance * (a.priceUsd > 0 ? a.priceUsd : 0), 0),
    [assets],
  );

  async function copyAddress() {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      toast.success("OpenPay Pro address copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="ot-phantom mx-auto w-full max-w-lg animate-page-in pb-10 md:max-w-xl">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Crypto Wallet</h1>
            <p className="ph-caption">OpenPay Pro · choose network to receive</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </header>

      {isLoading && !wallet ? (
        <div className="grid place-items-center py-24 text-sm text-muted-foreground">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
          Loading wallet…
        </div>
      ) : !wallet ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No OpenPay Pro wallet yet.</p>
          <Button asChild className="mt-4 rounded-full">
            <Link to="/dashboard">Go to Home</Link>
          </Button>
        </div>
      ) : (
        <>
          <section className="mb-6 rounded-3xl border border-border bg-card p-6 text-center">
            <p className="ph-label">Total balance</p>
            <p className="ph-display mt-2">{formatCurrency(totalUsd, currency)}</p>
            <button
              type="button"
              onClick={() => void copyAddress()}
              className="ph-caption mt-3 inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1.5 font-semibold hover:bg-muted hover:text-foreground"
            >
              {shortAddress(wallet.address, 6, 6)}
              <Copy className="h-3.5 w-3.5" />
            </button>
            <p className="ph-label mt-3 opacity-80">
              {wallet.name || "Main Wallet"} · OpenPay Pro
            </p>
          </section>

          <div className="mb-8 grid grid-cols-4 gap-2">
            <ActionCard to="/wallet/receive" icon={QrCode} label="Receive" primary />
            <ActionCard to="/send" icon={ArrowUpRight} label="Send" />
            <ActionCard to="/activity" icon={History} label="History" />
            <ActionCard to="/tokens" icon={ArrowDownLeft} label="Assets" />
          </div>

          {/* Network receive shortcuts — Phantom style */}
          <section className="mb-6">
            <h2 className="ph-label mb-3">Receive by network</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    network: "openpay" as const,
                    label: "OpenPay",
                    asset: "OUSD" as const,
                    isOusd: true,
                    logoUrl: OUSD_LOGO_URL,
                  },
                  ...MAJOR_TOKEN_IDS.map((id) => ({
                    network: id,
                    label: MAJOR_TOKENS[id].symbol,
                    asset: MAJOR_TOKENS[id].symbol,
                    isOusd: false as const,
                    logoUrl: MAJOR_TOKENS[id].logoUrl,
                  })),
                ]
              ).map((n) => (
                <Link
                  key={n.network}
                  to="/wallet/receive"
                  search={{
                    network: n.network,
                    asset: n.asset as
                      | "OUSD"
                      | "BTC"
                      | "ETH"
                      | "SOL"
                      | "PI"
                      | "USDC"
                      | "USDT"
                      | "PYUSD"
                      | "USDG"
                      | "USD1"
                      | "CASH"
                      | "EURC",
                  }}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-3 press hover:bg-muted/40"
                >
                  {n.isOusd ? (
                    <OusdIcon className="h-9 w-9 shrink-0 rounded-full" />
                  ) : (
                    <img
                      src={n.logoUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover bg-muted"
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{n.label}</span>
                    <span className="block text-[11px] text-muted-foreground">Receive {n.asset}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="ph-label mb-3">Tokens</h2>
            <ul className="overflow-hidden rounded-2xl border border-border bg-card">
              {assets.map((a, i) => {
                const usd = a.balance * (a.priceUsd > 0 ? a.priceUsd : 0);
                const isMajor = a.key === "ousd" || MAJOR_TOKEN_IDS.includes(a.key as (typeof MAJOR_TOKEN_IDS)[number]);
                return (
                  <li key={a.key} className={cn(i > 0 && "border-t border-border")}>
                    <Link
                      to="/wallet/receive"
                      search={
                        isMajor
                          ? {
                              network: (a.key === "ousd" ? "openpay" : a.key) as
                                | "openpay"
                                | "btc"
                                | "eth"
                                | "sol"
                                | "pi"
                                | "usdc"
                                | "usdt"
                                | "pyusd"
                                | "usdg"
                                | "usd1"
                                | "cash"
                                | "eurc",
                              asset: a.symbol as
                                | "OUSD"
                                | "BTC"
                                | "ETH"
                                | "SOL"
                                | "PI"
                                | "USDC"
                                | "USDT"
                                | "PYUSD"
                                | "USDG"
                                | "USD1"
                                | "CASH"
                                | "EURC",
                            }
                          : { network: "openpay", token: a.key }
                      }
                      className="flex items-center gap-3 px-4 py-3 press hover:bg-muted/30"
                    >
                      {a.isOusd ? (
                        <OusdIcon className="h-10 w-10 shrink-0 rounded-full" />
                      ) : a.logoUrl ? (
                        <img src={a.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">
                          {a.symbol.slice(0, 2)}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="ph-row-title">{a.symbol}</div>
                        <div className="ph-row-sub">{a.network}</div>
                      </div>
                      <div className="text-right">
                        <div className="ph-amount text-[15px]">
                          {formatNumber(a.balance, a.balance > 0 && a.balance < 0.01 ? 6 : 4)}
                        </div>
                        <div className="ph-row-sub">{formatCurrency(usd, currency)}</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
              Tap a token to show its receive QR. Deposits credit your OpenPay Pro ledger balance for that
              network asset.
            </p>
          </section>
        </>
      )}
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
