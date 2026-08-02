import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/wallet/PageHeader";
import {
  AssetMark,
  DepositAssetPicker,
  groupDepositAssets,
  type DepositTokenRow,
} from "@/components/deposit/DepositAssetPicker";
import { DepositReminderSheet } from "@/components/deposit/DepositReminderSheet";
import { copyText } from "@/lib/clipboard";
import { logoUrlForTokenSymbol } from "@/lib/token-logos";
import { cn } from "@/lib/utils";
import { shortAddress, timeAgo } from "@/lib/wallet-utils";
import {
  getDepositConfig,
  listMyDeposits,
  refreshDeposit,
  submitDeposit,
} from "@/lib/deposit-gateway.functions";

const searchSchema = z.object({
  symbol: z.string().optional(),
  chain: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/deposit")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Deposit — OpenPay Pro" },
      {
        name: "description",
        content: "Deposit crypto from an external wallet. Select asset, network, then submit Tx ID.",
      },
    ],
  }),
  component: DepositPage,
});

type Row = Record<string, any>;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500",
  confirmed: "bg-sky-500/15 text-sky-500",
  credited: "bg-emerald-500/15 text-emerald-500",
  failed: "bg-destructive/15 text-destructive",
  review: "bg-violet-500/15 text-violet-500",
};

