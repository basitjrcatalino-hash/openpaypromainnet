import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Link2, CheckCircle2, CreditCard, ChevronRight, Building2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/wallet/PageHeader";
import { TxConfirmModal } from "@/components/wallet/TxConfirmModal";
import { TopupFeesNotice } from "@/components/wallet/TopupFeesNotice";
import { HelioDepositPanel } from "@/components/helio-deposit-panel";
import { SolanaReceivePanel } from "@/components/solana-receive-panel";
import { CircleMintDepositPanel } from "@/components/circle-mint-deposit-panel";
import { CashPayDepositPanel } from "@/components/cash-pay-deposit-panel";
import { BanxaDepositPanel } from "@/components/banxa-deposit-panel";
import { cn } from "@/lib/utils";
import { formatNumber, formatOUSD, formatUSD } from "@/lib/wallet-utils";
import { useCurrency } from "@/lib/currency";
import { topUpWithPi, quotePiTopup } from "@/lib/pi-network";
import { MoonPayBuyOverlay } from "@/components/moonpay-buy-overlay";
import { OUSD_LOGO_URL, PI_NETWORK_LOGO_URL, USDC_LOGO_URL } from "@/lib/token-logos";
import { MAJOR_TOKENS } from "@/lib/major-tokens";
import { isBanxaTopupMethod, type BanxaTopupMethodKey } from "@/lib/topup-methods";
import { creditMoonPayTopup } from "@/lib/moonpay-topup.functions";
import {
  createOpenPayTopupCharge,
  settleOpenPayCharge,
  settleOpenPayPayLinkTopup,
  getOpenPayLinkStatus,
} from "@/lib/openpay-pro.functions";
import { getPublicTopupInfo, listTopupMethods } from "@/lib/topup-admin.functions";
import { calcTopupFee } from "@/lib/topup-fee";

