import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownUp, ChevronDown, History } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { notifySuccess } from "@/lib/notify-success";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/wallet/PageHeader";
import { TxConfirmModal } from "@/components/wallet/TxConfirmModal";
import { OusdIcon } from "@/components/ousd-icon";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import {
  ACCOUNT_IDS,
  ACCOUNT_LABELS,
  TRANSFER_ASSETS,
  isAccountId,
  isTransferAsset,
  type AccountId,
  type TransferAsset,
} from "@/lib/account-transfer";
import {
  getAccountBalances,
  internalAccountTransfer,
} from "@/lib/account-transfer.functions";
import { MAJOR_TOKENS } from "@/lib/major-tokens";

const searchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  asset: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/transfer")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Transfer — OpenPay Pro" }] }),
  component: TransferPage,
});

function assetLogo(asset: TransferAsset): string | null {
  if (asset === "OUSD") return null;
  const id = asset.toLowerCase() as keyof typeof MAJOR_TOKENS;
  return MAJOR_TOKENS[id]?.logoUrl ?? null;
}

function AssetMark({ asset, className }: { asset: TransferAsset; className?: string }) {
  if (asset === "OUSD") return <OusdIcon className={cn("h-7 w-7", className)} />;
  const logo = assetLogo(asset);
  if (logo) {
    return <img src={logo} alt="" className={cn("h-7 w-7 rounded-full object-cover", className)} />;
  }
  return (
    <span
      className={cn(
        "grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary",
        className,
      )}
    >
      {asset.slice(0, 2)}
    </span>
  );
}

