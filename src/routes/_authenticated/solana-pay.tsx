import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/wallet/PageHeader";
import { TxConfirmModal } from "@/components/wallet/TxConfirmModal";
import { HelioDepositPanel } from "@/components/helio-deposit-panel";
import { SolanaReceivePanel } from "@/components/solana-receive-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { donateOusd } from "@/lib/donate.functions";
import { donateWithPi, quotePiTopup } from "@/lib/pi-network";
import { SOLANA_MERCHANT_WALLET } from "@/lib/solana-payment";
import { OUSD_LOGO_URL, PI_NETWORK_LOGO_URL, USDC_LOGO_URL } from "@/lib/token-logos";
import { formatOUSD, formatUSD } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/solana-pay")({
  head: () => ({
    meta: [
      { title: "Donate — OpenPay Pro" },
      {
        name: "description",
        content:
          "Support OpenPay Pro — donate with OUSD, Pi, USDC, or Solana Pay.",
      },
    ],
  }),
  component: DonatePage,
});

type DonateMethod = "ousd" | "pi" | "usdc" | "solana";
type DonateStep = "amount" | "method" | "pay";

const SOL_LOGO = "https://assets.coingecko.com/coins/images/4128/large/solana.png";
const PRESETS = [5, 10, 25, 50, 100];

const METHODS: {
  id: DonateMethod;
  label: string;
  desc: string;
  logoUrl: string;
}[] = [
  {
    id: "ousd",
    label: "OUSD",
    desc: "From your OpenPay Pro balance → treasury",
    logoUrl: OUSD_LOGO_URL,
  },
  {
    id: "pi",
    label: "Pi Network",
    desc: "Pay with π · credits OpenPay Pro treasury",
    logoUrl: PI_NETWORK_LOGO_URL,
  },
  {
    id: "usdc",
    label: "USDC",
    desc: "MoonPay Commerce · USDC donation",
    logoUrl: USDC_LOGO_URL,
  },
  {
    id: "solana",
    label: "Solana",
    desc: "Solana Pay / Phantom · tip merchant wallet",
    logoUrl: SOL_LOGO,
  },
];

