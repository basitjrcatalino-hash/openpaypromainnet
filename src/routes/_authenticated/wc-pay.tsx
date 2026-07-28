/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/wallet/PageHeader";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import {
  buildCollectDataUrl,
  caip10AccountsForAddress,
  confirmWcPayment,
  connectEvmPayAccount,
  fetchPaymentOptions,
  fetchRequiredActions,
  isWalletConnectPayLink,
  normalizeWalletConnectPayLink,
  signPaymentActions,
  waitForCollectDataComplete,
  WALLETCONNECT_PAY_APP_ID,
  type PaymentOption,
  type PaymentOptionsResponse,
} from "@/lib/walletconnect-pay";

const searchSchema = z.object({
  link: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/wc-pay")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "WalletConnect Pay — OpenPay Pro" }] }),
  component: WalletConnectPayPage,
});

type Step = "link" | "options" | "collect" | "signing" | "done" | "error";

function WalletConnectPayPage() {
  const navigate = useNavigate();
  const { link: linkParam } = Route.useSearch();
  const { theme } = useTheme();
  const [linkInput, setLinkInput] = useState(linkParam ?? "");
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("link");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsRes, setOptionsRes] = useState<PaymentOptionsResponse | null>(null);
  const [selected, setSelected] = useState<PaymentOption | null>(null);
  const [collectUrl, setCollectUrl] = useState<string | null>(null);
  const [resultStatus, setResultStatus] = useState<string | null>(null);

  useEffect(() => {
    if (linkParam && isWalletConnectPayLink(linkParam)) {
      setLinkInput(linkParam);
    }
  }, [linkParam]);

  async function connectWallet() {
    setBusy(true);
    setError(null);
    try {
      const addr = await connectEvmPayAccount();
      setEvmAddress(addr);
      toast.success("EVM wallet connected for WalletConnect Pay");
    } catch (err) {
      const msg = (err as Error).message || "Could not connect wallet";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function loadOptions(rawLink?: string) {
    const link = (rawLink ?? linkInput).trim();
    if (!isWalletConnectPayLink(link)) {
      toast.error("Paste a WalletConnect Pay link (pay.walletconnect.com/…)");
      return;
    }
    if (!evmAddress) {
      toast.error("Connect an EVM wallet first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const accounts = caip10AccountsForAddress(evmAddress);
      const res = await fetchPaymentOptions(link, accounts);
      setOptionsRes(res);
      setStep("options");
      void navigate({
        to: "/wc-pay",
        search: { link: normalizeWalletConnectPayLink(link) },
        replace: true,
      });
    } catch (err) {
      const msg = (err as Error).message || "Failed to load payment options";
      setError(msg);
      setStep("error");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function chooseOption(option: PaymentOption) {
    setSelected(option);
    setError(null);

    if (option.collectData?.url) {
      const url = buildCollectDataUrl(option.collectData.url, {
        theme: theme === "light" ? "light" : "dark",
      });
      setCollectUrl(url);
      setStep("collect");
      setBusy(true);
      try {
        await waitForCollectDataComplete();
        setCollectUrl(null);
        await runSignAndConfirm(option);
      } catch (err) {
        const msg = (err as Error).message || "Data collection failed";
        setError(msg);
        setStep("error");
        toast.error(msg);
      } finally {
        setBusy(false);
      }
      return;
    }

    await runSignAndConfirm(option);
  }

  async function runSignAndConfirm(option: PaymentOption) {
    if (!optionsRes) return;
    setStep("signing");
    setBusy(true);
    setError(null);
    try {
      const actions = await fetchRequiredActions(optionsRes.paymentId, option.id);
      const signatures = await signPaymentActions(actions);
      const result = await confirmWcPayment({
        paymentId: optionsRes.paymentId,
        optionId: option.id,
        signatures,
      });
      setResultStatus(result.status);
      setStep("done");
      if (result.status === "succeeded" || result.status === "processing") {
        toast.success(
          result.status === "succeeded" ? "Payment successful" : "Payment processing",
        );
      } else {
        toast.error(`Payment ${result.status}`);
      }
    } catch (err) {
      const msg = (err as Error).message || "Payment failed";
      setError(msg);
      setStep("error");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const info = optionsRes?.info;

  return (
    <div className="ot-phantom mx-auto max-w-lg animate-page-in space-y-5 pb-28 pt-1">
      <PageHeader title="WalletConnect Pay" backTo="/dashboard" />

      <div className="rounded-3xl bg-card p-4">
        <div className="mb-1 text-xs font-medium text-muted-foreground">Pay Project ID</div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-foreground/80">
          <span className="truncate">{WALLETCONNECT_PAY_APP_ID}</span>
          <a
            href="https://docs.walletconnect.com/payments/wallets/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-primary"
            aria-label="WalletConnect Pay docs"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Scan or paste a merchant Pay link. Signing uses your browser EVM wallet (MetaMask /
          Phantom Ethereum).
        </p>
      </div>

      <div className="rounded-3xl bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold">EVM wallet</div>
            <div className="truncate font-mono text-xs text-muted-foreground">
              {evmAddress ?? "Not connected"}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant={evmAddress ? "secondary" : "default"}
            className="rounded-full"
            disabled={busy}
            onClick={() => void connectWallet()}
          >
            {busy && step === "link" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wallet className="mr-1.5 h-4 w-4" />
            )}
            {evmAddress ? "Switch" : "Connect"}
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="wc-pay-link">
            Payment link
          </label>
          <Input
            id="wc-pay-link"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="https://pay.walletconnect.com/pay_…"
            className="h-11 rounded-2xl border-0 bg-muted font-mono text-xs"
          />
          <Button
            type="button"
            className="h-11 w-full rounded-full font-semibold"
            disabled={busy || !evmAddress || !linkInput.trim()}
            onClick={() => void loadOptions()}
          >
            {busy && step === "link" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Load payment options
          </Button>
          <Button asChild variant="ghost" className="w-full rounded-full text-primary">
            <Link to="/scan">Scan QR instead</Link>
          </Button>
        </div>
      </div>

      {info && (
        <div className="rounded-3xl bg-card p-4">
          <div className="flex items-center gap-3">
            {info.merchant.iconUrl ? (
              <img
                src={info.merchant.iconUrl}
                alt=""
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                {(info.merchant.name?.[0] ?? "M").toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{info.merchant.name}</div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {info.amount.value} {info.amount.display.assetSymbol}
                {info.amount.display.networkName
                  ? ` · ${info.amount.display.networkName}`
                  : ""}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "options" && optionsRes && (
        <div className="space-y-2">
          <h2 className="px-1 text-sm font-bold">Choose how to pay</h2>
          <ul className="space-y-2">
            {optionsRes.options.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void chooseOption(opt)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left press hover:bg-muted/40",
                    selected?.id === opt.id && "ring-1 ring-primary",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold tabular-nums">
                      {opt.amount.value} {opt.amount.display.assetSymbol}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {opt.amount.display.networkName || opt.account}
                      {opt.collectData ? " · Info required" : ""}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">~{opt.etaS}s</span>
                </button>
              </li>
            ))}
          </ul>
          {optionsRes.options.length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">
              No payment options for this wallet on supported chains. Fund USDC/USDT on a supported
              network and try again.
            </p>
          )}
        </div>
      )}

      {step === "collect" && collectUrl && (
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card">
          <div className="border-b border-border/50 px-4 py-2 text-xs font-semibold">
            Complete required info
          </div>
          <iframe
            title="WalletConnect Pay data collection"
            src={collectUrl}
            className="h-[min(32rem,70vh)] w-full bg-background"
          />
        </div>
      )}

      {step === "signing" && (
        <div className="flex items-center gap-3 rounded-3xl bg-card px-4 py-5">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <div className="text-sm font-semibold">Confirm in your wallet</div>
            <p className="text-xs text-muted-foreground">Approve the signing requests to finish.</p>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="flex items-start gap-3 rounded-3xl bg-success/10 px-4 py-5 text-success">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-foreground">Payment {resultStatus}</div>
            <p className="text-xs text-muted-foreground">
              You can close this screen or start another payment.
            </p>
            <Button
              type="button"
              className="mt-3 rounded-full"
              onClick={() => {
                setStep("link");
                setOptionsRes(null);
                setSelected(null);
                setResultStatus(null);
              }}
            >
              Pay again
            </Button>
          </div>
        </div>
      )}

      {(step === "error" || error) && error && (
        <div className="flex items-start gap-3 rounded-3xl bg-destructive/10 px-4 py-4 text-destructive">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Something went wrong</div>
            <p className="text-xs text-muted-foreground wrap-break-word">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