export const Route = createFileRoute("/_authenticated/topup")({
  head: () => ({ meta: [{ title: "Top Up — OpenPay Pro Wallet" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    openpay_charge: typeof s.openpay_charge === "string" ? s.openpay_charge : undefined,
    openpay_ref: typeof s.openpay_ref === "string" ? s.openpay_ref : undefined,
    openpay_tx: typeof s.openpay_tx === "string" ? s.openpay_tx : undefined,
    openpay_return: s.openpay_return ? "1" : undefined,
    openpay_cancel: s.openpay_cancel ? "1" : undefined,
    banxa_return: s.banxa_return ? "1" : undefined,
    banxa_ext: typeof s.banxa_ext === "string" ? s.banxa_ext : undefined,
  }),
  component: TopUpPage,
});

type Method =
  | "openpay_balance"
  | "pi"
  | "moonpay"
  | "helio"
  | "usdc"
  | "solana_pay"
  | "circle_mint"
  | "cash_pay"
  | BanxaTopupMethodKey;
type BuyStep = "amount" | "method" | "deposit";
const methods: {
  id: Method;
  label: string;
  logoUrl?: string;
  icon?: LucideIcon;
  helioMark?: boolean;
  solanaMark?: boolean;
  circleMark?: boolean;
  banxaMark?: boolean;
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
    id: "banxa_apple_pay",
    label: "Apple Pay",
    banxaMark: true,
    desc: "Banxa · Apple Pay → OUSD",
  },
  {
    id: "banxa_google_pay",
    label: "Google Pay",
    banxaMark: true,
    desc: "Banxa · Google Pay → OUSD",
  },
  {
    id: "banxa_card",
    label: "Card",
    icon: CreditCard,
    desc: "Banxa · debit / credit card → OUSD",
  },
  {
    id: "banxa_bank",
    label: "Bank Transfer",
    icon: Building2,
    desc: "Banxa · ACH / SEPA / Faster Payments / PayID → OUSD",
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
  {
    id: "solana_pay",
    label: "Solana Pay",
    solanaMark: true,
    desc: "Commerce Kit · wallet connect, PaymentButton, Solana Pay QR → OUSD",
  },
  {
    id: "circle_mint",
    label: "Circle Deposit",
    circleMark: true,
    desc: "Circle Mint · USDC payin (payment intent + list payments) → OUSD",
  },
  {
    id: "cash_pay",
    label: "Pay with CASH",
    logoUrl: MAJOR_TOKENS.cash.logoUrl,
    desc: "Phantom CASH · wallet balance or Solana Pay SPL → OUSD 1:1",
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
  const [amount, setAmount] = useState("25");
  const [method, setMethod] = useState<Method>("openpay_balance");
  const [step, setStep] = useState<BuyStep>("amount");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** After confirm, show Helio / USDC deposit widget */
  const [depositReady, setDepositReady] = useState(false);
  const { code: displayCurrency } = useCurrency();
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

  const listMethodsFn = useServerFn(listTopupMethods);
  const { data: methodConfig } = useQuery({
    queryKey: ["topup-methods"],
    queryFn: () => listMethodsFn(),
  });

  const visibleMethods = useMemo(() => {
    if (!methodConfig?.length) return methods;
    type MethodCfg = {
      method_key: string;
      label?: string | null;
      description?: string | null;
      enabled?: boolean | null;
      sort_order?: number | null;
    };
    const rows = methodConfig as MethodCfg[];
    const byKey = new Map(rows.map((c) => [c.method_key, c]));
    // Hide only when admin explicitly disabled (maintenance). Missing row → still show.
    return methods
      .filter((m) => {
        const c = byKey.get(m.id);
        return !c || c.enabled !== false;
      })
      .map((m) => {
        const c = byKey.get(m.id);
        return c ? { ...m, label: c.label || m.label, desc: c.description || m.desc } : m;
      })
      .sort(
        (a, b) =>
          Number(byKey.get(a.id)?.sort_order ?? 0) - Number(byKey.get(b.id)?.sort_order ?? 0),
      );
  }, [methodConfig]);

  const visibleMethodIds = useMemo(() => visibleMethods.map((m) => m.id).join(","), [visibleMethods]);

  useEffect(() => {
    if (visibleMethods.length && !visibleMethods.some((m) => m.id === method)) {
      setMethod(visibleMethods[0].id);
    }
  }, [visibleMethodIds, method, visibleMethods]);


  const amtNum = Number(amount) || 0;
  const feeBps = Number(topupInfo?.fee_bps ?? 0);
  const feeBreakdown = calcTopupFee(amtNum, feeBps);
  const hasFee = feeBreakdown.fee > 0;
  const amountValid = amtNum >= 0.01 && amtNum <= 50_000;

  const { data: piQuote, isFetching: piQuoteLoading } = useQuery({
    queryKey: ["pi-topup-quote", amtNum],
    queryFn: () => quotePiTopup(amtNum),
    enabled: method === "pi" && amountValid,
    staleTime: 30_000,
  });

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

  const refreshAfterHelioDeposit = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
    qc.invalidateQueries({ queryKey: ["wallets", user.id] });
    qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
    qc.invalidateQueries({ queryKey: ["ledger-entries"] });
    qc.invalidateQueries({ queryKey: ["ledger-overview"] });
  }, [qc, user.id, wallet?.id]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (
      method === "helio" ||
      method === "usdc" ||
      method === "solana_pay" ||
      method === "circle_mint" ||
      method === "cash_pay" ||
      isBanxaTopupMethod(method)
    ) {
      setDepositReady(true);
      setConfirmOpen(false);
      setStep("deposit");
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
  const selectedMethod = visibleMethods.find((m) => m.id === method);

  function goToMethod() {
    const parsed = schema.safeParse({ amount });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Enter a valid amount");
      return;
    }
    setDepositReady(false);
    setStep("method");
  }

  function openConfirm(e?: FormEvent) {
    e?.preventDefault();
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

  function handleHeaderBack() {
    if (step === "deposit") {
      setDepositReady(false);
      setStep("method");
      return;
    }
    if (step === "method") {
      setStep("amount");
      return;
    }
  }

  const cta =
    method === "moonpay"
      ? `Continue with MoonPay`
      : method === "openpay_balance"
        ? linked
          ? `Pay with OpenPay`
          : "Connect OpenPay to continue"
        : method === "helio"
          ? `Continue with crypto`
          : method === "usdc"
            ? `Continue with USDC`
            : method === "solana_pay"
              ? `Continue with Solana Pay`
              : method === "circle_mint"
                ? `Continue with Circle`
                : method === "cash_pay"
                  ? `Continue with CASH`
                  : method === "banxa_apple_pay"
                    ? `Continue with Apple Pay`
                    : method === "banxa_google_pay"
                      ? `Continue with Google Pay`
                      : method === "banxa_card"
                        ? `Continue with card`
                        : method === "banxa_bank"
                          ? `Continue with bank transfer`
                          : `Continue with Pi`;

  const payWithLabel =
    method === "moonpay"
      ? "Card (MoonPay)"
      : method === "pi"
        ? "Pi Network"
        : method === "usdc"
          ? "USDC Pay"
          : method === "helio"
            ? "Crypto Deposit (SOL)"
            : method === "solana_pay"
              ? "Solana Pay"
              : method === "circle_mint"
                ? "Circle Mint"
                : method === "cash_pay"
                  ? "CASH"
                  : method === "banxa_apple_pay"
                    ? "Apple Pay (Banxa)"
                    : method === "banxa_google_pay"
                      ? "Google Pay (Banxa)"
                      : method === "banxa_card"
                        ? "Card (Banxa)"
                        : method === "banxa_bank"
                          ? "Bank Transfer (Banxa)"
                          : "OpenPay Balance";

  const headerTitle =
    step === "amount"
      ? "Buy"
      : step === "method"
        ? "Pay with"
        : method === "usdc"
          ? "USDC Pay"
          : method === "solana_pay"
            ? "Solana Pay"
            : method === "circle_mint"
              ? "Circle Deposit"
              : method === "cash_pay"
                ? "Pay with CASH"
                : method === "banxa_apple_pay"
                  ? "Apple Pay"
                  : method === "banxa_google_pay"
                    ? "Google Pay"
                    : method === "banxa_card"
                      ? "Card"
                      : method === "banxa_bank"
                        ? "Bank Transfer"
                        : "Crypto Deposit";

  return (
    <div className="ot-phantom ph-page flex min-h-[calc(100dvh-6rem)] flex-col pb-8">
      <PageHeader
        title={headerTitle}
        backTo={step === "amount" ? "/dashboard" : undefined}
        onBack={step === "amount" ? undefined : handleHeaderBack}
      />

      {pendingPayLink && (
        <div className="mb-5 overflow-hidden rounded-2xl bg-card">
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

      {/* —— Step 1: Amount (Phantom-style) —— */}
      {step === "amount" && (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center px-2 pb-6 pt-4">
            <button
              type="button"
              className="mb-8 inline-flex items-center gap-2 rounded-full bg-muted/70 py-1.5 pl-1.5 pr-3 press"
              aria-label="Buying OUSD"
            >
              <img
                src={OUSD_LOGO_URL}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
              <span className="text-sm font-semibold">OUSD</span>
            </button>

            <div className="flex w-full items-baseline justify-center gap-1">
              <span className="text-5xl font-bold text-muted-foreground/80">$</span>
              <Input
                id="topup-amount"
                value={amount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.]/g, "");
                  setDepositReady(false);
                  setAmount(raw);
                }}
                type="text"
                inputMode="decimal"
                autoFocus
                aria-label="Buy amount in USD"
                className="h-auto w-full max-w-[18rem] border-0 bg-transparent p-0 text-center text-[5rem] font-bold leading-none tabular-nums shadow-none focus-visible:ring-0"
              />
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              {amountValid ? (
                <>
                  {formatOUSD(amtNum)}
                  {displayCurrency !== "USD" ? (
                    <span className="text-muted-foreground/80">
                      {" "}
                      · ≈ {formatUSD(amtNum)}
                    </span>
                  ) : null}
                </>
              ) : (
                "Enter an amount"
              )}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setDepositReady(false);
                    setAmount(String(p));
                  }}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold press",
                    amount === String(p)
                      ? "bg-foreground text-background"
                      : "bg-muted text-foreground hover:bg-muted/80",
                  )}
                >
                  ${p}
                </button>
              ))}
            </div>

            {hasFee && amountValid ? (
              <div className="mt-6 w-full max-w-sm rounded-2xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span>Platform fee ({(feeBps / 100).toFixed(2)}%)</span>
                  <span className="font-semibold tabular-nums text-destructive">
                    −{formatUSD(feeBreakdown.fee)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-border/50 pt-1.5">
                  <span className="font-medium text-foreground">You receive</span>
                  <span className="text-sm font-bold tabular-nums text-foreground">
                    {formatOUSD(feeBreakdown.net)}
                  </span>
                </div>
              </div>
            ) : null}

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Adding to{" "}
              <span className="font-medium text-foreground">
                {wallet?.name ?? "Main Wallet"}
              </span>
              {" · "}
              bal {formatUSD(Number(wallet?.ousd_balance ?? 0))}
            </p>
          </div>

          <div className="sticky bottom-0 mt-auto space-y-2 bg-gradient-to-t from-background via-background to-transparent pb-2 pt-4">
            <Button
              type="button"
              disabled={!amountValid}
              onClick={goToMethod}
              className="h-14 w-full rounded-full text-base font-bold"
            >
              Continue
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Next · choose how to pay
            </p>
          </div>
        </div>
      )}

      {/* —— Step 2: Payment method —— */}
      {step === "method" && (
        <div className="flex flex-1 flex-col">
          <div className="mb-5 rounded-2xl bg-card px-4 py-3.5">
            <div className="flex items-center gap-3">
              <img
                src={OUSD_LOGO_URL}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">You buy</p>
                <p className="truncate text-lg font-bold tabular-nums">
                  {formatOUSD(amtNum)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep("amount")}
                className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold press hover:bg-muted/80"
              >
                Edit
              </button>
            </div>
            {hasFee ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                After {(feeBps / 100).toFixed(2)}% fee →{" "}
                <span className="font-semibold text-foreground">
                  {formatOUSD(feeBreakdown.net)}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                1 OUSD = $1.00 · ≈ {formatUSD(amtNum)}
              </p>
            )}
          </div>

          <h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
            Select a provider
          </h2>
          <div className="overflow-hidden rounded-2xl bg-card">
            {visibleMethods.map((m, i) => {
              const selected = method === m.id;
              const Icon = m.icon;
              const disabled = m.id === "openpay_balance" && !linked;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setMethod(m.id);
                    setDepositReady(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3.5 text-left press transition hover:bg-muted/40",
                    i > 0 && "border-t border-border/60",
                    disabled && "opacity-50",
                    selected && "bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-11 w-11 place-items-center overflow-hidden rounded-full",
                      selected ? "bg-primary/15 ring-2 ring-primary/35" : "bg-muted",
                      m.id === "moonpay" && "bg-[#7D00FE]/15 text-[#7D00FE]",
                      m.id === "helio" && "bg-[#9945FF]/15 text-[#9945FF]",
                      m.id === "solana_pay" && "bg-[#14F195]/20 text-[#0ea5e9]",
                      m.id === "circle_mint" && "bg-[#00BFFF]/15 text-[#0088cc]",
                      m.id === "cash_pay" && "bg-emerald-500/15",
                      m.id.startsWith("banxa_") && "bg-[#0B5FFF]/12 text-[#0B5FFF]",
                      m.id === "usdc" && "bg-[#2775CA]/15",
                    )}
                  >
                    {m.logoUrl ? (
                      <img src={m.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : m.helioMark ? (
                      <HelioMark className="h-5 w-5" />
                    ) : m.solanaMark ? (
                      <span className="text-sm font-black tracking-tight">◎</span>
                    ) : m.circleMark ? (
                      <span className="text-[11px] font-black tracking-tight">USDC</span>
                    ) : m.banxaMark ? (
                      <span className="text-[10px] font-black tracking-tight">
                        {m.id === "banxa_apple_pay" ? "APay" : "GPay"}
                      </span>
                    ) : Icon ? (
                      <Icon className="h-5 w-5" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{m.label}</span>
                      {m.id === "openpay_balance" && linked ? (
                        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          Linked
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {disabled ? "Connect OpenPay in Settings" : m.desc}
                    </div>
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

          {method === "openpay_balance" && !linked ? (
            <p className="mt-3 px-1 text-center text-xs text-muted-foreground">
              <Link
                to="/settings"
                className="inline-flex items-center gap-1 font-semibold text-primary"
              >
                <Link2 className="h-3.5 w-3.5" />
                Connect OpenPay
              </Link>{" "}
              to pay from your balance.
            </p>
          ) : method === "pi" ? (
            <div className="mt-4 space-y-2 rounded-2xl bg-card px-4 py-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pi payment
              </p>
              {piQuoteLoading && !piQuote ? (
                <p className="text-xs text-muted-foreground">Fetching live π price…</p>
              ) : piQuote ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Live π price</span>
                    <span className="font-semibold tabular-nums">
                      ${formatNumber(piQuote.piUsdPrice, piQuote.piUsdPrice < 0.01 ? 6 : 4)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">You pay</span>
                    <span className="font-semibold tabular-nums">
                      {formatNumber(piQuote.piAmount, piQuote.piAmount < 1 ? 6 : 4)} π
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">You receive</span>
                    <span className="font-semibold tabular-nums">
                      {formatOUSD(amtNum)}
                    </span>
                  </div>
                  <div className="border-t border-border/60 pt-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Memo
                    </p>
                    <p className="mt-1 break-words text-xs leading-relaxed text-foreground">
                      {piQuote.memo}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{selectedMethod?.desc}</p>
              )}
            </div>
          ) : (
            <p className="mt-3 px-1 text-center text-xs leading-relaxed text-muted-foreground">
              {selectedMethod?.desc}
            </p>
          )}

          <div className="sticky bottom-0 mt-auto space-y-2 bg-gradient-to-t from-background via-background to-transparent pb-2 pt-6">
            <Button
              type="button"
              disabled={
                busy ||
                !amountValid ||
                (method === "openpay_balance" && !linked)
              }
              onClick={() => openConfirm()}
              className={cn(
                "h-14 w-full rounded-full text-base font-bold text-primary-foreground",
                method === "openpay_balance" &&
                  "bg-[#0070BA] text-white hover:bg-[#0070BA]/90 hover:text-white",
                method === "moonpay" &&
                  "bg-[#7D00FE] text-white hover:bg-[#7D00FE]/90 hover:text-white",
              )}
            >
              {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin text-white" /> : null}
              Review {formatOUSD(amtNum, { suffix: false })} OUSD
              <ChevronRight className="ml-1 h-5 w-5 opacity-90 text-white" />
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Fees & third-party terms shown before you pay
            </p>
          </div>
        </div>
      )}

      {/* —— Step 3: Deposit widget (Helio / USDC / Solana Pay) —— */}
      {step === "deposit" && depositReady && (method === "helio" || method === "usdc") && (
        <div className="flex flex-1 flex-col space-y-4">
          <div className="rounded-2xl bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Paying exactly</p>
            <p className="text-xl font-bold tabular-nums">{formatOUSD(amtNum)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              via {method === "usdc" ? "USDC · MoonPay Commerce" : "SOL / crypto · MoonPay Commerce"}
            </p>
          </div>
          <HelioDepositPanel
            product={method === "usdc" ? "usdc" : "crypto"}
            amountUsd={amtNum}
            onSuccess={refreshAfterHelioDeposit}
          />
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs text-muted-foreground"
            onClick={() => {
              setDepositReady(false);
              setStep("method");
            }}
          >
            Change payment method
          </Button>
        </div>
      )}

      {step === "deposit" && depositReady && method === "solana_pay" && (
        <div className="flex flex-1 flex-col space-y-4">
          <div className="rounded-2xl bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Paying exactly</p>
            <p className="text-xl font-bold tabular-nums">{formatOUSD(amtNum)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              via Solana Commerce Kit · credited as OUSD after confirmation
            </p>
          </div>
          <SolanaReceivePanel
            amountUsd={amtNum}
            mode="buyNow"
            creditOnSuccess
            showWalletConnect
            showSolanaPayQr
          />
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs text-muted-foreground"
            onClick={() => {
              setDepositReady(false);
              setStep("method");
            }}
          >
            Change payment method
          </Button>
        </div>
      )}

      {step === "deposit" && depositReady && method === "circle_mint" && (
        <div className="flex flex-1 flex-col space-y-4">
          <CircleMintDepositPanel
            amountUsd={amtNum}
            walletId={wallet?.id}
            onSuccess={refreshAfterHelioDeposit}
          />
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs text-muted-foreground"
            onClick={() => {
              setDepositReady(false);
              setStep("method");
            }}
          >
            Change payment method
          </Button>
        </div>
      )}

      {step === "deposit" && depositReady && method === "cash_pay" && (
        <div className="flex flex-1 flex-col space-y-4">
          <div className="rounded-2xl bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Paying exactly</p>
            <p className="text-xl font-bold tabular-nums">{formatOUSD(amtNum)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              via Phantom CASH · credited as OUSD after confirmation
            </p>
          </div>
          <CashPayDepositPanel
            amountUsd={amtNum}
            walletId={wallet?.id}
            cashBalance={Number(wallet?.cash_balance ?? 0)}
            onSuccess={refreshAfterHelioDeposit}
          />
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs text-muted-foreground"
            onClick={() => {
              setDepositReady(false);
              setStep("method");
            }}
          >
            Change payment method
          </Button>
        </div>
      )}

      {step === "deposit" && depositReady && isBanxaTopupMethod(method) && (
        <div className="flex flex-1 flex-col space-y-4">
          <div className="rounded-2xl bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Paying exactly</p>
            <p className="text-xl font-bold tabular-nums">{formatOUSD(amtNum)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              via Banxa · credited as OUSD after confirmation
            </p>
          </div>
          <BanxaDepositPanel
            methodKey={method}
            amountUsd={amtNum}
            walletId={wallet?.id}
            onSuccess={refreshAfterHelioDeposit}
          />
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs text-muted-foreground"
            onClick={() => {
              setDepositReady(false);
              setStep("method");
            }}
          >
            Change payment method
          </Button>
        </div>
      )}

      <TxConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm purchase"
        description="Review amount, fees, and third-party payment"
        amount={formatOUSD(amtNum)}
        subtitle={
          method === "pi" && piQuote
            ? `Pay ${formatNumber(piQuote.piAmount, piQuote.piAmount < 1 ? 6 : 4)} π · 1 OUSD = $1.00`
            : hasFee
              ? `You receive ${formatOUSD(feeBreakdown.net)}`
              : `≈ ${formatUSD(amtNum)} · 1 OUSD = $1.00`
        }
        rows={[
          { label: "You buy", value: formatOUSD(amtNum) },
          {
            label: "You pay",
            value:
              method === "pi" && piQuote
                ? `${formatNumber(piQuote.piAmount, piQuote.piAmount < 1 ? 6 : 4)} π`
                : `$${amtNum.toFixed(2)} USD`,
          },
          ...(method === "pi" && piQuote
            ? [
                {
                  label: "Live π price",
                  value: `$${formatNumber(piQuote.piUsdPrice, piQuote.piUsdPrice < 0.01 ? 6 : 4)}`,
                },
                {
                  label: "Memo",
                  value: piQuote.memo,
                },
              ]
            : []),
          ...(hasFee
            ? [
                {
                  label: `Platform fee (${(feeBps / 100).toFixed(2)}%)`,
                  value: (
                    <span className="text-destructive">
                      −{formatUSD(feeBreakdown.fee)}
                    </span>
                  ),
                },
                {
                  label: "You receive",
                  value: formatOUSD(feeBreakdown.net),
                },
              ]
            : []),
          { label: "Pay with", value: payWithLabel },
          {
            label: "Wallet",
            value: wallet?.name ?? "Active wallet",
          },
        ]}
        notice={
          <TopupFeesNotice
            method={method}
            feeBps={feeBps}
            feeAmount={feeBreakdown.fee}
            netAmount={feeBreakdown.net}
          />
        }
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
