import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Eye,
  EyeOff,
  History,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { AccountActionRow, type AccountAction } from "@/components/assets/AccountActionRow";
import { AccountAssetList } from "@/components/assets/AccountAssetList";
import { PageHeader } from "@/components/wallet/PageHeader";
import { CurrencyPickerSheet } from "@/components/wallet/CurrencyPickerSheet";
import { Card } from "@/components/ui/card";
import {
  getAccountBalances,
  listAccountTransfers,
} from "@/lib/account-transfer.functions";
import { ACCOUNT_LABELS, type AccountId } from "@/lib/account-transfer";
import { isAccountRouteId, accountAssetRows, accountUsdTotal } from "@/lib/account-portfolio";
import { formatCurrency, useCurrency } from "@/lib/currency";
import { fetchMajorUsdPrices } from "@/lib/ledger-majors";
import { formatNumber, timeAgo } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assets_/$account")({
  head: ({ params }) => {
    const key = String(params.account || "").toLowerCase();
    const title =
      key === "trading" ? "Trading" : key === "p2p" ? "P2P" : key === "funding" ? "Funding" : "Account";
    return { meta: [{ title: `${title} — OpenPay Pro` }] };
  },
  component: AccountDetailPage,
});

function AccountDetailPage() {
  const { account: raw } = Route.useParams();
  const account = (isAccountRouteId(raw) ? raw : "funding") as AccountId;
  const { code: currency, setCode: setCurrency } = useCurrency();
  const [hideBalance, setHideBalance] = useState(false);
  const [fxOpen, setFxOpen] = useState(false);
  const fetchBalances = useServerFn(getAccountBalances);
  const fetchTransfers = useServerFn(listAccountTransfers);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["account-balances"],
    queryFn: () => fetchBalances(),
    refetchInterval: 30_000,
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["account-transfers", account],
    queryFn: () => fetchTransfers({ data: { account, limit: 20 } }),
  });

  const { data: majorPrices } = useQuery({
    queryKey: ["major-usd-prices"],
    staleTime: 60_000,
    queryFn: () => fetchMajorUsdPrices(),
  });

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (majorPrices) {
      for (const [k, v] of Object.entries(majorPrices)) {
        map[k.toUpperCase()] = Number(v) || 0;
      }
    }
    return map;
  }, [majorPrices]);

  const bucket = data?.balances?.[account];
  const equityUsd = accountUsdTotal(bucket, priceMap);
  const rows = useMemo(() => accountAssetRows(bucket, priceMap), [bucket, priceMap]);
  const fmt = (usd: number) => formatCurrency(usd, currency);

  const actions: AccountAction[] =
    account === "funding"
      ? [
          { label: "Deposit", icon: ArrowDownToLine, to: "/deposit" },
          { label: "Withdraw", icon: ArrowUpFromLine, to: "/withdraw" },
          {
            label: "Transfer",
            icon: ArrowLeftRight,
            to: "/transfer",
            search: { from: "funding", to: "trading" },
          },
          { label: "History", icon: History, to: "/activity" },
        ]
      : account === "trading"
        ? [
            {
              label: "Transfer",
              icon: ArrowLeftRight,
              to: "/transfer",
              search: { from: "trading", to: "funding" },
            },
            { label: "Convert", icon: RefreshCw, to: "/swap" },
            { label: "History", icon: History, to: "/activity" },
          ]
        : [
            {
              label: "Transfer",
              icon: ArrowLeftRight,
              to: "/transfer",
              search: { from: "funding", to: "p2p" },
            },
            { label: "P2P", icon: ArrowLeftRight, to: "/p2p" },
            { label: "History", icon: History, to: "/activity" },
          ];

  if (!isAccountRouteId(raw)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 text-sm text-muted-foreground">
        Unknown account.{" "}
        <Link to="/assets" className="text-primary underline">
          Back to Assets
        </Link>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="mx-auto grid min-h-[40vh] w-full max-w-lg place-items-center px-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 px-4 pb-24 pt-1">
      <PageHeader
        title={ACCOUNT_LABELS[account]}
        backTo="/assets"
        right={
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => void refetch()}
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </button>
        }
      />

      <div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"
          onClick={() => setHideBalance((v) => !v)}
        >
          Equity value
          {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => setFxOpen(true)} className="mt-1 block text-left">
          <span className="text-3xl font-bold tracking-tight tabular-nums">
            {hideBalance ? "••••••" : fmt(equityUsd)}
          </span>
          <span className="ml-1.5 text-sm font-semibold text-muted-foreground">
            {currency} ▾
          </span>
        </button>
        {account === "p2p" ? (
          <p className="mt-1 text-xs text-muted-foreground">
            P2P balances are used for ads and escrow. Transfer from Funding to trade.
          </p>
        ) : account === "trading" ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Move funds here for convert/swap workflows. Deposit always credits Funding.
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            External deposits credit Funding. Withdraw and send spend from Funding.
          </p>
        )}
      </div>

      <AccountActionRow actions={actions} />

      <section>
        <h2 className="mb-2 text-sm font-bold">Assets</h2>
        <AccountAssetList
          rows={rows}
          hideBalance={hideBalance}
          valueFormatter={fmt}
          emptyText={`No assets in ${ACCOUNT_LABELS[account]} yet.`}
        />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold">Transfers</h2>
          <Link to="/transfer" search={{ from: account } as never} className="text-xs font-semibold text-primary">
            New transfer
          </Link>
        </div>
        <Card className="rounded-3xl border-border/60 bg-card/70 p-3">
          {!transfers.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No transfers yet.</p>
          ) : (
            <div className="space-y-1">
              {transfers.map((t) => {
                const incoming = t.to_account === account;
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-2xl px-2 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {incoming ? "Received" : "Sent"} {t.asset}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {incoming
                          ? `From ${ACCOUNT_LABELS[t.from_account]}`
                          : `To ${ACCOUNT_LABELS[t.to_account]}`}{" "}
                        · {timeAgo(t.created_at)}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 text-sm font-bold tabular-nums",
                        incoming ? "text-emerald-500" : "text-foreground",
                      )}
                    >
                      {incoming ? "+" : "−"}
                      {hideBalance ? "••••" : formatNumber(t.amount, 6)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <CurrencyPickerSheet
        open={fxOpen}
        onOpenChange={setFxOpen}
        value={currency}
        onSelect={(code) => {
          setCurrency(code);
          setFxOpen(false);
        }}
      />
    </div>
  );
}
