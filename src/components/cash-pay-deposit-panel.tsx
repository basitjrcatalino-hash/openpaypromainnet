"use client";

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  creditCashPayTopup,
  topupWithLedgerCash,
} from "@/lib/cash-topup.functions";
import { buildCashPayQrSvg, CASH_MINT } from "@/lib/solana-pay";
import {
  isSolanaMerchantConfigured,
  resolveSolanaMerchantWallet,
} from "@/lib/solana-payment";
import { MAJOR_TOKENS } from "@/lib/major-tokens";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/wallet-utils";

type Tab = "ledger" | "solana";

type Props = {
  amountUsd: number;
  walletId?: string;
  cashBalance?: number | null;
  className?: string;
  onSuccess?: () => void;
};

const cashDef = MAJOR_TOKENS.cash;

/**
 * Top up OUSD with Phantom CASH:
 * - Ledger: spend custodial cash_balance 1:1
 * - Solana: Solana Pay QR requesting SPL CASH mint → credit on signature
 *
 * @see https://docs.phantom.com/cash
 * @see https://solana.com/docs/tokens
 */
export function CashPayDepositPanel({
  amountUsd,
  walletId,
  cashBalance = 0,
  className,
  onSuccess,
}: Props) {
  const [tab, setTab] = useState<Tab>(
    Number(cashBalance) >= amountUsd ? "ledger" : "solana",
  );
  const spendCash = useServerFn(topupWithLedgerCash);
  const creditOnChain = useServerFn(creditCashPayTopup);
  const qc = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [signature, setSignature] = useState("");

  const merchant = resolveSolanaMerchantWallet();
  const configured = isSolanaMerchantConfigured(merchant);
  const cashAvail = Number(cashBalance ?? 0);
  const canLedger = cashAvail + 1e-8 >= amountUsd;

  useEffect(() => {
    if (tab !== "solana" || !configured || !(amountUsd > 0)) {
      setSvg(null);
      setUrl(null);
      return;
    }
    let cancelled = false;
    setQrBusy(true);
    void buildCashPayQrSvg({
      recipient: merchant,
      amountCash: amountUsd,
      memo: `cash_pay:${amountUsd}`,
      size: 360,
    })
      .then((r) => {
        if (cancelled) return;
        setSvg(r.svg);
        setUrl(r.url);
      })
      .catch((err) => {
        if (cancelled) return;
        setSvg(null);
        setUrl(null);
        toast.error((err as Error).message || "Could not build CASH Pay QR");
      })
      .finally(() => {
        if (!cancelled) setQrBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, configured, merchant, amountUsd]);

  async function payFromLedger() {
    if (!canLedger) {
      toast.error("Not enough CASH in your wallet");
      return;
    }
    setBusy(true);
    try {
      const r = await spendCash({
        data: { amount: amountUsd, walletId },
      });
      toast.success(`${r.amount.toFixed(2)} OUSD credited from CASH`);
      void qc.invalidateQueries({ queryKey: ["active-wallet"] });
      void qc.invalidateQueries({ queryKey: ["wallets"] });
      void qc.invalidateQueries({ queryKey: ["txs"] });
      void qc.invalidateQueries({ queryKey: ["ledger-entries"] });
      void qc.invalidateQueries({ queryKey: ["wallet-portfolio-totals"] });
      onSuccess?.();
    } catch (err) {
      toast.error((err as Error).message || "CASH payment failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmOnChain() {
    const sig = signature.trim();
    if (sig.length < 32) {
      toast.error("Paste the Solana transaction signature");
      return;
    }
    setBusy(true);
    try {
      const r = await creditOnChain({
        data: { amount: amountUsd, signature: sig, walletId },
      });
      if (r.alreadyCredited) {
        toast.message("This CASH payment was already credited");
      } else {
        toast.success(`${r.amount.toFixed(2)} OUSD credited`);
      }
      void qc.invalidateQueries({ queryKey: ["active-wallet"] });
      void qc.invalidateQueries({ queryKey: ["wallets"] });
      void qc.invalidateQueries({ queryKey: ["txs"] });
      void qc.invalidateQueries({ queryKey: ["ledger-entries"] });
      onSuccess?.();
    } catch (err) {
      toast.error((err as Error).message || "Could not credit CASH payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="text-center">
        <span className="mx-auto mb-3 grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-muted">
          <img src={cashDef.logoUrl} alt="" className="h-full w-full object-cover" />
        </span>
        <p className="text-lg font-semibold text-foreground">Pay with CASH</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Phantom CASH on Solana · 1 CASH ≈ $1 → OUSD
        </p>
        <p className="mt-2 text-sm font-semibold tabular-nums">
          {formatUSD(amountUsd)} CASH
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
        <button
          type="button"
          onClick={() => setTab("ledger")}
          className={cn(
            "rounded-lg px-3 py-2 text-xs font-semibold transition",
            tab === "ledger"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          Wallet CASH
        </button>
        <button
          type="button"
          onClick={() => setTab("solana")}
          className={cn(
            "rounded-lg px-3 py-2 text-xs font-semibold transition",
            tab === "solana"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          Solana Pay
        </button>
      </div>

      {tab === "ledger" ? (
        <div className="space-y-3 rounded-2xl bg-card px-4 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Available CASH</span>
            <span className="font-semibold tabular-nums">
              {cashAvail.toFixed(2)}
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Spend CASH already in your OpenPay Pro wallet. Credited as OUSD at
            ~1:1 (platform top-up fee may apply).
          </p>
          <Button
            type="button"
            className="w-full rounded-full"
            disabled={busy || !canLedger}
            onClick={() => void payFromLedger()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {canLedger
              ? `Pay ${formatUSD(amountUsd)} with CASH`
              : "Insufficient CASH — use Solana Pay"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-card px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
            <p>
              Scan with Phantom to send{" "}
              <span className="font-semibold text-foreground">
                {formatUSD(amountUsd)} CASH
              </span>{" "}
              (SPL Token, 6 decimals). Verify mint before paying.
            </p>
            <p className="mt-2 break-all font-mono text-[10px] text-foreground/80">
              {CASH_MINT}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <a
                href="https://docs.phantom.com/cash"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary"
              >
                Phantom CASH docs
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={cashDef.phantomUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary"
              >
                Verify on Phantom
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {!configured ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Set{" "}
              <code className="font-mono text-[11px]">
                VITE_SOLANA_MERCHANT_WALLET
              </code>{" "}
              to generate a CASH Solana Pay QR.
            </div>
          ) : (
            <>
              <div className="mx-auto grid aspect-square w-full max-w-[280px] place-items-center rounded-2xl bg-white p-4 shadow-sm">
                {qrBusy || !svg ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : svg.trimStart().startsWith("<") ? (
                  <div
                    className="h-full w-full [&_svg]:h-full [&_svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                ) : (
                  <img
                    src={svg}
                    alt="CASH Solana Pay QR"
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-full"
                  disabled={!url}
                  onClick={async () => {
                    if (!url) return;
                    try {
                      await copyText(url);
                      toast.success("CASH Pay link copied");
                    } catch {
                      toast.error("Copy failed");
                    }
                  }}
                >
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copy link
                </Button>
                <a
                  href={url ?? undefined}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold",
                    !url && "pointer-events-none opacity-50",
                  )}
                >
                  <QrCode className="h-4 w-4" />
                  Open
                </a>
              </div>
            </>
          )}

          <div className="space-y-2 rounded-2xl bg-card px-4 py-4">
            <label className="block text-xs font-semibold text-muted-foreground">
              Transaction signature
            </label>
            <Input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Paste Solana tx signature after paying"
              className="rounded-xl font-mono text-xs"
            />
            <Button
              type="button"
              className="w-full rounded-full"
              disabled={busy || signature.trim().length < 32}
              onClick={() => void confirmOnChain()}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm & credit OUSD
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
