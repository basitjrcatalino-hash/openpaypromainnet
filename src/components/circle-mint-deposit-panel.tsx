"use client";

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import {
  createCircleMintDeposit,
  refreshCircleMintDeposit,
  syncCircleMintDeposit,
} from "@/lib/circle-mint.functions";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/wallet-utils";

type Props = {
  amountUsd: number;
  walletId?: string;
  className?: string;
  onSuccess?: () => void;
};

/**
 * Circle Mint stablecoin deposit panel.
 * Creates a payment intent, shows deposit address + QR, polls GET /v1/payments.
 */
export function CircleMintDepositPanel({
  amountUsd,
  walletId,
  className,
  onSuccess,
}: Props) {
  const createDeposit = useServerFn(createCircleMintDeposit);
  const refreshDeposit = useServerFn(refreshCircleMintDeposit);
  const syncDeposit = useServerFn(syncCircleMintDeposit);

  const createDepositRef = useRef(createDeposit);
  const refreshDepositRef = useRef(refreshDeposit);
  const syncDepositRef = useRef(syncDeposit);
  const onSuccessRef = useRef(onSuccess);
  createDepositRef.current = createDeposit;
  refreshDepositRef.current = refreshDeposit;
  syncDepositRef.current = syncDeposit;
  onSuccessRef.current = onSuccess;

  const [busy, setBusy] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [chain, setChain] = useState("ETH");
  const [status, setStatus] = useState("created");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [creditedAmount, setCreditedAmount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const amount = Number(amountUsd);
    if (!Number.isFinite(amount) || amount < 0.01) {
      setBusy(false);
      setError("Enter a valid amount first");
      return;
    }

    void (async () => {
      setBusy(true);
      setError(null);
      setPaymentIntentId(null);
      setDepositAddress(null);
      setStatus("created");
      setCreditedAmount(null);
      try {
        const res = await createDepositRef.current({
          data: {
            amount,
            walletId,
          },
        });
        if (cancelled) return;
        setPaymentIntentId(res.paymentIntentId);
        setDepositAddress(res.depositAddress);
        setChain(res.chain);
        setStatus(res.status);
      } catch (err) {
        if (cancelled) return;
        const msg = (err as Error).message || "Could not create Circle deposit";
        setError(msg);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amountUsd, walletId]);

  useEffect(() => {
    if (!depositAddress) {
      setQrUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(depositAddress, {
      width: 280,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [depositAddress]);

  // Auto-poll payments every 12s (stable deps — fns via refs)
  useEffect(() => {
    if (!paymentIntentId || status === "credited") return;
    let cancelled = false;
    const tick = () => {
      void (async () => {
        try {
          const res = await syncDepositRef.current({ data: { paymentIntentId } });
          if (cancelled) return;
          if (res.status === "credited") {
            setStatus("credited");
            setCreditedAmount(res.amount);
            if (!res.alreadyCredited) {
              notifySuccess(`${formatUSD(res.amount)} OUSD credited via Circle`, { sound: "receive" });
            }
            onSuccessRef.current?.();
          }
        } catch {
          /* quiet poll */
        }
      })();
    };
    const id = window.setInterval(tick, 12_000);
    const first = window.setTimeout(tick, 4_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [paymentIntentId, status]);

  async function handleRefresh() {
    if (!paymentIntentId) return;
    setSyncing(true);
    try {
      const refreshed = await refreshDepositRef.current({ data: { paymentIntentId } });
      setDepositAddress(refreshed.depositAddress);
      setChain(refreshed.chain);
      setStatus(refreshed.status);

      const synced = await syncDepositRef.current({ data: { paymentIntentId } });
      if (synced.status === "credited") {
        setStatus("credited");
        setCreditedAmount(synced.amount);
        if (synced.alreadyCredited) toast.message("Already credited");
        else {
          notifySuccess(`${formatUSD(synced.amount)} OUSD credited`, { sound: "receive" });
        }
        onSuccessRef.current?.();
      } else {
        toast.message(
          synced.paymentCount
            ? `Found ${synced.paymentCount} payment(s) — waiting for settlement`
            : "Waiting for your USDC transfer…",
        );
      }
    } catch (err) {
      toast.error((err as Error).message || "Refresh failed");
    } finally {
      setSyncing(false);
    }
  }

  if (busy) {
    return (
      <div className={cn("flex h-40 items-center justify-center", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-5 text-center text-sm text-destructive",
          className,
        )}
      >
        {error}
        <p className="mt-2 text-xs text-muted-foreground">
          Circle Deposit needs a Mint payments API key. Set{" "}
          <code className="font-mono">CIRCLE_API_KEY</code> from Circle Mint Console (not only
          Wallets keys). Optional: <code className="font-mono">CIRCLE_MINT_MERCHANT_WALLET_ID</code>
          . Sandbox Mint:{" "}
          <code className="font-mono">CIRCLE_MINT_BASE_URL=https://api-sandbox.circle.com</code>.
        </p>
      </div>
    );
  }

  if (status === "credited") {
    return (
      <div
        className={cn(
          "space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-6 text-center",
          className,
        )}
      >
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
        <p className="text-lg font-bold text-foreground">Deposit credited</p>
        <p className="text-sm text-muted-foreground">
          {formatUSD(creditedAmount ?? amountUsd)} OUSD added to your wallet
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-2xl bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Send exactly</p>
        <p className="text-xl font-bold tabular-nums">{formatUSD(amountUsd)} USDC</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Circle Mint · {chain} · credited as OUSD after confirmation
        </p>
      </div>

      {depositAddress ? (
        <>
          <div className="mx-auto grid aspect-square w-full max-w-60 place-items-center rounded-2xl bg-white p-3 shadow-sm">
            {qrUrl ? (
              <img src={qrUrl} alt="Circle deposit QR" className="h-full w-full" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Deposit address ({chain})
            </p>
            <p className="mt-1 break-all font-mono text-xs font-semibold">{depositAddress}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full rounded-full"
              onClick={async () => {
                try {
                  await copyText(depositAddress);
                  toast.success("Address copied");
                } catch {
                  toast.error("Copy failed");
                }
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy address
            </Button>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Waiting for Circle to assign a deposit address…
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3 rounded-full"
            disabled={syncing}
            onClick={() => void handleRefresh()}
          >
            {syncing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      )}

      <Button
        type="button"
        className="h-12 w-full rounded-full font-bold"
        disabled={syncing || !paymentIntentId}
        onClick={() => void handleRefresh()}
      >
        {syncing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        Check payment status
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        After you send USDC, Circle creates a payment. We list it via{" "}
        <span className="font-mono">GET /v1/payments</span> and credit OUSD.
      </p>
    </div>
  );
}
