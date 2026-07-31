import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CheckCircle2, ChevronRight, Copy, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import {
  getCheckoutInvoice,
  selectCheckoutNetwork,
  submitCheckoutPayment,
} from "@/lib/payments-gateway.functions";

export const Route = createFileRoute("/pay/$token")({
  head: () => ({
    meta: [
      { title: "Secure Crypto Checkout — OpenPay Pro" },
      {
        name: "description",
        content:
          "Pay in seconds with Ethereum, Base, Solana, Polygon, BNB Chain, Arbitrum, Optimism or Avalanche.",
      },
      { property: "og:title", content: "Secure Crypto Checkout — OpenPay Pro" },
      {
        property: "og:description",
        content: "Multi-chain crypto checkout powered by OpenPay Pro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

async function copy(value: string, label: string) {
  try {
    await copyText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Copy failed");
  }
}

function CheckoutPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const [step, setStep] = useState<"asset" | "pay">("asset");
  const [txHash, setTxHash] = useState("");
  const [qr, setQr] = useState("");

  const q = useQuery({
    queryKey: ["checkout", token],
    queryFn: () => getCheckoutInvoice({ data: { token } }),
    refetchInterval: 15_000,
  });

  const invoice = q.data?.invoice as any;
  const chains = ((q.data as any)?.chains ?? []) as any[];
  const tokens = ((q.data as any)?.tokens ?? []) as any[];

  const [chainId, setChainId] = useState<string>("");
  const activeChain = useMemo(
    () => chains.find((c) => c.id === chainId) ?? chains[0],
    [chains, chainId],
  );
  const chainTokens = tokens.filter((t) => t.chain_id === activeChain?.id);

  useEffect(() => {
    if (invoice?.pay_to_address) {
      setStep("pay");
      void QRCode.toDataURL(invoice.pay_to_address, { margin: 1, width: 360 })
        .then(setQr)
        .catch(() => setQr(""));
    }
  }, [invoice?.pay_to_address]);

  const select = useMutation({
    mutationFn: (tokenId: string) =>
      selectCheckoutNetwork({ data: { token, chainId: activeChain!.id, tokenId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["checkout", token] });
      setStep("pay");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: () => submitCheckoutPayment({ data: { token, txHash: txHash.trim() } }),
    onSuccess: (res) => {
      toast.success(res.status === "paid" ? "Payment confirmed" : "Transaction received — confirming");
      setTxHash("");
      void qc.invalidateQueries({ queryKey: ["checkout", token] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (q.isError || !invoice) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">Payment not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This payment link is invalid or has been removed.
          </p>
        </div>
      </main>
    );
  }

  const paid = invoice.status === "paid";
  const closed = ["expired", "cancelled", "failed"].includes(invoice.status);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
        <header className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
          {step === "pay" && !paid ? (
            <button
              type="button"
              aria-label="Back to asset selection"
              onClick={() => setStep("asset")}
              className="rounded-full p-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {invoice.merchant?.name ?? "OpenPay Pro"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {invoice.description ?? invoice.reference ?? "Crypto checkout"}
            </p>
          </div>
          <ShieldCheck className="h-4 w-4 text-primary" />
        </header>

        <div className="border-b border-border/60 px-5 py-6 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount due</p>
          <p className="text-4xl font-bold tracking-tight">
            ${Number(invoice.amount_usd).toFixed(2)}
          </p>
          {invoice.token_symbol ? (
            <p className="mt-1 text-sm text-muted-foreground">
              ≈ {invoice.token_amount} {invoice.token_symbol} on {invoice.chain_key}
            </p>
          ) : null}
        </div>

        {paid ? (
          <div className="space-y-3 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="text-lg font-semibold">Payment complete</h1>
            <p className="text-sm text-muted-foreground">
              The merchant has been notified and the transaction is recorded in OpenLedger.
            </p>
            {invoice.tx_hash ? (
              <p className="truncate text-xs text-muted-foreground">{invoice.tx_hash}</p>
            ) : null}
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Back to OpenPay Pro</Link>
            </Button>
          </div>
        ) : closed ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            This payment is {invoice.status}. Ask the merchant for a new payment link.
          </div>
        ) : step === "asset" ? (
          <div className="space-y-4 p-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Network
              </p>
              <div className="flex flex-wrap gap-2">
                {chains.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChainId(c.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-semibold",
                      c.id === activeChain?.id
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pay with
              </p>
              <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60">
                {chainTokens.length === 0 ? (
                  <li className="p-4 text-sm text-muted-foreground">
                    No assets are available on this network.
                  </li>
                ) : (
                  chainTokens.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => select.mutate(t.id)}
                        disabled={select.isPending}
                        className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {t.symbol.slice(0, 3)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{t.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {t.symbol} ·{" "}
                            {t.usd_rate
                              ? `${(Number(invoice.amount_usd) / Number(t.usd_rate)).toFixed(6)} ${t.symbol}`
                              : "rate at checkout"}
                          </span>
                        </span>
                        {select.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            {qr ? (
              <img
                src={qr}
                alt="Payment address QR code"
                className="mx-auto h-44 w-44 rounded-xl bg-white p-2"
              />
            ) : null}
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Send exactly {invoice.token_amount} {invoice.token_symbol}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate text-sm">{invoice.pay_to_address}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Copy payment address"
                  onClick={() => copy(invoice.pay_to_address, "Address")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Network: {invoice.chain_key} · Confirmations required:{" "}
                {invoice.required_confirmations}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="tx" className="text-sm font-medium">
                Paste your transaction hash
              </label>
              <div className="flex gap-2">
                <Input
                  id="tx"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="0x… or Solana signature"
                />
                <Button onClick={() => submit.mutate()} disabled={txHash.trim().length < 16 || submit.isPending}>
                  {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {invoice.status === "detected" ? (
              <div className="rounded-xl bg-sky-500/10 p-3 text-sm text-sky-600 dark:text-sky-400">
                Transaction detected — {invoice.confirmations}/{invoice.required_confirmations}{" "}
                confirmations. This page updates automatically.
              </div>
            ) : null}
          </div>
        )}

        <footer className="border-t border-border/60 px-5 py-3 text-center text-[11px] text-muted-foreground">
          Secured by OpenPay Pro · payments are verified on-chain
        </footer>
      </div>
    </main>
  );
}
