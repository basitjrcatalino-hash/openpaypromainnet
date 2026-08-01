import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
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
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { shortAddress, timeAgo } from "@/lib/wallet-utils";
import {
  getDepositConfig,
  listMyDeposits,
  refreshDeposit,
  submitDeposit,
} from "@/lib/deposit-gateway.functions";

export const Route = createFileRoute("/_authenticated/deposit")({
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

function DepositPage() {
  const qc = useQueryClient();
  const configFn = useServerFn(getDepositConfig);
  const depositsFn = useServerFn(listMyDeposits);
  const submitFn = useServerFn(submitDeposit);
  const refreshFn = useServerFn(refreshDeposit);

  const { data: config } = useQuery({ queryKey: ["deposit-config"], queryFn: () => configFn() });
  const { data: deposits = [] } = useQuery({
    queryKey: ["my-deposits"],
    queryFn: () => depositsFn(),
    refetchInterval: 20_000,
  });

  const chains: Row[] = config?.chains ?? [];
  const tokens: Row[] = config?.tokens ?? [];
  const addresses: Row[] = config?.addresses ?? [];

  const [chainId, setChainId] = useState<string>("");
  const [tokenId, setTokenId] = useState<string>("");
  const [txHash, setTxHash] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!chainId && chains.length) setChainId(chains[0].id);
  }, [chains, chainId]);

  const chainTokens = useMemo(
    () => tokens.filter((t) => t.chain_id === chainId),
    [tokens, chainId],
  );

  useEffect(() => {
    if (chainTokens.length && !chainTokens.some((t) => t.id === tokenId)) {
      setTokenId(chainTokens[0].id);
    }
    if (!chainTokens.length) setTokenId("");
  }, [chainTokens, tokenId]);

  const chain = chains.find((c) => c.id === chainId) ?? null;
  const token = chainTokens.find((t) => t.id === tokenId) ?? null;

  const address = useMemo(() => {
    const forToken = addresses.find((a) => a.chain_id === chainId && a.token_id === tokenId);
    return forToken ?? addresses.find((a) => a.chain_id === chainId && !a.token_id) ?? null;
  }, [addresses, chainId, tokenId]);

  useEffect(() => {
    let alive = true;
    if (!address?.address) {
      setQr(null);
      return;
    }
    QRCode.toDataURL(address.address, { width: 320, margin: 1 })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [address?.address]);

  const submit = useMutation({
    mutationFn: () => submitFn({ data: { chain_id: chainId, token_id: tokenId, tx_hash: txHash.trim() } }),
    onSuccess: (row: Row) => {
      setTxHash("");
      void qc.invalidateQueries({ queryKey: ["my-deposits"] });
      if (row?.status === "credited") notifySuccess("Deposit credited to your wallet", { sound: "receive" });
      else if (row?.status === "failed") toast.error(row.error || "Deposit could not be verified");
      else notifySuccess("Deposit detected — waiting for confirmations", { sound: "notify" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recheck = useMutation({
    mutationFn: (id: string) => refreshFn({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["my-deposits"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const paused = chain?.maintenance_mode;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-24 pt-2">
      <PageHeader title="Deposit" backTo="/dashboard" />
      <p className="-mt-2 text-sm text-muted-foreground">
        Fund your wallet from any supported chain.
      </p>


      <Card className="space-y-4 rounded-3xl border-border/60 bg-card/70 p-4">
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Network</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {chains.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChainId(c.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-semibold press",
                  c.id === chainId
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border/60 text-muted-foreground hover:bg-muted/50",
                )}
              >
                {c.name}
              </button>
            ))}
            {!chains.length && (
              <p className="text-sm text-muted-foreground">No networks are enabled yet.</p>
            )}
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase text-muted-foreground">Token</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {chainTokens.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTokenId(t.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-semibold press",
                  t.id === tokenId
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border/60 text-muted-foreground hover:bg-muted/50",
                )}
              >
                {t.symbol}
              </button>
            ))}
            {!chainTokens.length && (
              <p className="text-sm text-muted-foreground">
                No deposit tokens are enabled on this network yet.
              </p>
            )}
          </div>
        </div>

        {paused && (
          <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-500">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {chain?.name} deposits are paused for maintenance.
          </div>
        )}

        {token && address && !paused && (
          <div className="grid gap-4 rounded-2xl border border-border/60 bg-background/60 p-4 sm:grid-cols-[auto_1fr]">
            {qr ? (
              <img
                src={qr}
                alt={`${token.symbol} deposit address QR code`}
                className="h-40 w-40 self-center rounded-xl bg-white p-2"
              />
            ) : (
              <div className="grid h-40 w-40 place-items-center rounded-xl bg-muted">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 space-y-2.5 text-sm">
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Deposit address</div>
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

                  className="flex w-full items-center gap-2 break-all text-left font-mono text-xs font-semibold hover:text-primary"
                >
                  {address.address}
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground">Network</div>
                  <div className="font-semibold">{chain?.name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Confirmations</div>
                  <div className="font-semibold">{chain?.required_confirmations}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Minimum</div>
                  <div className="font-semibold">
                    {token.min_deposit} {token.symbol}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Deposit fee</div>
                  <div className="font-semibold">{(token.deposit_fee_bps / 100).toFixed(2)}%</div>
                </div>
              </div>
              {token.contract_address && (
                <div>
                  <div className="text-[11px] uppercase text-muted-foreground">Token contract</div>
                  <div className="break-all font-mono text-[11px]">{token.contract_address}</div>
                </div>
              )}
              {address.memo_tag && (
                <div className="rounded-xl bg-amber-500/10 p-2 text-xs text-amber-500">
                  Include memo/tag: <span className="font-mono">{address.memo_tag}</span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Send only {token.symbol} on {chain?.name}. Anything else may be lost permanently.
              </p>
            </div>
          </div>
        )}

        {token && !address && (
          <div className="rounded-2xl bg-muted/50 p-3 text-sm text-muted-foreground">
            No receiving address has been configured for this token yet.
          </div>
        )}

        {token && address && !paused && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!txHash.trim()) return;
              submit.mutate();
            }}
          >
            <Label htmlFor="txhash" className="text-xs uppercase text-muted-foreground">
              Already sent? Paste the transaction hash
            </Label>
            <div className="flex gap-2">
              <Input
                id="txhash"
                value={txHash}
                maxLength={120}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder={chain?.family === "solana" ? "Signature" : "0x…"}
                className="font-mono text-xs"
              />
              <Button type="submit" disabled={submit.isPending || !txHash.trim()} className="rounded-xl">
                {submit.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="h-4 w-4" />
                )}
                <span className="ml-1.5 hidden sm:inline">Track</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              We verify the token, network, destination and confirmations on-chain before crediting.
            </p>
          </form>
        )}
      </Card>

      <Card className="rounded-3xl border-border/60 bg-card/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">Deposit history</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => qc.invalidateQueries({ queryKey: ["my-deposits"] })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {!deposits.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">No deposits yet.</p>
        )}

        <div className="space-y-2">
          {(deposits as Row[]).map((d) => {
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
                  <span>Block {d.block_number ?? "—"}</span>
                  <span>{timeAgo(d.created_at)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="font-mono text-muted-foreground">
                    {shortAddress(d.tx_hash, 8, 6)}
                  </span>
                  {explorer && (
                    <a
                      href={explorer}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Explorer <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {d.status !== "credited" && d.status !== "failed" && (
                    <button
                      type="button"
                      onClick={() => recheck.mutate(d.id)}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <RefreshCw className="h-3 w-3" /> Re-check
                    </button>
                  )}
                </div>
                {d.error && <p className="mt-1.5 text-[11px] text-destructive">{d.error}</p>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
