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
  Settings2,
} from "lucide-react";

import { AccountActionRow } from "@/components/assets/AccountActionRow";
import { AccountAssetList } from "@/components/assets/AccountAssetList";
import { PortfolioAccountCard } from "@/components/assets/PortfolioAccountCard";
import { CurrencyPickerSheet } from "@/components/wallet/CurrencyPickerSheet";
import { getAccountBalances } from "@/lib/account-transfer.functions";
import {
  accountAssetRows,
  portfolioUsdTotals,
} from "@/lib/account-portfolio";
import { ACCOUNT_IDS, type TransferAsset } from "@/lib/account-transfer";
import { formatCurrency, useCurrency } from "@/lib/currency";
import { fetchMajorUsdPrices } from "@/lib/ledger-majors";

export const Route = createFileRoute("/_authenticated/assets")({
  head: () => ({
    meta: [
      { title: "Assets — OpenPay Pro" },
      {
        name: "description",
        content: "View Funding, Trading, and P2P balances. Deposit, withdraw, transfer, and history.",
      },
    ],
  }),
  component: AssetsOverviewPage,
});

function AssetsOverviewPage() {
  const { code: currency, setCode: setCurrency, cycle } = useCurrency();
  const [hideBalance, setHideBalance] = useState(false);
  const [fxOpen, setFxOpen] = useState(false);
  const fetchBalances = useServerFn(getAccountBalances);

  const { data, isLoading } = useQuery({
    queryKey: ["account-balances"],
    queryFn: () => fetchBalances(),
    refetchInterval: 30_000,
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
    for (const a of ["OUSD", "USDT", "USDC", "PYUSD", "USDG", "USD1", "CASH", "EURC"] as TransferAsset[]) {
      map[a] = map[a] ?? 1;
    }
    return map;
  }, [majorPrices]);

  const balances = data?.balances;
  const totals = useMemo(
    () =>
      balances
        ? portfolioUsdTotals(balances, priceMap)
        : { funding: 0, trading: 0, p2p: 0, total: 0 },
    [balances, priceMap],
  );

  const cryptoRows = useMemo(() => {
    if (!balances) return [];
    const merged: Record<string, number> = {};
    for (const acct of ACCOUNT_IDS) {
      for (const [asset, bal] of Object.entries(balances[acct])) {
        merged[asset] = (merged[asset] ?? 0) + (Number(bal) || 0);
      }
    }
    return accountAssetRows(merged as Record<TransferAsset, number>, priceMap);
  }, [balances, priceMap]);

  const fmt = (usd: number) => formatCurrency(usd, currency);

  if (isLoading && !data) {
    return (
      <div className="mx-auto grid min-h-[40vh] w-full max-w-lg place-items-center px-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 px-4 pb-24 pt-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"
            onClick={() => setHideBalance((v) => !v)}
          >
            Est total value
            {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setFxOpen(true)}
            className="mt-1 block text-left"
          >
            <span className="text-3xl font-bold tracking-tight tabular-nums">
              {hideBalance ? "••••••" : fmt(totals.total)}
            </span>
            <span className="ml-1.5 text-sm font-semibold text-muted-foreground">
              {currency} ▾
            </span>
          </button>
        </div>
        <Link
          to="/activity"
          className="grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-card/70 text-muted-foreground hover:text-foreground"
          aria-label="History"
        >
          <History className="h-5 w-5" />
        </Link>
      </div>

      <AccountActionRow
        actions={[
          { label: "Deposit", icon: ArrowDownToLine, to: "/deposit" },
          { label: "Withdraw", icon: ArrowUpFromLine, to: "/withdraw" },
          { label: "Transfer", icon: ArrowLeftRight, to: "/transfer" },
          { label: "History", icon: History, to: "/activity" },
        ]}
      />

      <section>
        <div className="mb-2 flex items-center justify-between px-0.5">
          <h2 className="text-sm font-bold">Portfolio</h2>
          <Link
            to="/settings"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Settings"
          >
            <Settings2 className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ACCOUNT_IDS.map((account) => (
            <PortfolioAccountCard
              key={account}
              account={account}
              hideBalance={hideBalance}
              valueLabel={fmt(totals[account])}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-0.5">
          <h2 className="text-sm font-bold">Crypto</h2>
          <button
            type="button"
            className="text-xs font-semibold text-primary"
            onClick={() => cycle()}
          >
            {currency}
          </button>
        </div>
        <div className="mb-2 flex justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Name / Amount</span>
          <span>Value</span>
        </div>
        <AccountAssetList
          rows={cryptoRows}
          hideBalance={hideBalance}
          valueFormatter={fmt}
          amountLabel="Value"
          emptyText="No crypto balances yet. Deposit into Funding to get started."
        />
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
