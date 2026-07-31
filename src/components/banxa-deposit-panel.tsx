"use client";

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  createBanxaTopupOrder,
  getBanxaTopupStatus,
  syncBanxaTopupOrder,
} from "@/lib/banxa.functions";
import type { BanxaTopupMethodKey } from "@/lib/topup-methods";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/wallet-utils";

const LABELS: Record<
  BanxaTopupMethodKey,
  { title: string; blurb: string; docs: string; cta: string }
> = {
  banxa_apple_pay: {
    title: "Apple Pay",
    blurb:
      "Pay with a card saved to your Apple device. Banxa hosts checkout — Face ID / Touch ID on Apple devices.",
    docs: "https://docs.banxa.com/products/native-api/docs/guides/apple-pay",
    cta: "Continue with Apple Pay",
  },
  banxa_google_pay: {
    title: "Google Pay",
    blurb:
      "Pay with a card saved to Google Pay. Banxa hosts checkout — available on Android / Chrome where Google Pay is supported.",
    docs: "https://docs.banxa.com/products/native-api/docs/guides/google-pay",
    cta: "Continue with Google Pay",
  },
  banxa_card: {
    title: "Card",
    blurb:
      "Pay with debit or credit card in Banxa checkout. Card details stay with Banxa / Primer — OpenPay Pro never sees them.",
    docs: "https://docs.banxa.com/products/native-api/docs/guides/cards",
    cta: "Continue with card",
  },
  banxa_bank: {
    title: "Bank Transfer",
    blurb:
      "Pay by bank transfer (ACH, SEPA, Faster Payments, or PayID depending on fiat). Settlement can take longer than cards.",
    docs: "https://docs.banxa.com/products/native-api/docs/guides/bank-transfer",
    cta: "Continue with bank transfer",
  },
};

type Props = {
  methodKey: BanxaTopupMethodKey;
  amountUsd: number;
  walletId?: string;
  className?: string;
  onSuccess?: () => void;
};

/**
 * Banxa Hosted Checkout deposit panel.
 * Creates a buy order with the selected paymentMethodId and redirects to checkoutUrl.
 */
export function BanxaDepositPanel({
  methodKey,
  amountUsd,
  walletId,
  className,
  onSuccess,
}: Props) {
  const info = LABELS[methodKey];
  const createOrder = useServerFn(createBanxaTopupOrder);
  const syncOrder = useServerFn(syncBanxaTopupOrder);
  const getStatus = useServerFn(getBanxaTopupStatus);

  const createRef = useRef(createOrder);
  const syncRef = useRef(syncOrder);
  const statusRef = useRef(getStatus);
  const onSuccessRef = useRef(onSuccess);
  createRef.current = createOrder;
  syncRef.current = syncOrder;
  statusRef.current = getStatus;
  onSuccessRef.current = onSuccess;

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [envLabel, setEnvLabel] = useState("sandbox");
  const [busy, setBusy] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [externalOrderId, setExternalOrderId] = useState<string | null>(null);
  const [banxaOrderId, setBanxaOrderId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void statusRef.current().then((s) => {
      if (cancelled) return;
      setConfigured(!!s.configured);
      setEnvLabel(s.env);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // After Banxa redirect return: ?banxa_return=1&banxa_ext=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("banxa_return") !== "1") return;
    const ext = params.get("banxa_ext");
    if (!ext) return;
    setExternalOrderId(ext);
    setSyncing(true);
    void syncRef
      .current({ data: { externalOrderId: ext } })
      .then((r) => {
        if (r.alreadyCredited || (r as { amount?: number }).amount) {
          toast.success(
            `${Number((r as { amount?: number }).amount ?? 0).toFixed(2)} OUSD credited`,
          );
          onSuccessRef.current?.();
        } else if ((r as { pending?: boolean }).pending) {
          toast.message("Banxa payment still processing — we’ll credit when complete");
        }
      })
      .catch((err) => {
        toast.error((err as Error).message || "Could not sync Banxa order");
      })
      .finally(() => setSyncing(false));
  }, []);

  async function startCheckout() {
    if (!walletId) {
      toast.error("Select an active wallet first");
      return;
    }
    if (!(amountUsd >= 1)) {
      toast.error("Minimum Banxa top-up is $1");
      return;
    }
    setBusy(true);
    try {
      const res = await createRef.current({
        data: {
          amount: amountUsd,
          methodKey,
          walletId,
          origin: window.location.origin,
        },
      });
      setCheckoutUrl(res.checkoutUrl);
      setExternalOrderId(res.externalOrderId);
      setBanxaOrderId(res.banxaOrderId);
      window.location.href = res.checkoutUrl;
    } catch (err) {
      toast.error((err as Error).message || "Could not start Banxa checkout");
      setBusy(false);
    }
  }

  async function refreshStatus() {
    if (!externalOrderId && !banxaOrderId) return;
    setSyncing(true);
    try {
      const r = await syncRef.current({
        data: {
          externalOrderId: externalOrderId ?? undefined,
          banxaOrderId: banxaOrderId ?? undefined,
        },
      });
      if (r.alreadyCredited || ("amount" in r && r.amount)) {
        toast.success(`${Number(r.amount ?? 0).toFixed(2)} OUSD credited`);
        onSuccessRef.current?.();
      } else {
        toast.message(`Banxa status: ${r.status ?? "pending"}`);
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
        <p className="text-lg font-semibold text-foreground">{info.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{info.blurb}</p>
        <p className="mt-2 text-sm font-semibold tabular-nums">
          {formatUSD(amountUsd)} → OUSD
        </p>
        <a
          href={info.docs}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
        >
          Banxa docs
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {configured === false ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Banxa is not configured yet. Add{" "}
          <code className="font-mono text-[11px]">BANXA_API_KEY</code>,{" "}
          <code className="font-mono text-[11px]">BANXA_PARTNER</code>, and{" "}
          <code className="font-mono text-[11px]">BANXA_SETTLEMENT_WALLET</code>{" "}
          (Lovable secrets / .env), then ask Banxa to enable Hosted Checkout for
          this method.
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl bg-card px-4 py-4">
          <p className="text-[12px] text-muted-foreground">
            Environment:{" "}
            <span className="font-semibold text-foreground">{envLabel}</span>
            {" · "}
            You’ll leave OpenPay Pro for Banxa checkout, then return here for
            OUSD credit.
          </p>
          <Button
            type="button"
            className="w-full rounded-full"
            disabled={busy || configured !== true}
            onClick={() => void startCheckout()}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {info.cta}
          </Button>
          {checkoutUrl ? (
            <a
              href={checkoutUrl}
              className="block text-center text-xs font-medium text-primary"
            >
              Open checkout again
            </a>
          ) : null}
          {(externalOrderId || banxaOrderId) && (
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full"
              disabled={syncing}
              onClick={() => void refreshStatus()}
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              I’ve paid — check status
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
