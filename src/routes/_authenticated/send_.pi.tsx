import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/wallet/PageHeader";
import { QrScannerButton } from "@/components/qr-scanner";
import { OusdIcon } from "@/components/ousd-icon";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import { sendOusdToPiWallet, getPiPayoutStatus } from "@/lib/pi-payout.functions";
import {
  PI_PAYOUT_MAX_OUSD,
  PI_PAYOUT_MIN_OUSD,
  extractPiWalletFromQr,
  formatPiWalletPreview,
  getPiWalletError,
  isValidPiWalletAddress,
  normalizePiWalletAddress,
  piTxExplorerUrl,
} from "@/lib/pi-payout";

const searchSchema = z.object({
  to: z.string().optional(),
  amount: z.string().optional(),
  memo: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/send_/pi")({
  head: () => ({
    meta: [
      { title: "Send to Pi Wallet — OpenPay Pro" },
      {
        name: "description",
        content:
          "Send OpenUSD (OUSD) from your OpenPay Pro balance straight to a Pi Wallet address on the Pi blockchain.",
      },
      { property: "og:title", content: "Send to Pi Wallet — OpenPay Pro" },
      {
        property: "og:description",
        content: "Pay OpenUSD on the Pi network from your OpenPay Pro balance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search) => searchSchema.parse(search),
  component: SendToPiWalletPage,
});

const SEND_STAGES = [
  "Preparing transfer…",
  "Debiting wallet…",
  "Sending OUSD on Pi…",
  "Confirming on network…",
] as const;

type Receipt = {
  amount: number;
  to: string;
  txid: string;
  horizon: string | null;
};

function SendToPiWalletPage() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const sendToPi = useServerFn(sendOusdToPiWallet);
  const payoutStatus = useServerFn(getPiPayoutStatus);

  const [walletTo, setWalletTo] = useState(search.to ?? "");
  const [amount, setAmount] = useState(search.amount ?? "");
  const [memo, setMemo] = useState((search.memo ?? "").slice(0, 28));
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState(0);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const { data: wallet, isLoading: loadingBalance } = useQuery({
    queryKey: ["pi-send-wallet", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("wallets")
          .select("ousd_balance")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  const { data: status } = useQuery({
    queryKey: ["pi-payout-status"],
    staleTime: 300_000,
    queryFn: () => payoutStatus(),
  });

  const balance = Number(wallet?.ousd_balance ?? 0);
  const amountNum = Number(amount);
  const dest = normalizePiWalletAddress(walletTo);
  const destError = getPiWalletError(walletTo);
  const preview = formatPiWalletPreview(dest);
  const amountInRange =
    Number.isFinite(amountNum) &&
    amountNum >= PI_PAYOUT_MIN_OUSD &&
    amountNum <= PI_PAYOUT_MAX_OUSD;

  const canSubmit = useMemo(
    () => isValidPiWalletAddress(dest) && !destError && amountInRange && !submitting,
    [dest, destError, amountInRange, submitting],
  );

  useEffect(() => {
    if (!submitting) {
      setStage(0);
      return;
    }
    const id = window.setInterval(
      () => setStage((p) => (p + 1) % SEND_STAGES.length),
      2200,
    );
    return () => window.clearInterval(id);
  }, [submitting]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (amountNum > balance) {
      toast.error("Insufficient balance");
      return;
    }
    setSubmitting(true);
    try {
      const res = (await sendToPi({
        data: { to: dest, amount: Number(amountNum.toFixed(2)), memo: memo.trim().slice(0, 28) },
      })) as { pi_txid?: string; horizon?: string | null };
      const txid = String(res.pi_txid || "");
      toast.success(`Sent ${formatNumber(amountNum, 2)} OUSD to Pi Wallet`);
      setReceipt({ amount: amountNum, to: dest, txid, horizon: res.horizon ?? null });
      setWalletTo("");
      setAmount("");
      setMemo("");
      await qc.invalidateQueries({ queryKey: ["pi-send-wallet", user.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transfer to Pi Wallet failed");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    "h-12 rounded-xl border-border/60 bg-muted/50 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/35";

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28">
      <PageHeader title="Send to Pi Wallet" backTo="/send" />

      {/* Balance */}
      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your balance
        </p>
        {loadingBalance ? (
          <div className="mt-2 h-9 w-40 animate-pulse rounded-lg bg-muted" />
        ) : (
          <p className="mt-1 flex items-baseline gap-2 text-3xl font-semibold tabular-nums">
            {formatNumber(balance, 2)}
            <span className="text-base font-medium text-muted-foreground">OUSD</span>
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Debits your OpenPay Pro OUSD and credits OpenUSD in the recipient&rsquo;s Pi Wallet.
        </p>
      </section>

      {/* Trustline explainer */}
      <section className="mt-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <OusdIcon className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Pi Wallet · OpenUSD</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The recipient must enable OUSD in Pi Wallet (Tokens) before they can receive it.
              Transfers to a wallet without the trustline are rejected before any debit.
            </p>
          </div>
        </div>
      </section>

      {status && status.configured === false ? (
        <p className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          Pi Wallet payout is temporarily unavailable. Please try again shortly.
        </p>
      ) : null}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-3 space-y-4">
        <section className="space-y-4 rounded-2xl border border-border/60 bg-card p-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="pi-address" className="text-xs font-medium text-muted-foreground">
                Pi Wallet address
              </label>
              <QrScannerButton
                hint="Scan a Pi Wallet (G…) address"
                onResult={(text) => {
                  const found = extractPiWalletFromQr(text);
                  if (!found) {
                    toast.error("No Pi Wallet address in that QR code");
                    return;
                  }
                  setWalletTo(found);
                  toast.success("Pi Wallet address scanned");
                }}
              />
            </div>
            <Input
              id="pi-address"
              value={walletTo}
              onChange={(e) => setWalletTo(e.target.value.trim())}
              placeholder="G…"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className={cn(fieldClass, "font-mono text-[13px]")}
            />
            {walletTo.trim() && destError ? (
              <p className="mt-1.5 text-xs text-destructive">{destError}</p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Paste the G-address from Pi Wallet → Receive, or tap scan to use the camera.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="pi-amount" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Amount (OUSD)
            </label>
            <Input
              id="pi-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={PI_PAYOUT_MIN_OUSD.toFixed(2)}
              className={cn(fieldClass, "font-semibold tabular-nums")}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Min {formatNumber(PI_PAYOUT_MIN_OUSD, 2)} · Max {formatNumber(PI_PAYOUT_MAX_OUSD, 2)} OUSD
              per transaction
            </p>
            {amount.trim() && Number.isFinite(amountNum) && !amountInRange ? (
              <p className="mt-1 text-xs text-destructive">
                {amountNum < PI_PAYOUT_MIN_OUSD
                  ? `Enter at least ${formatNumber(PI_PAYOUT_MIN_OUSD, 2)} OUSD`
                  : `Enter at most ${formatNumber(PI_PAYOUT_MAX_OUSD, 2)} OUSD`}
              </p>
            ) : null}
            {amount.trim() && amountInRange && amountNum > balance ? (
              <p className="mt-1 text-xs text-destructive">Insufficient balance</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="pi-memo" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Memo (optional)
            </label>
            <Input
              id="pi-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value.slice(0, 28))}
              placeholder="Shown on Pi chain (28 chars)"
              maxLength={28}
              className={fieldClass}
            />
          </div>
        </section>

        {preview ? (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-500">
            Preview: send to Pi Wallet {preview}
            {Number.isFinite(amountNum) && amountNum > 0
              ? ` · ${formatNumber(amountNum, 2)} OUSD`
              : ""}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="h-12 w-full rounded-xl" disabled={!canSubmit}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send className="size-4" /> {preview ? `Send to ${preview}` : "Send to Pi Wallet"}
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">OUSD on Pi Wallet</p>
      </form>

      {/* Sending overlay */}
      {submitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-border/60 bg-card p-6 text-center">
            <span className="relative mx-auto flex size-12 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />
              <Loader2 className="size-8 animate-spin text-primary" />
            </span>
            <p className="mt-4 text-sm font-semibold">Sending to Pi Wallet</p>
            <p className="mt-1 text-xs text-muted-foreground">{SEND_STAGES[stage]}</p>
            {Number.isFinite(amountNum) && amountNum > 0 ? (
              <p className="mt-3 text-lg font-semibold tabular-nums">
                {formatNumber(amountNum, 2)} OUSD
              </p>
            ) : null}
            {preview ? <p className="text-xs text-muted-foreground">{preview}</p> : null}
          </div>
        </div>
      ) : null}

      {/* Receipt */}
      {receipt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15">
              <OusdIcon className="size-7" />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">Sent to Pi Wallet</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatNumber(receipt.amount, 2)} OUSD
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
              {receipt.to}
            </p>
            {receipt.txid ? (
              <a
                href={piTxExplorerUrl(receipt.txid, receipt.horizon)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary"
              >
                View on Pi Explorer <ExternalLink className="size-3.5" />
              </a>
            ) : null}
            <Button className="mt-5 h-11 w-full rounded-xl" onClick={() => setReceipt(null)}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
