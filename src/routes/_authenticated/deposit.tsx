import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { PageHeader } from "@/components/wallet/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import {
  getDepositConfig,
  listMyDeposits,
  refreshDeposit,
  submitDeposit,
} from "@/lib/deposit-gateway.functions";

export const Route = createFileRoute("/_authenticated/deposit")({
  head: () => ({
    meta: [
      { title: "Crypto Deposit — OpenPay Pro" },
      {
        name: "description",
        content:
          "Deposit crypto from any supported blockchain into your OpenPay Pro wallet and get credited automatically.",
      },
      { property: "og:title", content: "Crypto Deposit — OpenPay Pro" },
      {
        property: "og:description",
        content: "Multi-chain crypto deposits credited to your OpenPay Pro balance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DepositPage,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500",
  confirming: "bg-sky-500/15 text-sky-500",
  confirmed: "bg-sky-500/15 text-sky-500",
  credited: "bg-emerald-500/15 text-emerald-500",
  failed: "bg-destructive/15 text-destructive",
  rejected: "bg-destructive/15 text-destructive",
};

function DepositPage() {
  const qc = useQueryClient();
  const [chainId, setChainId] = useState<string>("");
  const [tokenId, setTokenId] = useState<string>("");
  const [txHash, setTxHash] = useState("");
  const [qr, setQr] = useState<string>("");

  const config = useQuery({ queryKey: ["deposit-config"], queryFn: () => getDepositConfig() });
  const deposits = useQuery({
    queryKey: ["my-deposits"],
    queryFn: () => listMyDeposits(),
    refetchInterval: 20_000,
  });

  const chains = config.data?.chains ?? [];
  const activeChain = useMemo(
    () => chains.find((c: any) => c.id === chainId) ?? chains[0],
    [chains, chainId],
  );
  const tokens = (config.data?.tokens ?? []).filter((t: any) => t.chain_id === activeChain?.id);
  const activeToken = tokens.find((t: any) => t.id === tokenId) ?? tokens[0];
  const address = (config.data?.addresses ?? []).find(
    (a: any) =>
      a.chain_id === activeChain?.id && (a.token_id === activeToken?.id || a.token_id === null),
  );

  useMemo(() => {
    if (!address?.address) {
      setQr("");
      return;
    }
    void QRCode.toDataURL(address.address, { margin: 1, width: 320 }).then(setQr).catch(() => setQr(""));
  }, [address?.address]);

  const submit = useMutation({
    mutationFn: () =>
      submitDeposit({
        data: { chainId: activeChain!.id, tokenId: activeToken!.id, txHash: txHash.trim() },
      }),
    onSuccess: () => {
      toast.success("Transaction submitted — tracking confirmations");
      setTxHash("");
      void qc.invalidateQueries({ queryKey: ["my-deposits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recheck = useMutation({
    mutationFn: (id: string) => refreshDeposit({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["my-deposits"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
      <PageHeader title="Deposit crypto" backTo="/dashboard" />

      {config.isLoading ? (
        <Card className="flex items-center justify-center p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </Card>
      ) : chains.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No networks are enabled yet. An administrator needs to enable a blockchain and set a
          receiving address first.
        </Card>
      ) : (
        <>
          <Card className="space-y-4 p-4">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Network</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {chains.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setChainId(c.id);
                      setTokenId("");
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-semibold press",
                      c.id === activeChain?.id
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.name}
                    {c.maintenance_mode ? " · paused" : ""}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Token</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {tokens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tokens enabled on this network.</p>
                ) : (
                  tokens.map((t: any) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTokenId(t.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-semibold press",
                        t.id === activeToken?.id
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.symbol}
                    </button>
                  ))
                )}
              </div>
            </div>

            {activeToken && address ? (
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
                {qr ? (
                  <img
                    src={qr}
                    alt={`Deposit address QR for ${activeToken.symbol} on ${activeChain.name}`}
                    className="mx-auto h-44 w-44 rounded-xl bg-white p-2"
                  />
                ) : null}
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {activeChain.name} deposit address
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate text-sm">{address.address}</code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await copyText(address.address);
                          toast.success("Address copied");
                        } catch {
                          toast.error("Copy failed");
                        }
                      }}
                      aria-label="Copy deposit address"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    Contract:{" "}
                    <span className="text-foreground">
                      {activeToken.contract_address ?? "native asset"}
                    </span>
                  </div>
                  <div>
                    Confirmations:{" "}
                    <span className="text-foreground">{activeChain.required_confirmations}</span>
                  </div>
                  <div>
                    Minimum:{" "}
                    <span className="text-foreground">
                      {activeToken.min_deposit} {activeToken.symbol}
                    </span>
                  </div>
                  <div>
                    Fee: <span className="text-foreground">{activeToken.deposit_fee_bps / 100}%</span>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground">
                  Send only {activeToken.symbol} on {activeChain.name} to this address. Anything else
                  may be lost permanently.
                </p>
              </div>
            ) : activeToken ? (
              <p className="text-sm text-destructive">
                No receiving address is configured for this network yet.
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="txhash">Paste your transaction hash</Label>
              <div className="flex gap-2">
                <Input
                  id="txhash"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="0x… or Solana signature"
                />
                <Button
                  onClick={() => submit.mutate()}
                  disabled={!activeToken || !address || txHash.trim().length < 16 || submit.isPending}
                >
                  {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Track"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                We verify the token, destination and confirmation count on-chain before crediting.
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Deposit history</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void deposits.refetch()}
                aria-label="Refresh deposits"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {(deposits.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No deposits yet.</p>
            ) : (
              <ul className="space-y-2">
                {(deposits.data ?? []).map((d: any) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
                  >
                    <div className="rounded-full bg-muted p-2">
                      {d.status === "credited" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {Number(d.amount)} {d.token_symbol} · {d.chain_key}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{d.tx_hash}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("border-0", STATUS_TONE[d.status] ?? "")}>
                        {d.status === "confirming"
                          ? `${d.confirmations}/${d.required_confirmations}`
                          : d.status}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => recheck.mutate(d.id)}
                        aria-label="Re-check deposit"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex items-start gap-3 p-4 text-xs text-muted-foreground">
            <ArrowDownToLine className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Deposits are recorded in OpenLedger once credited.{" "}
              <a
                className="inline-flex items-center gap-1 text-primary"
                href="https://www.openpyledger.space/pro"
                target="_blank"
                rel="noreferrer"
              >
                View OpenLedger <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
