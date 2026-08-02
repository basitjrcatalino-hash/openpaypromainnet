import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Heart, Link2, Loader2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";

import { PageHeader } from "@/components/wallet/PageHeader";
import { TxConfirmModal } from "@/components/wallet/TxConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  createOpenPayDonateCheckout,
  donateOusd,
  donateWithLedgerAsset,
  settleOpenPayDonate,
  type DonateLedgerAsset,
} from "@/lib/donate.functions";
import { donateWithPi, quotePiTopup } from "@/lib/pi-network";
import { getOpenPayLinkStatus } from "@/lib/openpay-pro.functions";
import { fetchMajorUsdPrices } from "@/lib/ledger-majors";
import {
  OUSD_LOGO_URL,
  PI_NETWORK_LOGO_URL,
  SOL_LOGO_URL,
  USDC_LOGO_URL,
  USDT_LOGO_URL,
} from "@/lib/token-logos";
import { formatNumber, formatOUSD, formatUSD } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/solana-pay")({
  head: () => ({
    meta: [
      { title: "Donate — OpenPay Pro" },
      {
        name: "description",
        content:
          "Support OpenPay Pro — donate with OUSD balance, USDT, USDC, SOL, Pi, or OpenPay payment link.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    donate_return: s.donate_return ? "1" : undefined,
    donate_cancel: s.donate_cancel ? "1" : undefined,
  }),
  component: DonatePage,
});

type DonateMethod =
  | "ousd"
  | "wallet_usdt"
  | "wallet_usdc"
  | "wallet_sol"
  | "pi"
  | "openpay_balance";

type DonateStep = "amount" | "method";

type WalletLedgerMethod = "wallet_usdt" | "wallet_usdc" | "wallet_sol";

const WALLET_LEDGER_ASSET: Record<WalletLedgerMethod, DonateLedgerAsset> = {
  wallet_usdt: "USDT",
  wallet_usdc: "USDC",
  wallet_sol: "SOL",
};

function isWalletLedgerMethod(m: DonateMethod): m is WalletLedgerMethod {
  return m === "wallet_usdt" || m === "wallet_usdc" || m === "wallet_sol";
}

const PRESETS = [5, 10, 25, 50, 100];

const METHODS: {
  id: DonateMethod;
  label: string;
  desc: string;
  logoUrl?: string;
  icon?: LucideIcon;
}[] = [
  {
    id: "ousd",
    label: "OUSD balance",
    desc: "From your OpenPay Pro wallet → treasury",
    logoUrl: OUSD_LOGO_URL,
  },
  {
    id: "wallet_usdt",
    label: "USDT",
    desc: "Pay with your OpenPay Pro USDT · → treasury 1:1",
    logoUrl: USDT_LOGO_URL,
  },
  {
    id: "wallet_usdc",
    label: "USDC",
    desc: "Pay with your OpenPay Pro USDC · → treasury 1:1",
    logoUrl: USDC_LOGO_URL,
  },
  {
    id: "wallet_sol",
    label: "SOL",
    desc: "Pay with your OpenPay Pro SOL · live price → treasury",
    logoUrl: SOL_LOGO_URL,
  },
  {
    id: "pi",
    label: "Pi Network",
    desc: "Pay with π · credits OpenPay Pro treasury",
    logoUrl: PI_NETWORK_LOGO_URL,
  },
  {
    id: "openpay_balance",
    label: "OUSD payment link",
    desc: "Pay from your linked OpenPay account · payment link",
    logoUrl: OUSD_LOGO_URL,
  },
];

