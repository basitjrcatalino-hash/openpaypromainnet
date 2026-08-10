"use client";

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  createOnrampSession,
  getOnrampStatus,
  syncOnrampOrder,
} from "@/lib/onramp.functions";
import type { OnrampFlow } from "@/lib/onramp";
import { onrampFiatLabel } from "@/lib/onramp";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/wallet-utils";

type Props = {
  amountUsd: number;
  walletId?: string;
  className?: string;
  onSuccess?: () => void;
};

/**
 * Onramp.money hosted widget panel (onramp buy + offramp sell).
 * Docs: https://docs.onramp.money/onramp/user-flow
 */
export function OnrampDepositPanel({
  amountUsd,
  walletId,
  className,
  onSuccess,
}: Props) {
  const createSession = useServerFn(createOnrampSession);
  const status = useServerFn(getOnrampStatus);
  const syncOrder = useServerFn(syncOnrampOrder);

  const createRef = useRef(createSession);
  const statusRef = useRef(status);
  const syncRef = useRef(syncOrder);
  const onSuccessRef = useRef(onSuccess);
  createRef.current = createSession;
  statusRef.current = status;
  syncRef.current = syncOrder;
  onSuccessRef.current = onSuccess;

  const [flow, setFlow] = useState<OnrampFlow>("onramp");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [envLabel, setEnvLabel] = useState("production");
  const [coinCode, setCoinCode] = useState("usdt");
  const [fiatLabel, setFiatLabel] = useState("INR");
  const [busy, setBusy] = useState(false);
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void statusRef.current().then((s) => {
      if (cancelled) return;
      setConfigured(!!s.configured);
      setEnvLabel(s.env);
      setCoinCode(s.coinCode);
      setFiatLabel(onrampFiatLabel(s.fiatType));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Return from the hosted widget: ?onramp_return=1&onramp_ref=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("onramp_return") !== "1") return;
    const r = params.get("onramp_ref");
    if (!r) return;
    setRef(r);
    setSyncing(true);
    void syncRef
      .current({ data: { merchantRecognitionId: r } })
      .then((res) => {
        if (!res.pending && "amount" in res) {
          toast.success(`${Number(res.amount ?? 0).toFixed(2)} OUSD credited`);
          onSuccessRef.current?.();
        } else {
          toast.message("Onramp payment still processing — we’ll credit when complete");
        }
      })
      .catch((err) => toast.error((err as Error).message || "Could not sync order"))
      .finally(() => setSyncing(false));
  }, []);

  async function start() {
    if (!walletId) {
      toast.error("Select an active wallet first");
      return;
    }
    if (!(amountUsd >= 1)) {
      toast.error("Minimum Onramp amount is $1");
      return;
    }
    setBusy(true);
    try {
      const res = await createRef.current({
        data: {
          flow,
          amount: amountUsd,
          walletId,
          origin: window.location.origin,
        },
      });
      setWidgetUrl(res.widgetUrl);
      setRef(res.merchantRecognitionId);
      window.location.href = res.widgetUrl;
    } catch (err) {
      toast.error((err as Error).message || "Could not start Onramp");
      setBusy(false);
    }
  }

  async function refresh() {
    if (!ref) return;
    setSyncing(true);
    try {
      const res = await syncRef.current({ data: { merchantRecognitionId: ref } });
      if (!res.pending && "amount" in res) {
        toast.success(`${Number(res.amount ?? 0).toFixed(2)} OUSD credited`);
        onSuccessRef.current?.();
      } else {
        toast.message(`Onramp status: ${res.status ?? "pending"}`);
      }
    } catch (err) {
      toast.error((err as Error).message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">Onramp.money</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {flow === "onramp"
            ? `Buy ${coinCode.toUpperCase()} with local bank rails (UPI / IMPS / bank transfer) — credited to your OpenPay Pro balance as OUSD.`
            : `Sell crypto for ${fiatLabel} and receive a payout to your local bank account.`}
        </p>
        <p className="mt-2 text-sm font-semibold tabular-nums">
          {formatUSD(amountUsd)} {flow === "onramp" ? "→ OUSD" : `→ ${fiatLabel}`}
        </p>
        <a
          href="https://docs.onramp.money/onramp/user-flow"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
        >
          Onramp docs
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-full bg-muted/40 p-1">
        {(["onramp", "offramp"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFlow(f)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition",
              flow === f
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {f === "onramp" ? (
              <ArrowDownToLine className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpFromLine className="h-3.5 w-3.5" />
            )}
            {f === "onramp" ? "Buy (onramp)" : "Sell (offramp)"}
          </button>
        ))}
      </div>

      {configured === false ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Onramp.money is not configured yet. Add{" "}
          <code className="font-mono text-[11px]">ONRAMP_APP_ID</code> and{" "}
          <code className="font-mono text-[11px]">ONRAMP_SETTLEMENT_WALLET</code>
          , plus optional{" "}
          <code className="font-mono text-[11px]">ONRAMP_API_KEY</code> /{" "}
          <code className="font-mono text-[11px]">ONRAMP_API_SECRET</code> for
          order tracking.
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl bg-card px-4 py-4">
          <p className="text-[12px] text-muted-foreground">
            Environment:{" "}
            <span className="font-semibold text-foreground">{envLabel}</span>
            {" · "}
            You’ll complete KYC and payment on Onramp, then return here.
          </p>
          <Button
            type="button"
            className="w-full rounded-full"
            disabled={busy || configured !== true}
            onClick={() => void start()}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {flow === "onramp" ? "Continue with Onramp" : "Continue with Offramp"}
          </Button>
          {widgetUrl ? (
            <a
              href={widgetUrl}
              className="block text-center text-xs font-medium text-primary"
            >
              Open widget again
            </a>
          ) : null}
          {ref ? (
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full"
              disabled={syncing}
              onClick={() => void refresh()}
            >
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Check payment status
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