function TransferPage() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const fetchBalances = useServerFn(getAccountBalances);
  const doTransfer = useServerFn(internalAccountTransfer);

  const [from, setFrom] = useState<AccountId>(() =>
    search.from && isAccountId(search.from) ? search.from : "funding",
  );
  const [to, setTo] = useState<AccountId>(() =>
    search.to && isAccountId(search.to) ? search.to : "p2p",
  );
  const [asset, setAsset] = useState<TransferAsset>(() =>
    search.asset && isTransferAsset(search.asset) ? (search.asset.toUpperCase() as TransferAsset) : "OUSD",
  );
  const [amount, setAmount] = useState("");
  const [pickAccount, setPickAccount] = useState<"from" | "to" | null>(null);
  const [pickAsset, setPickAsset] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (search.from && isAccountId(search.from)) setFrom(search.from);
    if (search.to && isAccountId(search.to)) setTo(search.to);
    if (search.asset && isTransferAsset(search.asset)) {
      setAsset(search.asset.toUpperCase() as TransferAsset);
    }
  }, [search.from, search.to, search.asset]);

  const balQ = useQuery({
    queryKey: ["account-balances"],
    queryFn: () => fetchBalances(),
  });

  const fromBal = balQ.data?.balances[from]?.[asset] ?? 0;
  const amtNum = Number(amount);
  const amountValid = Number.isFinite(amtNum) && amtNum > 0;
  const insufficient = amountValid && amtNum > fromBal + 1e-12;
  const canConfirm = amountValid && !insufficient && from !== to;

  const assetsWithBalance = useMemo(() => {
    const bals = balQ.data?.balances[from];
    return TRANSFER_ASSETS.filter((a) => (bals?.[a] ?? 0) > 0 || a === asset);
  }, [balQ.data, from, asset]);

  const transferM = useMutation({
    mutationFn: () =>
      doTransfer({
        data: { from, to, asset, amount: amtNum },
      }),
    onSuccess: () => {
      notifySuccess(`Transferred ${formatNumber(amtNum, 6)} ${asset} to ${ACCOUNT_LABELS[to]}`, {
        sound: "send",
      });
      setAmount("");
      setConfirmOpen(false);
      void qc.invalidateQueries({ queryKey: ["account-balances"] });
      void qc.invalidateQueries({ queryKey: ["account-transfers"] });
      void qc.invalidateQueries({ queryKey: ["p2p-account-balances"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["active-wallet"] });
      void qc.invalidateQueries({ queryKey: ["withdraw-ctx"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      void qc.invalidateQueries({ queryKey: ["recent-txs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function swapAccounts() {
    setFrom(to);
    setTo(from);
    setAmount("");
  }

  function selectAccount(id: AccountId) {
    if (pickAccount === "from") {
      if (id === to) setTo(from);
      setFrom(id);
    } else if (pickAccount === "to") {
      if (id === from) setFrom(to);
      setTo(id);
    }
    setPickAccount(null);
    setAmount("");
  }

  return (
    <div className="ot-phantom ph-page mx-auto min-h-[70vh] max-w-lg pb-24">
      <PageHeader
        title="Transfer"
        backTo="/wallet"
        right={
          <Link
            to="/activity"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="History"
          >
            <History className="h-5 w-5" strokeWidth={1.75} />
          </Link>
        }
      />

      <div className="space-y-3">
        <div className="relative space-y-2">
          <AccountField
            label="From"
            value={ACCOUNT_LABELS[from]}
            onClick={() => setPickAccount("from")}
          />
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <button
              type="button"
              onClick={swapAccounts}
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm press hover:bg-muted"
              aria-label="Swap accounts"
            >
              <ArrowDownUp className="h-4 w-4" />
            </button>
          </div>
          <AccountField
            label="To"
            value={ACCOUNT_LABELS[to]}
            onClick={() => setPickAccount("to")}
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Asset</p>
          <button
            type="button"
            onClick={() => setPickAsset(true)}
            className="flex h-14 w-full items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 text-left press hover:bg-muted/60"
          >
            <AssetMark asset={asset} />
            <span className="flex-1 text-[15px] font-semibold">{asset}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Amount</p>
          <div className="flex h-14 items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="Enter amount"
              className="h-11 flex-1 border-0 bg-transparent px-1 text-[15px] shadow-none focus-visible:ring-0"
            />
            <span className="text-sm font-semibold text-muted-foreground">{asset}</span>
            <button
              type="button"
              disabled={fromBal <= 0}
              onClick={() => setAmount(String(fromBal))}
              className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background disabled:opacity-40"
            >
              Max
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Max transfer{" "}
            <span className="tabular-nums text-foreground/80">
              {formatNumber(fromBal, fromBal < 1 ? 8 : 4)} {asset}
            </span>
          </p>
          {insufficient ? (
            <p className="mt-1 text-xs font-semibold text-destructive">Insufficient balance</p>
          ) : null}
        </div>

        <Button
          type="button"
          className="mt-4 h-12 w-full rounded-full text-base font-semibold"
          disabled={!canConfirm || balQ.isLoading}
          onClick={() => setConfirmOpen(true)}
        >
          Confirm
        </Button>
      </div>

      {pickAccount ? (
        <PickerSheet title={`Select ${pickAccount === "from" ? "From" : "To"}`} onClose={() => setPickAccount(null)}>
          {ACCOUNT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => selectAccount(id)}
              className={cn(
                "flex w-full items-center justify-between px-4 py-3.5 text-left press hover:bg-muted/50",
                (pickAccount === "from" ? from : to) === id && "bg-primary/10",
              )}
            >
              <span className="font-semibold">{ACCOUNT_LABELS[id]}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatNumber(balQ.data?.balances[id]?.[asset] ?? 0, 4)} {asset}
              </span>
            </button>
          ))}
        </PickerSheet>
      ) : null}

      {pickAsset ? (
        <PickerSheet title="Select asset" onClose={() => setPickAsset(false)}>
          {(assetsWithBalance.length ? assetsWithBalance : [...TRANSFER_ASSETS]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAsset(a);
                setPickAsset(false);
                setAmount("");
              }}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3.5 text-left press hover:bg-muted/50",
                asset === a && "bg-primary/10",
              )}
            >
              <AssetMark asset={a} />
              <span className="flex-1 font-semibold">{a}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatNumber(balQ.data?.balances[from]?.[a] ?? 0, 4)}
              </span>
            </button>
          ))}
        </PickerSheet>
      ) : null}

      <TxConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm transfer"
        description="Move funds between your accounts"
        icon={<AssetMark asset={asset} className="h-14 w-14" />}
        amount={`${formatNumber(amtNum, amtNum < 1 ? 6 : 4)} ${asset}`}
        rows={[
          { label: "From", value: ACCOUNT_LABELS[from] },
          { label: "To", value: ACCOUNT_LABELS[to] },
          { label: "Asset", value: asset },
        ]}
        confirmLabel="Confirm"
        busy={transferM.isPending}
        onConfirm={() => transferM.mutate()}
      />
    </div>
  );
}

function AccountField({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3.5 text-left press hover:bg-muted/60"
    >
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-[15px] font-semibold">{value}</p>
      </div>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function PickerSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[70vh] w-full max-w-lg overflow-hidden rounded-t-3xl border border-border bg-card sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
