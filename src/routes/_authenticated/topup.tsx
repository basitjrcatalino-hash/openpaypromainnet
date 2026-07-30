import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Link2, CheckCircle2, CreditCard, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/wallet/PageHeader";
import { TxConfirmModal } from "@/components/wallet/TxConfirmModal";
import { HelioDepositPanel } from "@/components/helio-deposit-panel";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/wallet-utils";
import { topUpWithPi } from "@/lib/pi-network";
import { MoonPayBuyOverlay } from "@/components/moonpay-buy-overlay";
import { OUSD_LOGO_URL, PI_NETWORK_LOGO_URL, USDC_LOGO_URL } from "@/lib/token-logos";
import { creditMoonPayTopup } from "@/lib/moonpay-topup.functions";
import {
  createOpenPayTopupCharge,
  settleOpenPayCharge,
  settleOpenPayPayLinkTopup,
  getOpenPayLinkStatus,
} from "@/lib/openpay-pro.functions";
import { getPublicTopupInfo } from "@/lib/topup-admin.functions";
import { calcTopupFee } from "@/lib/topup-fee";

export const Route = createFileRoute("/_authenticated/topup")({
  head: () => ({ meta: [{ title: "Top Up — OpenPay Pro Wallet" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    openpay_charge: typeof s.openpay_charge === "string" ? s.openpay_charge : undefined,
    openpay_ref: typeof s.openpay_ref === "string" ? s.openpay_ref : undefined,
    openpay_tx: typeof s.openpay_tx === "string" ? s.openpay_tx : undefined,
    openpay_return: s.openpay_return ? "1" : undefined,
    openpay_cancel: s.openpay_cancel ? "1" : undefined,
  }),
  component: TopUpPage,
});

type Method = "openpay_balance" | "pi" | "moonpay" | "helio" | "usdc";
const methods: {
  id: Method;
  label: string;
  logoUrl?: string;
  icon?: LucideIcon;
  helioMark?: boolean;
  desc: string;
}[] = [
  {
    id: "openpay_balance",
    label: "OpenPay Balance",
    logoUrl: OUSD_LOGO_URL,
    desc: "Pay from your connected OpenPay account · real debit",
  },
  {
    id: "moonpay",
    label: "MoonPay",
    icon: CreditCard,
    desc: "Card / Apple Pay / Google Pay · MoonPay → OUSD",
  },
  {
    id: "pi",
    label: "Pi Network (π)",
    logoUrl: PI_NETWORK_LOGO_URL,
    desc: "Pay with Pi · live π price → OUSD ($1) credited instantly",
  },
  {
    id: "usdc",
    label: "USDC Pay",
    logoUrl: USDC_LOGO_URL,
    desc: "Pay with USDC · MoonPay Commerce → OUSD",
  },
  {
    id: "helio",
    label: "Crypto Deposit",
    helioMark: true,
    desc: "SOL / crypto · MoonPay Commerce → OUSD",
  },
];
const presets = [25, 50, 100, 250, 500, 1000];
const schema = z.object({
  amount: z.coerce.number().positive().min(0.01, "Minimum $0.01").max(50000),
});

const PENDING_CHARGE_KEY = "openpay_pending_charge";
const PENDING_PAYLINK_KEY = "openpay_pending_paylink";

function HelioMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4.8 17.5a.7.7 0 0 1 .5-.2h14.2a.35.35 0 0 1 .25.6l-1.7 1.7a.7.7 0 0 1-.5.2H3.35a.35.35 0 0 1-.25-.6l1.7-1.7Zm0-6.5a.7.7 0 0 1 .5-.2h14.2a.35.35 0 0 1 .25.6l-1.7 1.7a.7.7 0 0 1-.5.2H3.35a.35.35 0 0 1-.25-.6l1.7-1.7Zm15.65-4.9a.35.35 0 0 0-.25-.6H6.05a.7.7 0 0 0-.5.2L3.85 7.4a.35.35 0 0 0 .25.6h14.2a.7.7 0 0 0 .5-.2l1.65-1.7Z"
      />
    </svg>
  );
}

function TopUpPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/topup" });
  const [amount, setAmount] = useState("100");
  const [method, setMethod] = useState<Method>("openpay_balance");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** After confirm, show Helio / USDC deposit widget */
  const [depositReady, setDepositReady] = useState(false);
  const [moonpayVisible, setMoonpayVisible] = useState(false);
  const [moonpaySession, setMoonpaySession] = useState<{
    amount: number;
    externalTransactionId: string;
  } | null>(null);
  const [pendingPayLink, setPendingPayLink] = useState<{
    reference: string;
    amount: number;
    partner_username?: string;
  } | null>(null);

  const createCharge = useServerFn(createOpenPayTopupCharge);
  const settleCharge = useServerFn(settleOpenPayCharge);
  const settlePayLink = useServerFn(settleOpenPayPayLinkTopup);
  const getLink = useServerFn(getOpenPayLinkStatus);
  const creditMoonPay = useServerFn(creditMoonPayTopup);

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: openpayLink } = useQuery({
    queryKey: ["openpay-link", user.id],
    queryFn: () => getLink(),
  });

  const getTopupInfo = useServerFn(getPublicTopupInfo);
  const { data: topupInfo } = useQuery({
    queryKey: ["public-topup"],
    queryFn: () => getTopupInfo(),
  });

  const amtNum = Number(amount) || 0;
  const feeBps = Number(topupInfo?.fee_bps ?? 0);
  const feeBreakdown = calcTopupFee(amtNum, feeBps);
  const hasFee = feeBreakdown.fee > 0;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_PAYLINK_KEY);
      if (raw) setPendingPayLink(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Settle OpenPay hosted-checkout / pay-link returns
  useEffect(() => {
    if (search.openpay_cancel) {
      toast.error("OpenPay payment canceled — order not completed");
      try {
        sessionStorage.removeItem(PENDING_CHARGE_KEY);
        sessionStorage.removeItem(PENDING_PAYLINK_KEY);
      } catch {
        /* ignore */
      }
      setPendingPayLink(null);
      const u = new URL(window.location.href);
      u.searchParams.delete("openpay_cancel");
      u.searchParams.delete("openpay_ref");
      window.history.replaceState({}, "", u.toString());
      return;
    }

    // Pay-link return: auto-confirm credit
    if (search.openpay_return && (search.openpay_ref || pendingPayLink?.reference)) {
      const reference = search.openpay_ref || pendingPayLink?.reference;
      (async () => {
        try {
          const r = await settlePayLink({
            data: {
              reference,
              txId: search.openpay_tx,
              fromReturn: true,
            },
          });
          if (r.credited) {
            toast.success("OpenPay payment complete · OUSD credited");
            setPendingPayLink(null);
            try {
              sessionStorage.removeItem(PENDING_PAYLINK_KEY);
            } catch {
              /* ignore */
            }
            qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
            qc.invalidateQueries({ queryKey: ["wallets", user.id] });
            qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
            qc.invalidateQueries({ queryKey: ["ledger-entries"] });
            qc.invalidateQueries({ queryKey: ["ledger-overview"] });
          } else {
            toast.message(r.message || "Confirming payment…");
            // Keep pending card visible for manual confirm
            if (reference && !pendingPayLink) {
              setPendingPayLink({ reference, amount: Number(amount) || 0 });
            }
          }
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          const u = new URL(window.location.href);
          u.searchParams.delete("openpay_return");
          u.searchParams.delete("openpay_ref");
          u.searchParams.delete("openpay_tx");
          window.history.replaceState({}, "", u.toString());
        }
      })();
      return;
    }

    let chargeId = search.openpay_charge;
    if (!chargeId && search.openpay_return) {
      try {
        chargeId = sessionStorage.getItem(PENDING_CHARGE_KEY) ?? undefined;
      } catch {
        /* ignore */
      }
    }
    if (!chargeId) return;

    (async () => {
      try {
        const r = await settleCharge({ data: { chargeId } });
        if (r.credited) toast.success("OpenPay payment complete · OUSD credited");
        else toast.message(`OpenPay charge status: ${r.status}`);
        qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
        qc.invalidateQueries({ queryKey: ["wallets", user.id] });
        qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
        qc.invalidateQueries({ queryKey: ["ledger-entries"] });
        qc.invalidateQueries({ queryKey: ["ledger-overview"] });
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        try {
          sessionStorage.removeItem(PENDING_CHARGE_KEY);
        } catch {
          /* ignore */
        }
        const u = new URL(window.location.href);
        u.searchParams.delete("openpay_charge");
        u.searchParams.delete("openpay_return");
        u.searchParams.delete("openpay_cancel");
        window.history.replaceState({}, "", u.toString());
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.openpay_charge, search.openpay_return, search.openpay_cancel, search.openpay_ref]);

  async function confirmPayLink() {
    if (!pendingPayLink?.reference) {
      toast.error("No pending OpenPay payment");
      return;
    }
    setBusy(true);
    try {
      const r = await settlePayLink({
        data: {
          reference: pendingPayLink.reference,
          fromReturn: false,
        },
      });
      if (r.credited) {
        toast.success(`Topped up ${formatUSD(pendingPayLink.amount)} from OpenPay`);
        setPendingPayLink(null);
        try {
          sessionStorage.removeItem(PENDING_PAYLINK_KEY);
        } catch {
          /* ignore */
        }
        qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
        qc.invalidateQueries({ queryKey: ["wallets", user.id] });
        qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
        qc.invalidateQueries({ queryKey: ["ledger-entries"] });
        qc.invalidateQueries({ queryKey: ["ledger-overview"] });
      } else {
        toast.message(r.message || "Payment not found yet");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function settleMoonPayTopup(txId: string, paidAmount: number) {
    setBusy(true);
    try {
      const r = await creditMoonPay({
        data: {
          amount: paidAmount,
          moonpayTransactionId: txId,
          walletId: wallet?.id,
        },
      });
      if (r.alreadyCredited) {
        toast.message("This MoonPay payment was already credited");
      } else {
        toast.success(`MoonPay complete · ${formatUSD(r.amount)} OUSD credited`);
      }
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
      qc.invalidateQueries({ queryKey: ["wallets", user.id] });
      qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
      qc.invalidateQueries({ queryKey: ["ledger-entries"] });
      qc.invalidateQueries({ queryKey: ["ledger-overview"] });
      setAmount("");
    } catch (err) {
      toast.error((err as Error).message || "Could not credit MoonPay payment");
    } finally {
      setBusy(false);
      setMoonpayVisible(false);
      setMoonpaySession(null);
    }
  }

  function refreshAfterHelioDeposit() {
    qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
    qc.invalidateQueries({ queryKey: ["wallets", user.id] });
    qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
    qc.invalidateQueries({ queryKey: ["ledger-entries"] });
    qc.invalidateQueries({ queryKey: ["ledger-overview"] });
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (method === "helio" || method === "usdc") {
      setDepositReady(true);
      setConfirmOpen(false);
      return;
    }
    const parsed = schema.safeParse({ amount });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid");
      return;
    }

    setBusy(true);
    try {
      if (method === "moonpay") {
        if (!wallet?.id) {
          toast.error("Select an active wallet first");
          return;
        }
        const externalTransactionId = `ousd_${wallet.id}_${Date.now()}`;
        setMoonpaySession({
          amount: parsed.data.amount,
          externalTransactionId,
        });
        setMoonpayVisible(true);
        setConfirmOpen(false);
        return;
      }
      if (method === "openpay_balance") {
        if (!openpayLink?.linked) {
          toast.error("Connect OpenPay in Settings first");
          return;
        }
        if (!wallet?.id) {
          toast.error("Select an active wallet first");
          return;
        }
        const res = await createCharge({
          data: {
            amount: parsed.data.amount,
            origin: window.location.origin,
            walletId: wallet.id,
          },
        });
        if (res.mode === "checkout") {
          const charge = res.charge;
          if (!charge?.checkout_url || !charge?.id) {
            throw new Error("OpenPay did not return a checkout URL");
          }
          try {
            sessionStorage.setItem(PENDING_CHARGE_KEY, charge.id);
          } catch {
            /* ignore */
          }
          window.location.href = charge.checkout_url;
          return;
        }
        // Pay-link fallback: user pays @partner from their OpenPay balance
        const pending = {
          reference: res.reference,
          amount: res.amount,
          partner_username: res.partner_username,
        };
        setPendingPayLink(pending);
        try {
          sessionStorage.setItem(PENDING_PAYLINK_KEY, JSON.stringify(pending));
        } catch {
          /* ignore */
        }
        window.location.href = res.pay_url;
        return;
      }
      // pi
      const { paymentId } = await topUpWithPi(parsed.data.amount);
      toast.success(
        `Pi payment complete · ${parsed.data.amount} OUSD at live π price (${paymentId.slice(0, 8)}…)`,
      );
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
      qc.invalidateQueries({ queryKey: ["wallets", user.id] });
      qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
      qc.invalidateQueries({ queryKey: ["ledger-entries"] });
      qc.invalidateQueries({ queryKey: ["ledger-overview"] });
      setAmount("");
      setConfirmOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const linked = !!openpayLink?.linked;

  function openConfirm(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ amount });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid");
      return;
    }
    if (method === "openpay_balance" && !linked) {
      toast.error("Connect OpenPay in Settings first");
      return;
    }
    setConfirmOpen(true);
  }

  const cta =
    method === "moonpay"
      ? `Buy with MoonPay${amount ? ` · ${formatUSD(amtNum)}` : ""}`
      : method === "openpay_balance"
        ? linked
          ? `Pay ${amount ? formatUSD(amtNum) : ""} with OpenPay`
          : "Connect OpenPay to continue"
        : method === "helio"
          ? `Deposit ${amount ? formatUSD(amtNum) : ""} crypto`
          : method === "usdc"
            ? `Pay ${amount ? formatUSD(amtNum) : ""} with USDC`
            : `Top up ${amount ? formatUSD(amtNum) : ""}`;

  const payWithLabel =
    method === "moonpay"
      ? "Card (MoonPay)"
      : method === "pi"
        ? "Pi Network"
        : method === "usdc"
          ? "USDC Pay"
          : method === "helio"
            ? "Crypto Deposit (SOL)"
            : "OpenPay Balance";

  return (
    <div className="ot-phantom ph-page space-y-6 pb-8">
      <PageHeader title="Buy" backTo="/dashboard" />

      {/* Hero balance — Phantom-style */}
      <div className="px-1 text-center">
        <p className="text-sm text-muted-foreground">
          {wallet?.name ?? "Main Wallet"} · OUSD
        </p>
        <div className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-foreground">
          {formatUSD(Number(wallet?.ousd_balance ?? 0))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Add OUSD to your wallet</p>
      </div>

      {pendingPayLink && (
        <div className="overflow-hidden rounded-2xl bg-card">
          <div className="flex items-start gap-3 px-4 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Waiting for OpenPay payment</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Pay {formatUSD(pendingPayLink.amount)}
                  {pendingPayLink.partner_username
                    ? ` to @${pendingPayLink.partner_username}`
                    : ""}{" "}
                  from your OpenPay account, then confirm here.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-10 rounded-full px-5"
                  disabled={busy}
                  onClick={confirmPayLink}
                >
                  {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Confirm payment
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 rounded-full px-4 text-muted-foreground"
                  onClick={() => {
                    setPendingPayLink(null);
                    try {
                      sessionStorage.removeItem(PENDING_PAYLINK_KEY);
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={openConfirm} className="space-y-6">
        {/* Amount */}
        <section>
          <Label
            htmlFor="topup-amount"
            className="mb-3 block text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Amount
          </Label>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl font-bold text-muted-foreground">$</span>
            <Input
              id="topup-amount"
              value={amount}
              onChange={(e) => {
                setDepositReady(false);
                setAmount(e.target.value);
              }}
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.]?[0-9]*"
              required
              aria-label="Top up amount in USD"
              className="h-auto w-full max-w-48 border-0 bg-transparent p-0 text-center text-5xl font-bold tabular-nums shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setDepositReady(false);
                  setAmount(String(p));
                }}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-xs font-semibold press",
                  amount === String(p)
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                ${p}
              </button>
            ))}
          </div>
          {hasFee && amtNum > 0 && (
            <div className="mt-4 rounded-2xl bg-muted/50 px-4 py-3 text-center text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <span>Top-up fee ({(feeBps / 100).toFixed(2)}%)</span>
                <span className="font-semibold tabular-nums text-destructive">
                  −{formatUSD(feeBreakdown.fee)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-border/50 pt-1.5">
                <span className="font-medium text-foreground">You receive</span>
                <span className="text-sm font-bold tabular-nums text-foreground">
                  {formatUSD(feeBreakdown.net)} OUSD
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Payment method — flat Phantom list */}
        <section>
          <h2 className="mb-2 px-1 text-sm text-muted-foreground">Pay with</h2>
          <div className="overflow-hidden rounded-2xl bg-card">
            {methods.map((m, i) => {
              const selected = method === m.id;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMethod(m.id);
                    setDepositReady(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-muted/40",
                    i > 0 && "border-t border-border/60",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-11 w-11 place-items-center overflow-hidden rounded-full",
                      selected ? "bg-primary/15 ring-2 ring-primary/40" : "bg-muted",
                      m.id === "moonpay" && "bg-[#7D00FE]/15 text-[#7D00FE]",
                      m.id === "helio" && "bg-[#9945FF]/15 text-[#9945FF]",
                      m.id === "usdc" && "bg-[#2775CA]/15",
                    )}
                  >
                    {m.logoUrl ? (
                      <img src={m.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : m.helioMark ? (
                      <HelioMark className="h-5 w-5" />
                    ) : Icon ? (
                      <Icon className="h-5 w-5" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">{m.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{m.desc}</div>
                  </div>
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                      selected ? "border-primary bg-primary" : "border-muted-foreground/40",
                    )}
                    aria-hidden
                  >
                    {selected ? (
                      <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {method === "moonpay" && (
          <p className="px-1 text-center text-xs leading-relaxed text-muted-foreground">
            Opens the MoonPay widget to pay with card. When the purchase completes,{" "}
            <span className="font-medium text-foreground">
              {wallet?.name ?? "your wallet"}
            </span>{" "}
            is credited 1:1 in OUSD (sandbox key · test cards in MoonPay dashboard).
          </p>
        )}

        {method === "helio" && (
          <p className="px-1 text-center text-xs leading-relaxed text-muted-foreground">
            Pay with SOL or other crypto via MoonPay Commerce — funds settle to OpenPay Pro,
            then{" "}
            <span className="font-medium text-foreground">
              {wallet?.name ?? "your wallet"}
            </span>{" "}
            is credited in OUSD when the deposit confirms.
          </p>
        )}

        {method === "usdc" && (
          <p className="px-1 text-center text-xs leading-relaxed text-muted-foreground">
            Pay with USDC via MoonPay Commerce — then{" "}
            <span className="font-medium text-foreground">
              {wallet?.name ?? "your wallet"}
            </span>{" "}
            is credited 1:1 in OUSD when the deposit confirms.
          </p>
        )}

        {method === "openpay_balance" && (
          <p className="px-1 text-center text-xs leading-relaxed text-muted-foreground">
            {linked ? (
              <>
                Paying from connected OpenPay
                {openpayLink?.username
                  ? ` @${openpayLink.username}`
                  : openpayLink?.account_number
                    ? ` · ${openpayLink.account_number}`
                    : ""}
                . Confirm on OpenPay — balance is debited, then{" "}
                <span className="font-medium text-foreground">
                  {wallet?.name ?? "your wallet"}
                </span>{" "}
                is credited.
              </>
            ) : (
              <>
                Connect OpenPay in Settings first.{" "}
                <Link to="/settings" className="inline-flex items-center gap-1 font-semibold text-primary">
                  <Link2 className="h-3.5 w-3.5" />
                  Connect
                </Link>
              </>
            )}
          </p>
        )}

        {method === "helio" || method === "usdc" ? (
          depositReady ? (
            <div className="space-y-3">
              <HelioDepositPanel
                product={method === "usdc" ? "usdc" : "crypto"}
                amountUsd={amtNum}
                onSuccess={refreshAfterHelioDeposit}
              />
              <p className="text-center text-[11px] text-muted-foreground">
                {method === "usdc"
                  ? `Pay exactly $${amtNum >= 1 ? amtNum.toFixed(2) : "—"} USDC · 1 OUSD = $1.00`
                  : `Pay $${amtNum >= 1 ? amtNum.toFixed(2) : "—"} via SOL/crypto · 1 OUSD = $1.00`}
              </p>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setDepositReady(false)}
              >
                Change amount or method
              </Button>
            </div>
          ) : (
            <div className="pt-1">
              <Button
                type="submit"
                disabled={busy || amtNum < 1}
                className="h-14 w-full rounded-full text-base font-semibold"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {cta}
              </Button>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Confirm first · then pay exactly {amtNum >= 1 ? formatUSD(amtNum) : "—"}
              </p>
            </div>
          )
        ) : (
          <div className="pt-1">
            <Button
              type="submit"
              disabled={
                busy ||
                (method === "openpay_balance" && !linked) ||
                amtNum < 1
              }
              className="h-14 w-full rounded-full text-base font-semibold"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {cta}
            </Button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              {method === "moonpay"
                ? "Confirm · then MoonPay card checkout (signed URL)"
                : "1 OUSD = $1.00 · credited to your active wallet"}
            </p>
          </div>
        )}
      </form>

      <TxConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm top-up"
        description="Review your OUSD purchase"
        amount={formatUSD(amtNum)}
        subtitle="OUSD · 1:1 with USD"
        rows={[
          { label: "Asset", value: "OUSD" },
          { label: "You pay", value: formatUSD(amtNum) },
          { label: "Pay with", value: payWithLabel },
          {
            label: "Wallet",
            value: wallet?.name ?? "Active wallet",
          },
        ]}
        confirmLabel={cta}
        busy={busy}
        variant={method === "openpay_balance" ? "openpay" : "default"}
        onConfirm={() => {
          void submit();
        }}
      />

      {moonpaySession ? (
        <MoonPayBuyOverlay
          visible={moonpayVisible}
          amount={moonpaySession.amount}
          externalCustomerId={user.id}
          externalTransactionId={moonpaySession.externalTransactionId}
          onClose={() => {
            setMoonpayVisible(false);
            setMoonpaySession(null);
            setBusy(false);
          }}
          onTransactionCompleted={async ({ id, baseCurrencyAmount, status }) => {
            if (status && status !== "completed") {
              toast.message(`MoonPay status: ${status}`);
              setMoonpayVisible(false);
              return;
            }
            const paid = Number(baseCurrencyAmount) || moonpaySession.amount;
            await settleMoonPayTopup(id, paid);
          }}
        />
      ) : null}
    </div>
  );
}