const RECENT_KEY = "openpay.deposit.recentSymbols";

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
        STATUS_STYLE[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function pushRecent(symbol: string) {
  try {
    const next = [symbol.toUpperCase(), ...readRecent().filter((s) => s !== symbol.toUpperCase())].slice(
      0,
      8,
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function estArrivalLabel(confirmations: number | null | undefined) {
  const n = Number(confirmations ?? 1);
  if (!Number.isFinite(n) || n <= 1) return "~ 1 minute";
  if (n <= 3) return `~ ${n} minutes`;
  if (n <= 12) return `~ ${Math.ceil(n * 0.25)} minutes`;
  return `~ ${n} confirmations`;
}

function DepositPage() {
  const navigate = useNavigate({ from: "/deposit" });
  const search = Route.useSearch();
  const qc = useQueryClient();
  const configFn = useServerFn(getDepositConfig);
  const depositsFn = useServerFn(listMyDeposits);
  const submitFn = useServerFn(submitDeposit);
  const refreshFn = useServerFn(refreshDeposit);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["deposit-config"],
    queryFn: () => configFn(),
  });
  const { data: deposits = [] } = useQuery({
    queryKey: ["my-deposits"],
    queryFn: () => depositsFn(),
    refetchInterval: 20_000,
  });

  const chains: Row[] = config?.chains ?? [];
  const tokensAll: DepositTokenRow[] = (config?.tokens ?? []) as DepositTokenRow[];
  const addresses: Row[] = config?.addresses ?? [];

  /** Only tokens that have at least one depositable network (address + not maintenance). */
  const tokens: DepositTokenRow[] = useMemo(() => {
    return tokensAll.filter((t) => {
      const chain = chains.find((c) => c.id === t.chain_id);
      if (!chain?.is_enabled || chain.maintenance_mode) return false;
      return addresses.some(
        (a) =>
          a.chain_id === t.chain_id &&
          a.is_active !== false &&
          (a.token_id === t.id || !a.token_id),
      );
    });
  }, [tokensAll, chains, addresses]);

  const symbol = (search.symbol ?? "").toUpperCase() || null;
  const chainKey = (search.chain ?? "").toLowerCase() || null;

  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderAccepted, setReminderAccepted] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    setRecentSymbols(readRecent());
  }, []);

  useEffect(() => {
    setReminderAccepted(false);
    setReminderOpen(false);
    setTxHash("");
  }, [symbol, chainKey]);

  const assets = useMemo(() => groupDepositAssets(tokens), [tokens]);
  const asset = assets.find((a) => a.symbol === symbol) ?? null;

  const networksForAsset = useMemo(() => {
    if (!symbol) return [];
    const tokenRows = tokensAll.filter((t) => String(t.symbol).toUpperCase() === symbol);
    return chains
      .map((c) => {
        const token = tokenRows.find((t) => t.chain_id === c.id) ?? null;
        if (!token) return null;
        const address =
          addresses.find((a) => a.chain_id === c.id && a.token_id === token.id) ??
          addresses.find((a) => a.chain_id === c.id && !a.token_id) ??
          null;
        return { chain: c, token, address };
      })
      .filter(Boolean) as Array<{ chain: Row; token: DepositTokenRow; address: Row | null }>;
  }, [symbol, tokensAll, chains, addresses]);

  const selected = useMemo(() => {
    if (!chainKey) return null;
    return networksForAsset.find((n) => String(n.chain.key).toLowerCase() === chainKey) ?? null;
  }, [networksForAsset, chainKey]);

  useEffect(() => {
    if (!symbol || !chainKey || reminderAccepted || !selected?.address || selected.chain.maintenance_mode) {
      return;
    }
    setReminderOpen(true);
  }, [symbol, chainKey, reminderAccepted, selected]);

  useEffect(() => {
    let alive = true;
    const addr = selected?.address?.address as string | undefined;
    if (!addr || !reminderAccepted) {
      setQr(null);
      return;
    }
    QRCode.toDataURL(addr, { width: 360, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [selected?.address?.address, reminderAccepted]);

  const submit = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          chain_id: selected!.chain.id,
          token_id: selected!.token.id,
          tx_hash: txHash.trim(),
        },
      }),
    onSuccess: (row: Row) => {
      setTxHash("");
      void qc.invalidateQueries({ queryKey: ["my-deposits"] });
      if (row?.status === "credited") {
        notifySuccess("Deposit credited to Funding", { sound: "receive" });
      } else if (row?.status === "failed") {
        toast.error(row.error || "Deposit could not be verified");
      } else {
        notifySuccess("Deposit detected — waiting for confirmations", { sound: "notify" });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recheck = useMutation({
    mutationFn: (id: string) => refreshFn({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["my-deposits"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const goAsset = (nextSymbol: string) => {
    pushRecent(nextSymbol);
    setRecentSymbols(readRecent());
    void navigate({
      search: { symbol: nextSymbol.toUpperCase() },
    });
  };

  const goNetwork = (key: string) => {
    if (!symbol) return;
    void navigate({
      search: { symbol, chain: key },
    });
  };

  const goBack = () => {
    if (symbol && chainKey) {
      void navigate({ search: { symbol } });
      return;
    }
    if (symbol) {
      void navigate({ search: {} });
      return;
    }
    void navigate({ to: "/dashboard" });
  };

  const title = !symbol
    ? "Select asset"
    : !chainKey
      ? `Deposit ${symbol}`
      : `Deposit ${symbol}`;

  if (configLoading) {
    return (
      <div className="mx-auto grid min-h-[40vh] w-full max-w-lg place-items-center px-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-24 pt-2">
      <PageHeader title={title} onBack={goBack} backTo={symbol ? undefined : "/dashboard"} />

      {!symbol ? (
        <>
          <p className="-mt-1 text-sm text-muted-foreground">
            Choose a crypto to deposit from an external wallet into Funding.
          </p>
          {!tokens.length && tokensAll.length > 0 ? (
            <div className="flex items-start gap-2 rounded-3xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">Deposits are paused or incomplete</p>
                <p className="mt-1 text-xs opacity-90">
                  Tokens exist in admin config, but every network is in maintenance or missing a
                  receive address. Update Admin → Deposits to restore deposits.
                </p>
              </div>
            </div>
          ) : null}
          <DepositAssetPicker
            tokens={tokens}
            recentSymbols={recentSymbols}
            onSelect={goAsset}
          />
          <DepositHistoryCard
            deposits={deposits as Row[]}
            chains={chains}
            onRecheck={(id) => recheck.mutate(id)}
            onRefresh={() => void qc.invalidateQueries({ queryKey: ["my-deposits"] })}
            recheckPending={recheck.isPending}
          />
        </>
      ) : null}

      {symbol && !chainKey ? (
        <NetworkPicker
          symbol={symbol}
          logoUrl={asset?.logoUrl ?? logoUrlForTokenSymbol(symbol)}
          networks={networksForAsset}
          onSelect={(key) => goNetwork(key)}
        />
      ) : null}

      {symbol && chainKey && selected ? (
        <DepositDetail
          symbol={symbol}
          logoUrl={asset?.logoUrl ?? logoUrlForTokenSymbol(symbol)}
          chain={selected.chain}
          token={selected.token}
          address={selected.address}
          reminderAccepted={reminderAccepted}
          qr={qr}
          txHash={txHash}
          setTxHash={setTxHash}
          submitPending={submit.isPending}
          onSubmit={() => {
            if (!txHash.trim()) return;
            submit.mutate();
          }}
          onOpenReminder={() => setReminderOpen(true)}
        />
      ) : null}

      {symbol && chainKey && !selected ? (
        <Card className="rounded-3xl border-border/60 bg-card/70 p-4 text-sm text-muted-foreground">
          This network is not available for {symbol}. Pick another network.
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-9 rounded-full"
            onClick={() => void navigate({ search: { symbol } })}
          >
            Choose network
          </Button>
        </Card>
      ) : null}

      {symbol ? (
        <DepositHistoryCard
          deposits={(deposits as Row[]).filter(
            (d) => String(d.token_symbol).toUpperCase() === symbol,
          )}
          chains={chains}
          onRecheck={(id) => recheck.mutate(id)}
          onRefresh={() => void qc.invalidateQueries({ queryKey: ["my-deposits"] })}
          recheckPending={recheck.isPending}
          compact
        />
      ) : null}

      {selected ? (
        <DepositReminderSheet
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          symbol={symbol!}
          networkName={String(selected.chain.name)}
          logoUrl={asset?.logoUrl ?? logoUrlForTokenSymbol(symbol!)}
          minDeposit={`${selected.token.min_deposit ?? 0} ${symbol}`}
          estArrival={estArrivalLabel(selected.chain.required_confirmations)}
          onContinue={() => {
            setReminderAccepted(true);
            setReminderOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function NetworkPicker({
  symbol,
  logoUrl,
  networks,
  onSelect,
}: {
  symbol: string;
  logoUrl: string | null;
  networks: Array<{ chain: Row; token: DepositTokenRow; address: Row | null }>;
  onSelect: (chainKey: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-3xl border border-border/60 bg-card/70 px-4 py-3">
        <AssetMark symbol={symbol} logoUrl={logoUrl} className="h-10 w-10" />
        <div>
          <p className="text-base font-bold">{symbol}</p>
          <p className="text-sm text-muted-foreground">Select deposit network</p>
        </div>
      </div>

      {!networks.length ? (
        <p className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No networks are enabled for {symbol} yet. Configure tokens and addresses in Admin →
          Deposits.
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/70">
          {networks.map((n, i) => {
            const paused = !!n.chain.maintenance_mode;
            const noAddr = !n.address?.address;
            const disabled = paused || noAddr;
            return (
              <button
                key={n.chain.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(String(n.chain.key))}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3.5 text-left",
                  i < networks.length - 1 && "border-b border-border/50",
                  disabled ? "opacity-55" : "press hover:bg-muted/40",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold tracking-tight">{n.chain.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {paused
                      ? "Paused for maintenance"
                      : noAddr
                        ? "No receive address configured"
                        : `Min ${n.token.min_deposit ?? 0} ${symbol} · ${estArrivalLabel(n.chain.required_confirmations)}`}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DepositDetail({
  symbol,
  logoUrl,
  chain,
  token,
  address,
  reminderAccepted,
  qr,
  txHash,
  setTxHash,
  submitPending,
  onSubmit,
  onOpenReminder,
}: {
  symbol: string;
  logoUrl: string | null;
  chain: Row;
  token: DepositTokenRow;
  address: Row | null;
  reminderAccepted: boolean;
  qr: string | null;
  txHash: string;
  setTxHash: (v: string) => void;
  submitPending: boolean;
  onSubmit: () => void;
  onOpenReminder: () => void;
}) {
  const paused = !!chain.maintenance_mode;

  if (paused) {
    return (
      <div className="flex items-start gap-2 rounded-3xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-bold">{chain.name} deposits are paused for maintenance.</p>
          <p className="mt-1 text-xs opacity-90">Choose another network or try again later.</p>
        </div>
      </div>
    );
  }

  if (!address?.address) {
    return (
      <Card className="rounded-3xl border-border/60 bg-card/70 p-4 text-sm text-muted-foreground">
        No receiving address has been configured for {symbol} on {chain.name}. Ask an admin to add
        one in Admin → Deposits.
      </Card>
    );
  }

  if (!reminderAccepted) {
    return (
      <Card className="space-y-3 rounded-3xl border-border/60 bg-card/70 p-5 text-center">
        <AssetMark symbol={symbol} logoUrl={logoUrl} className="mx-auto h-12 w-12" />
        <p className="text-base font-bold">Confirm deposit network</p>
        <p className="text-sm text-muted-foreground">
          Review the {chain.name} reminder before we show your deposit address.
        </p>
        <Button className="h-11 w-full rounded-full font-bold" onClick={onOpenReminder}>
          Continue
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 rounded-3xl border-border/60 bg-card/70 p-5">
        <div className="flex justify-center">
          {qr ? (
            <div className="relative rounded-2xl bg-white p-3">
              <img src={qr} alt={`${symbol} deposit QR`} className="h-52 w-52" />
              <div className="absolute inset-0 grid place-items-center">
                <AssetMark
                  symbol={symbol}
                  logoUrl={logoUrl}
                  className="h-10 w-10 rounded-full border-2 border-white shadow"
                />
              </div>
            </div>
          ) : (
            <div className="grid h-52 w-52 place-items-center rounded-2xl bg-muted">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <div>
          <button
            type="button"
            className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
            onClick={async () => {
              try {
                await copyText(address.address);
                toast.success("Address copied");
              } catch {
                toast.error("Copy failed");
              }
            }}
          >
            Address ›
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await copyText(address.address);
                toast.success("Address copied");
              } catch {
                toast.error("Copy failed");
              }
            }}
            className="flex w-full items-start gap-2 break-all text-left font-mono text-xs font-semibold leading-relaxed hover:text-primary"
          >
            <span className="min-w-0 flex-1">{address.address}</span>
            <Copy className="mt-0.5 h-4 w-4 shrink-0" />
          </button>
        </div>

        <div className="divide-y divide-border/50 overflow-hidden rounded-2xl bg-muted/35">
          <DetailRow
            label="Network"
            value={
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <AssetMark symbol={symbol} logoUrl={logoUrl} className="h-4 w-4" />
                {chain.name}
              </span>
            }
          />
          <DetailRow label="Deposit account" value={<span className="font-semibold">Funding</span>} />
          <DetailRow
            label="Minimum deposit"
            value={
              <span className="font-semibold tabular-nums">
                {token.min_deposit ?? 0} {symbol}
              </span>
            }
          />
          <DetailRow
            label="Arrival time"
            value={
              <span className="font-semibold">{estArrivalLabel(chain.required_confirmations)}</span>
            }
          />
          <DetailRow
            label="Confirmations"
            value={<span className="font-semibold">{chain.required_confirmations}</span>}
          />
          {Number(token.deposit_fee_bps ?? 0) > 0 ? (
            <DetailRow
              label="Deposit fee"
              value={
                <span className="font-semibold">
                  {(Number(token.deposit_fee_bps) / 100).toFixed(2)}%
                </span>
              }
            />
          ) : null}
        </div>

        {address.memo_tag ? (
          <div className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
            Include memo/tag: <span className="font-mono font-bold">{address.memo_tag}</span>
          </div>
        ) : null}

        {token.contract_address ? (
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Token contract</p>
            <p className="break-all font-mono text-[11px] text-muted-foreground">
              {token.contract_address}
            </p>
          </div>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          Send only {symbol} on {chain.name}. After sending, paste the Transaction ID below. We
          match it on-chain and credit the exact amount to Funding.
        </p>
      </Card>

      <Card className="space-y-3 rounded-3xl border-border/60 bg-card/70 p-4">
        <Label htmlFor="txhash" className="text-xs uppercase text-muted-foreground">
          Transaction ID
        </Label>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <Input
            id="txhash"
            value={txHash}
            maxLength={120}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder={
              chain.family === "solana"
                ? "Signature"
                : chain.family === "pi" || chain.family === "stellar"
                  ? "Pi transaction ID (64 hex characters)"
                  : "0x…"
            }
            className="h-11 rounded-xl font-mono text-xs"
          />
          <Button
            type="submit"
            disabled={submitPending || !txHash.trim()}
            className="h-11 shrink-0 rounded-xl px-4 font-bold"
          >
            {submitPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ArrowDownToLine className="h-4 w-4" />
                <span className="ml-1.5">Submit</span>
              </>
            )}
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground">
          Ledger verifies destination, token, and exact amount before crediting Funding.
        </p>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function DepositHistoryCard({
  deposits,
  chains,
  onRecheck,
  onRefresh,
  recheckPending,
  compact,
}: {
  deposits: Row[];
  chains: Row[];
  onRecheck: (id: string) => void;
  onRefresh: () => void;
  recheckPending?: boolean;
  compact?: boolean;
}) {
  return (
    <Card className="rounded-3xl border-border/60 bg-card/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">{compact ? "Recent for this asset" : "Deposit history"}</h2>
        <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={onRefresh}>
          <RefreshCw className={cn("h-4 w-4", recheckPending && "animate-spin")} />
        </Button>
      </div>

      {!deposits.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No deposits yet.</p>
      ) : (
        <div className="space-y-2">
          {deposits.map((d) => {
            const chainRow = chains.find((c) => c.key === d.chain_key);
            const explorer = chainRow?.explorer_url
              ? `${String(chainRow.explorer_url).replace(/\/+$/, "")}/tx/${d.tx_hash}`
              : null;
            return (
              <div
                key={d.id}
                className="rounded-2xl border border-border/50 bg-background/50 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold">
                    {d.status === "credited" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : d.status === "failed" ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-500" />
                    )}
                    {d.amount} {d.token_symbol}
                  </div>
                  <StatusChip status={d.status} />
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground sm:grid-cols-4">
                  <span className="capitalize">{d.chain_key}</span>
                  <span>
                    {d.confirmations}/{d.required_confirmations} conf
                  </span>
                  <span>Funding</span>
                  <span>{timeAgo(d.created_at)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="font-mono text-muted-foreground">
                    {shortAddress(d.tx_hash, 8, 6)}
                  </span>
                  {explorer ? (
                    <a
                      href={explorer}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Explorer <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {d.status !== "credited" && d.status !== "failed" ? (
                    <button
                      type="button"
                      onClick={() => onRecheck(d.id)}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <RefreshCw className="h-3 w-3" /> Re-check
                    </button>
                  ) : null}
                </div>
                {d.error ? <p className="mt-1.5 text-[11px] text-destructive">{d.error}</p> : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
