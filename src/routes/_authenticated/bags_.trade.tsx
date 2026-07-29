import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/wallet/PageHeader";
import { BagsWalletBar } from "@/components/bags/BagsWalletBar";
import { TxConfirmModal } from "@/components/wallet/TxConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  bagsCreateSwapTx,
  bagsGetQuote,
  bagsSendSignedTx,
} from "@/lib/bags.functions";
import { solscanTxUrl } from "@/lib/bags-client";
import { ensureBuffer } from "@/lib/buffer-polyfill";

export const Route = createFileRoute("/_authenticated/bags_/trade")({
  head: () => ({ meta: [{ title: "Trade — Bags" }] }),
  component: BagsTradePage,
});

const WSOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function BagsTradePage() {
  const getQuote = useServerFn(bagsGetQuote);
  const createSwap = useServerFn(bagsCreateSwapTx);
  const sendSigned = useServerFn(bagsSendSignedTx);

  const [wallet, setWallet] = useState<string | null>(null);
  const [inputMint, setInputMint] = useState(WSOL);
  const [outputMint, setOutputMint] = useState(USDC);
  const [amount, setAmount] = useState("100000000"); // 0.1 SOL
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<{
    outAmount: string;
    minOutAmount: string;
    priceImpactPct: string;
    slippageBps: number;
    requestId: string;
    raw: Record<string, unknown>;
  } | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function fetchQuote() {
    setBusy(true);
    setSignature(null);
    try {
      const amt = Math.floor(Number(amount));
      if (!Number.isFinite(amt) || amt < 1) throw new Error("Enter amount in smallest units");
      const res = await getQuote({
        data: {
          inputMint: inputMint.trim(),
          outputMint: outputMint.trim(),
          amount: amt,
          slippageMode: "auto",
        },
      });
      setQuote({
        outAmount: res.quote.outAmount,
        minOutAmount: res.quote.minOutAmount,
        priceImpactPct: res.quote.priceImpactPct,
        slippageBps: res.quote.slippageBps,
        requestId: res.quote.requestId,
        raw: res.quote as unknown as Record<string, unknown>,
      });
      toast.success("Quote ready");
    } catch (err) {
      setQuote(null);
      toast.error((err as Error).message || "Quote failed");
    } finally {
      setBusy(false);
    }
  }

  async function executeSwap() {
    if (!quote) {
      toast.error("Get a quote first");
      return;
    }
    setBusy(true);
    try {
      await ensureBuffer();
      const { connectBagsWallet, signAndSendBagsTransactions } = await import("@/lib/bags-sign");
      let address = wallet;
      if (!address) {
        address = await connectBagsWallet();
        setWallet(address);
      }
      const swap = await createSwap({
        data: {
          quote: quote.raw,
          userPublicKey: address,
        },
      });
      toast.message("Approve swap in Phantom…");
      const [sig] = await signAndSendBagsTransactions(
        [swap.transaction],
        async (signedTxBase64) => {
          const r = await sendSigned({ data: { signedTxBase64 } });
          return r.signature;
        },
      );
      setSignature(sig ?? null);
      setConfirmOpen(false);
      toast.success("Swap submitted");
    } catch (err) {
      const msg = (err as Error).message || "Swap failed";
      toast.error(
        /reading 'from'|Buffer/i.test(msg)
          ? "Wallet runtime failed to load (Buffer). Refresh and try again."
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg pb-10">
      <PageHeader title="Trade" backTo="/bags" />
      <BagsWalletBar className="mb-4" onAddress={setWallet} />

      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="rounded-full"
          onClick={() => {
            setInputMint(WSOL);
            setOutputMint(USDC);
            setAmount("100000000");
          }}
        >
          SOL → USDC
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="rounded-full"
          onClick={() => {
            setInputMint(USDC);
            setOutputMint(WSOL);
            setAmount("1000000");
          }}
        >
          USDC → SOL
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Input mint</Label>
          <Input
            value={inputMint}
            onChange={(e) => setInputMint(e.target.value)}
            className="mt-1.5 h-11 rounded-2xl font-mono text-xs"
          />
        </div>
        <div>
          <Label>Output mint</Label>
          <Input
            value={outputMint}
            onChange={(e) => setOutputMint(e.target.value)}
            className="mt-1.5 h-11 rounded-2xl font-mono text-xs"
          />
        </div>
        <div>
          <Label>Amount (smallest units)</Label>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1.5 h-11 rounded-2xl"
            inputMode="numeric"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Example: 100000000 = 0.1 SOL (9 decimals)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className="h-12 rounded-full font-bold"
            variant="secondary"
            disabled={busy}
            onClick={() => void fetchQuote()}
          >
            {busy && !quote ? <Loader2 className="h-5 w-5 animate-spin" /> : "Get quote"}
          </Button>
          <Button
            type="button"
            className="h-12 rounded-full font-bold"
            disabled={busy || !quote}
            onClick={() => setConfirmOpen(true)}
          >
            {busy && quote ? <Loader2 className="h-5 w-5 animate-spin" /> : "Swap"}
          </Button>
        </div>

        <TxConfirmModal
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Confirm Bags swap"
          description="You'll sign this swap in Phantom"
          amount={amount}
          subtitle="Amount in smallest units"
          rows={[
            { label: "Input mint", value: inputMint, mono: true },
            { label: "Output mint", value: outputMint, mono: true },
            { label: "You pay", value: amount, mono: true },
            {
              label: "Est. out",
              value: quote?.outAmount ?? "—",
              mono: true,
            },
            {
              label: "Min out",
              value: quote?.minOutAmount ?? "—",
              mono: true,
            },
            {
              label: "Impact",
              value: quote ? `${quote.priceImpactPct}%` : "—",
            },
            {
              label: "Slippage",
              value: quote ? `${quote.slippageBps / 100}%` : "—",
            },
            { label: "Wallet", value: wallet ?? "Connect Phantom", mono: true },
          ]}
          confirmLabel="Confirm & sign"
          busy={busy}
          onConfirm={() => void executeSwap()}
        />

        {quote ? (
          <div className="rounded-2xl bg-muted/50 px-3 py-3 text-sm">
            <div>
              Out: <span className="font-semibold tabular-nums">{quote.outAmount}</span>
            </div>
            <div>
              Min out: <span className="tabular-nums">{quote.minOutAmount}</span>
            </div>
            <div>
              Impact: {quote.priceImpactPct}% · Slippage {quote.slippageBps / 100}%
            </div>
          </div>
        ) : null}

        {signature ? (
          <a
            href={solscanTxUrl(signature)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
          >
            View on Solscan <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