function DonatePage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const runDonateOusd = useServerFn(donateOusd);

  const [step, setStep] = useState<DonateStep>("amount");
  const [amount, setAmount] = useState("10");
  const [method, setMethod] = useState<DonateMethod>("ousd");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const amtNum = Number(amount);
  const amountValid = Number.isFinite(amtNum) && amtNum >= 0.01;

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("wallets")
          .select("id, name, address, ousd_balance")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  const { data: piQuote, isFetching: piQuoteLoading } = useQuery({
    queryKey: ["donate-pi-quote", amtNum],
    enabled: method === "pi" && amountValid && (step === "method" || step === "pay"),
    queryFn: () => quotePiTopup(amtNum),
    staleTime: 30_000,
  });

  const selected = METHODS.find((m) => m.id === method)!;
  const ousdBal = Number(wallet?.ousd_balance ?? 0);

  async function onDonateOusd() {
    setBusy(true);
    try {
      const res = await runDonateOusd({
        data: { amount: amtNum, walletId: wallet?.id },
      });
      toast.success(`Donated ${formatOUSD(res.amount)} — thank you!`);
      void qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
      void qc.invalidateQueries({ queryKey: ["wallets", user.id] });
      setConfirmOpen(false);
      setStep("amount");
    } catch (e) {
      toast.error((e as Error).message || "Donation failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDonatePi() {
    setBusy(true);
    try {
      const res = await donateWithPi(amtNum);
      toast.success(
        `Donated ~${formatOUSD(amtNum)} via ${res.piAmount.toFixed(4)} π — thank you!`,
      );
      setStep("amount");
    } catch (e) {
      toast.error((e as Error).message || "Pi donation cancelled");
    } finally {
      setBusy(false);
    }
  }

  function goPay() {
    if (method === "ousd") {
      setConfirmOpen(true);
      return;
    }
    if (method === "pi") {
      void onDonatePi();
      return;
    }
    setStep("pay");
  }

  const confirmRows = useMemo(
    () => [
      { label: "Amount", value: formatOUSD(amtNum), mono: true },
      { label: "From", value: wallet?.name || "Main Wallet" },
      { label: "To", value: "OpenPay Pro treasury" },
      {
        label: "Balance after",
        value: formatOUSD(Math.max(0, ousdBal - amtNum)),
        mono: true,
      },
    ],
    [amtNum, wallet?.name, ousdBal],
  );

  useEffect(() => {
    if (import.meta.env.DEV && !SOLANA_MERCHANT_WALLET) {
      console.warn("[donate] VITE_SOLANA_MERCHANT_WALLET is not set");
    }
  }, []);

  return (
    <div
      className={cn(
        "ot-phantom ph-page donate-page mx-auto flex w-full max-w-lg flex-col",
        "overflow-x-hidden overscroll-y-contain touch-manipulation",
        "px-1 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-0",
      )}
    >
      <PageHeader title="Donate" backTo="/dashboard" />
      <p className="mb-4 shrink-0 text-center text-sm text-muted-foreground md:text-left">
        Support OpenPay Pro — OUSD, Pi, USDC, or Solana
      </p>

      {/* —— Amount —— */}
      {step === "amount" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-col items-center px-2 pb-4 pt-2">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-muted/70 py-1.5 pl-1.5 pr-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-primary">
                <Heart className="h-3.5 w-3.5" fill="currentColor" />
              </span>
              <span className="text-sm font-semibold">Donation</span>
            </div>

            {/* Fixed-size amount box — prevents layout jump / zoom shake while typing */}
            <div className="donate-amount-box flex h-[4.75rem] w-full max-w-[min(100%,20rem)] items-center justify-center gap-1 overflow-hidden">
              <span className="shrink-0 text-3xl font-bold text-muted-foreground/80 sm:text-4xl">
                $
              </span>
              <Input
                value={amount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.]/g, "");
                  // Cap length so the field never overflows / reflows the page
                  setAmount(raw.slice(0, 10));
                }}
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                aria-label="Donation amount in USD"
                className={cn(
                  "donate-amount-input h-full min-w-0 flex-1 border-0 bg-transparent p-0",
                  "text-center text-[2.75rem] font-bold leading-none tabular-nums sm:text-5xl",
                  "shadow-none outline-none focus-visible:ring-0",
                  "md:text-5xl",
                )}
              />
            </div>

            <p className="mt-3 min-h-5 text-sm text-muted-foreground">
              {amountValid ? (
                <>
                  {formatOUSD(amtNum)}
                  <span className="text-muted-foreground/80"> · ≈ {formatUSD(amtNum)}</span>
                </>
              ) : (
                "Enter an amount"
              )}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                    amount === String(p)
                      ? "bg-foreground text-background"
                      : "bg-muted text-foreground hover:bg-muted/80",
                  )}
                >
                  ${p}
                </button>
              ))}
            </div>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Your OUSD bal {formatUSD(ousdBal)}
            </p>
          </div>

          <div className="mt-6 space-y-2 pb-2 pt-2">
            <Button
              type="button"
              disabled={!amountValid}
              onClick={() => setStep("method")}
              className="h-14 w-full rounded-full text-base font-bold"
            >
              Continue
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Next · choose how to donate
            </p>
          </div>
        </div>
      )}

      {/* —— Method —— */}
      {step === "method" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-4 shrink-0 rounded-2xl bg-card px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Heart className="h-5 w-5" fill="currentColor" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">You donate</p>
                <p className="truncate text-lg font-bold tabular-nums">{formatOUSD(amtNum)}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep("amount")}
                className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted/80"
              >
                Edit
              </button>
            </div>
          </div>

          <h2 className="mb-2 shrink-0 px-1 text-sm font-medium text-muted-foreground">
            Select a payment method
          </h2>
          <div className="shrink-0 overflow-hidden rounded-2xl bg-card">
            {METHODS.map((m, i) => {
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
                    i > 0 && "border-t border-border/60",
                    active && "bg-primary/8",
                  )}
                >
                  <img
                    src={m.logoUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                    draggable={false}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                      active ? "border-primary bg-primary" : "border-muted-foreground/40",
                    )}
                  >
                    {active ? <span className="h-2 w-2 rounded-full bg-primary-foreground" /> : null}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Reserved height — no jump when quote / error appears */}
          <div className="mt-3 min-h-10 px-1 text-xs text-muted-foreground">
            {method === "pi" && amountValid ? (
              piQuoteLoading ? (
                "Fetching π quote…"
              ) : piQuote ? (
                <>
                  ≈ {piQuote.piAmount.toFixed(4)} π @ ${piQuote.piUsdPrice.toFixed(4)}
                </>
              ) : (
                "Could not quote Pi"
              )
            ) : null}
            {method === "ousd" && amountValid && amtNum > ousdBal ? (
              <span className="font-medium text-destructive">
                Not enough OUSD — top up or pick another method
              </span>
            ) : null}
          </div>

          <div className="mt-4 space-y-2 pb-2">
            <Button
              type="button"
              disabled={
                busy ||
                !amountValid ||
                (method === "ousd" && amtNum > ousdBal) ||
                (method === "pi" && !piQuote)
              }
              onClick={goPay}
              className="h-14 w-full rounded-full text-base font-bold"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {method === "ousd"
                ? "Review donation"
                : method === "pi"
                  ? "Donate with Pi"
                  : `Continue with ${selected.label}`}
              {method === "usdc" || method === "solana" ? (
                <ChevronRight className="ml-1 h-4 w-4" />
              ) : null}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs font-semibold text-muted-foreground"
              onClick={() => setStep("amount")}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* —— Pay (USDC / Solana) —— */}
      {step === "pay" && (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden">
          <div className="shrink-0 rounded-2xl bg-card px-4 py-3.5">
            <div className="flex items-center gap-3">
              <img
                src={selected.logoUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
                draggable={false}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Donate via {selected.label}</p>
                <p className="text-lg font-bold tabular-nums">{formatUSD(amtNum)}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep("method")}
                className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
              >
                Change
              </button>
            </div>
          </div>

          {method === "usdc" ? (
            <div className="min-w-0 space-y-2 overflow-x-hidden">
              <p className="px-1 text-xs text-muted-foreground">
                Donation via USDC — settles to OpenPay Pro (not credited to your ledger).
              </p>
              <div className="donate-embed min-w-0 overflow-x-hidden rounded-2xl">
                <HelioDepositPanel
                  product="usdc"
                  amountUsd={amtNum}
                  onSuccess={() => {
                    toast.success("USDC donation received — thank you!");
                    setStep("amount");
                  }}
                />
              </div>
            </div>
          ) : null}

          {method === "solana" ? (
            <div className="min-w-0 space-y-2 overflow-x-hidden">
              <p className="px-1 text-xs text-muted-foreground">
                Solana Pay tip to the OpenPay Pro merchant wallet. Connect Phantom to pay, or scan
                the QR.
              </p>
              <div className="donate-embed min-w-0 overflow-x-hidden rounded-2xl">
                <SolanaReceivePanel
                  mode="tip"
                  amountUsd={amtNum}
                  creditOnSuccess={false}
                  merchantWallet={SOLANA_MERCHANT_WALLET || null}
                />
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="w-full text-center text-xs font-semibold text-muted-foreground"
            onClick={() => setStep("method")}
          >
            Back to methods
          </button>
        </div>
      )}

      <TxConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm donation"
        subtitle="OUSD leaves your Pro wallet for the OpenPay Pro treasury"
        rows={confirmRows}
        confirmLabel={busy ? "Donating…" : "Donate OUSD"}
        onConfirm={() => void onDonateOusd()}
        busy={busy}
      />
    </div>
  );
}