function DonatePage() {
  const { user } = Route.useRouteContext();
  const search = useSearch({ from: "/_authenticated/solana-pay" });
  const qc = useQueryClient();
  const runDonateOusd = useServerFn(donateOusd);
  const runDonateLedger = useServerFn(donateWithLedgerAsset);
  const createDonateCheckout = useServerFn(createOpenPayDonateCheckout);
  const settleDonate = useServerFn(settleOpenPayDonate);
  const getLink = useServerFn(getOpenPayLinkStatus);

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
          .select("id, name, address, ousd_balance, usdt_balance, usdc_balance, sol_balance")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  const { data: openpayLink } = useQuery({
    queryKey: ["openpay-link", user.id],
    queryFn: () => getLink(),
  });
  const linked = !!openpayLink?.linked;

  const { data: piQuote, isFetching: piQuoteLoading } = useQuery({
    queryKey: ["donate-pi-quote", amtNum],
    enabled: method === "pi" && amountValid && step === "method",
    queryFn: () => quotePiTopup(amtNum),
    staleTime: 30_000,
  });

  const { data: solPrice } = useQuery({
    queryKey: ["donate-sol-price"],
    enabled: method === "wallet_sol" && amountValid && step === "method",
    queryFn: async () => {
      const prices = await fetchMajorUsdPrices(["sol"]);
      return Number(prices.sol) || 0;
    },
    staleTime: 30_000,
  });

  const selected = METHODS.find((m) => m.id === method)!;
  const ousdBal = Number(wallet?.ousd_balance ?? 0);
  const usdtBal = Number(wallet?.usdt_balance ?? 0);
  const usdcBal = Number(wallet?.usdc_balance ?? 0);
  const solBal = Number(wallet?.sol_balance ?? 0);

  const ledgerNeed =
    method === "wallet_usdt"
      ? amtNum
      : method === "wallet_usdc"
        ? amtNum
        : method === "wallet_sol" && solPrice && solPrice > 0
          ? amtNum / solPrice
          : null;

  const ledgerHave =
    method === "wallet_usdt"
      ? usdtBal
      : method === "wallet_usdc"
        ? usdcBal
        : method === "wallet_sol"
          ? solBal
          : null;

  const ledgerShort =
    isWalletLedgerMethod(method) &&
    ledgerNeed != null &&
    ledgerHave != null &&
    ledgerHave + 1e-12 < ledgerNeed;

  useEffect(() => {
    if (!search.donate_return) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await settleDonate();
        if (cancelled) return;
        if (res.amount) {
          notifySuccess(`Donated ${formatOUSD(res.amount)} via OpenPay — thank you!`, {
            sound: "send",
          });
        } else {
          notifySuccess("OpenPay donation received — thank you!", { sound: "send" });
        }
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message || "Could not confirm donation");
      } finally {
        if (!cancelled) {
          window.history.replaceState({}, "", "/solana-pay");
          setStep("amount");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.donate_return, settleDonate]);

  useEffect(() => {
    if (!search.donate_cancel) return;
    toast.message("Donation cancelled");
    window.history.replaceState({}, "", "/solana-pay");
  }, [search.donate_cancel]);

  async function onDonateOusd() {
    setBusy(true);
    try {
      const res = await runDonateOusd({
        data: { amount: amtNum, walletId: wallet?.id },
      });
      notifySuccess(`Donated ${formatOUSD(res.amount)} — thank you!`, { sound: "send" });
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

  async function onDonateLedger() {
    if (!isWalletLedgerMethod(method)) return;
    setBusy(true);
    try {
      const payAsset = WALLET_LEDGER_ASSET[method];
      const res = await runDonateLedger({
        data: { amount: amtNum, pay_asset: payAsset, walletId: wallet?.id },
      });
      notifySuccess(`Donated ${formatOUSD(res.amount)} via ${payAsset} — thank you!`, {
        sound: "send",
      });
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
      notifySuccess(
        `Donated ~${formatOUSD(amtNum)} via ${res.piAmount.toFixed(4)} π — thank you!`,
        { sound: "send" },
      );
      setStep("amount");
    } catch (e) {
      toast.error((e as Error).message || "Pi donation cancelled");
    } finally {
      setBusy(false);
    }
  }

  async function onDonateOpenPay() {
    if (!linked) {
      toast.error("Connect OpenPay in Settings first");
      return;
    }
    setBusy(true);
    try {
      const origin = window.location.origin;
      const res = await createDonateCheckout({ data: { amount: amtNum, origin } });
      const url =
        res.mode === "checkout"
          ? (res.charge as { checkout_url?: string })?.checkout_url
          : res.pay_url;
      if (!url) throw new Error("OpenPay checkout URL missing");
      window.location.assign(url);
    } catch (e) {
      toast.error((e as Error).message || "Could not start OpenPay donation");
      setBusy(false);
    }
  }

  function goPay() {
    if (method === "ousd" || isWalletLedgerMethod(method)) {
      setConfirmOpen(true);
      return;
    }
    if (method === "pi") {
      void onDonatePi();
      return;
    }
    if (method === "openpay_balance") {
      void onDonateOpenPay();
    }
  }

  const confirmRows = useMemo(() => {
    if (isWalletLedgerMethod(method)) {
      const asset = WALLET_LEDGER_ASSET[method];
      const payLabel =
        method === "wallet_sol" && ledgerNeed != null
          ? `${formatNumber(ledgerNeed, ledgerNeed < 1 ? 6 : 4)} SOL`
          : formatUSD(amtNum).replace("$", "") + ` ${asset}`;
      return [
        { label: "You donate", value: formatOUSD(amtNum), mono: true },
        { label: "Pay with", value: payLabel, mono: true },
        { label: "From", value: wallet?.name || "Main Wallet" },
        { label: "To", value: "OpenPay Pro treasury" },
      ];
    }
    return [
      { label: "Amount", value: formatOUSD(amtNum), mono: true },
      { label: "From", value: wallet?.name || "Main Wallet" },
      { label: "To", value: "OpenPay Pro treasury" },
      {
        label: "Balance after",
        value: formatOUSD(Math.max(0, ousdBal - amtNum)),
        mono: true,
      },
    ];
  }, [amtNum, wallet?.name, ousdBal, method, ledgerNeed]);

  const continueLabel =
    method === "ousd"
      ? "Review donation"
      : method === "pi"
        ? "Donate with Pi"
        : method === "openpay_balance"
          ? linked
            ? "Continue with payment link"
            : "Connect OpenPay to continue"
          : isWalletLedgerMethod(method)
            ? `Review ${WALLET_LEDGER_ASSET[method]} donation`
            : `Continue with ${selected.label}`;

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
        Support OpenPay Pro — OUSD, USDT, USDC, SOL, Pi, or payment link
      </p>

      {step === "amount" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-col items-center px-2 pb-4 pt-2">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-muted/70 py-1.5 pl-1.5 pr-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-primary">
                <Heart className="h-3.5 w-3.5" fill="currentColor" />
              </span>
              <span className="text-sm font-semibold">Donation</span>
            </div>

            <div className="donate-amount-box flex h-19 w-full max-w-[min(100%,20rem)] items-center justify-center gap-1 overflow-hidden">
              <span className="shrink-0 text-3xl font-bold text-muted-foreground/80 sm:text-4xl">
                $
              </span>
              <Input
                value={amount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.]/g, "");
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
              OUSD {formatUSD(ousdBal)} · USDT {formatNumber(usdtBal, 2)} · USDC{" "}
              {formatNumber(usdcBal, 2)} · SOL {formatNumber(solBal, 4)}
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
              const disabled = m.id === "openpay_balance" && !linked;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
                    i > 0 && "border-t border-border/60",
                    active && "bg-primary/8",
                    disabled && "opacity-50",
                  )}
                >
                  {m.logoUrl ? (
                    <img
                      src={m.logoUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                      draggable={false}
                    />
                  ) : m.icon ? (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
                      <m.icon className="h-5 w-5" />
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{m.label}</p>
                      {m.id === "openpay_balance" && linked ? (
                        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          Linked
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {disabled ? "Connect OpenPay in Settings" : m.desc}
                    </p>
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

          <div className="mt-3 min-h-10 px-1 text-xs text-muted-foreground">
            {method === "openpay_balance" && !linked ? (
              <p>
                <Link
                  to="/settings"
                  className="inline-flex items-center gap-1 font-semibold text-primary"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Connect OpenPay
                </Link>{" "}
                to donate with a payment link.
              </p>
            ) : null}
            {method === "pi" && amountValid ? (
              piQuoteLoading ? (
                "Fetching π quote…"
              ) : piQuote ? (
                <>≈ {piQuote.piAmount.toFixed(4)} π @ ${piQuote.piUsdPrice.toFixed(4)}</>
              ) : (
                "Could not quote Pi"
              )
            ) : null}
            {method === "ousd" && amountValid && amtNum > ousdBal ? (
              <span className="font-medium text-destructive">
                Not enough OUSD — top up or pick another method
              </span>
            ) : null}
            {ledgerShort ? (
              <span className="font-medium text-destructive">
                Not enough {WALLET_LEDGER_ASSET[method as WalletLedgerMethod]} — top up or pick
                another method
              </span>
            ) : null}
            {method === "wallet_sol" && amountValid && solPrice && solPrice > 0 && !ledgerShort ? (
              <>≈ {formatNumber(amtNum / solPrice, 6)} SOL @ ${solPrice.toFixed(2)}</>
            ) : null}
          </div>

          <div className="mt-4 space-y-2 pb-2">
            <Button
              type="button"
              disabled={
                busy ||
                !amountValid ||
                (method === "ousd" && amtNum > ousdBal) ||
                ledgerShort ||
                (method === "pi" && !piQuote) ||
                (method === "openpay_balance" && !linked)
              }
              onClick={goPay}
              className={cn(
                "h-14 w-full rounded-full text-base font-bold",
                method === "openpay_balance" &&
                  "bg-[#0070BA] text-white hover:bg-[#0070BA]/90 hover:text-white",
              )}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {continueLabel}
              {method === "openpay_balance" && linked ? (
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

      <TxConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm donation"
        subtitle={
          isWalletLedgerMethod(method)
            ? `${WALLET_LEDGER_ASSET[method]} leaves your Pro wallet for the OpenPay Pro treasury`
            : "OUSD leaves your Pro wallet for the OpenPay Pro treasury"
        }
        rows={confirmRows}
        confirmLabel={
          busy
            ? "Donating…"
            : isWalletLedgerMethod(method)
              ? `Donate ${WALLET_LEDGER_ASSET[method]}`
              : "Donate OUSD"
        }
        onConfirm={() => {
          if (isWalletLedgerMethod(method)) void onDonateLedger();
          else void onDonateOusd();
        }}
        busy={busy}
      />
    </div>
  );
}
