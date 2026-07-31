import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, CreditCard, Loader2, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TxConfirmModal } from "@/components/wallet/TxConfirmModal";
import { TopupFeesNotice } from "@/components/wallet/TopupFeesNotice";
import { buyOpenToken } from "@/lib/opentoken.functions";
import { isOpenTokenGraduated } from "@/lib/opentoken/bonding-curve";
import { topUpWithPi, quotePiTopup } from "@/lib/pi-network";
import {
  createOpenPayTopupCharge,
  getOpenPayLinkStatus,
  getOpenPayLinkedBalance,
} from "@/lib/openpay-pro.functions";
import { creditMoonPayTopup } from "@/lib/moonpay-topup.functions";
import { listTopupMethods } from "@/lib/topup-admin.functions";
import { buyMajorWithOusd } from "@/lib/buy-major.functions";
import { executeOpenDexSwap, OUSD_SWAP_ID } from "@/lib/opendex.functions";
import { MoonPayBuyOverlay } from "@/components/moonpay-buy-overlay";
import { HelioDepositPanel } from "@/components/helio-deposit-panel";
import { OUSD_LOGO_URL, PI_NETWORK_LOGO_URL, USDC_LOGO_URL } from "@/lib/token-logos";
import { cn } from "@/lib/utils";
import { formatNumber, formatOUSD, formatUSD } from "@/lib/wallet-utils";
import { useCurrency } from "@/lib/currency";
import { useIsDesktopViewport } from "@/hooks/use-mobile";

export type AssetBuyTarget = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  logoUrl?: string | null;
  isOusd?: boolean;
  /** When set, buy converts OUSD → this major ledger balance at market price */
  majorId?: import("@/lib/major-tokens").MajorTokenId;
  status?: string | null;
};

type PaymentMethod = "wallet_ousd" | "pi" | "openpay_checkout" | "moonpay" | "helio" | "usdc";
type BuyStep = "amount" | "method" | "deposit";

const PRESETS = [10, 25, 50, 100, 250];
const PENDING_CHARGE_KEY = "openpay_pending_charge";
const PENDING_PAYLINK_KEY = "openpay_pending_paylink";
const PENDING_ASSET_BUY_KEY = "asset_pending_buy";
const MIN_BUY_AMOUNT = 0.01;
const MAX_BUY_AMOUNT = 50_000;

/** Any custom amount from $0.01–$50,000 (presets are shortcuts only). */
const amountSchema = z.coerce
  .number()
  .finite()
  .positive()
  .min(MIN_BUY_AMOUNT, `Minimum $${MIN_BUY_AMOUNT}`)
  .max(MAX_BUY_AMOUNT);

function parseBuyAmount(raw: string): number {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

const ALL_METHODS: {
  id: PaymentMethod;
  label: string;
  logoUrl?: string;
  icon?: typeof CreditCard;
  helioMark?: boolean;
  desc: string;
}[] = [
  {
    id: "wallet_ousd",
    label: "Wallet OUSD",
    logoUrl: OUSD_LOGO_URL,
    desc: "Pay with your OpenPay Pro OUSD · buy any token",
  },
  {
    id: "openpay_checkout",
    label: "OpenPay Balance",
    logoUrl: OUSD_LOGO_URL,
    desc: "Pay from your connected OpenPay account → credit Pro",
  },
  {
    id: "moonpay",
    label: "MoonPay",
    icon: CreditCard,
    desc: "Card / Apple Pay / Google Pay → OUSD",
  },
  {
    id: "pi",
    label: "Pi Network (π)",
    logoUrl: PI_NETWORK_LOGO_URL,
    desc: "Pay with Pi · live π price → OUSD ($1)",
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

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  walletId?: string;
  ousdBalance: number;
  token: AssetBuyTarget;
  returnPath: string;
  onNavigateSwap?: () => void;
};

function sanitizeAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
}

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

export function AssetBuySheet({
  open,
  onClose,
  userId,
  walletId,
  ousdBalance,
  token,
  returnPath,
}: Props) {
  const qc = useQueryClient();
  // Subscribe so fiat labels refresh when display currency changes
  useCurrency();
  const isDesktop = useIsDesktopViewport();
  const buyFn = useServerFn(buyOpenToken);
  const createCharge = useServerFn(createOpenPayTopupCharge);
  const getLink = useServerFn(getOpenPayLinkStatus);
  const getOpBalance = useServerFn(getOpenPayLinkedBalance);

  const [amount, setAmount] = useState("25");
  const [step, setStep] = useState<BuyStep>("amount");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>(
    token.isOusd ? "pi" : "wallet_ousd",
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [moonpayVisible, setMoonpayVisible] = useState(false);
  const [moonpaySession, setMoonpaySession] = useState<{
    amount: number;
    externalTransactionId: string;
  } | null>(null);
  /** After confirm, show Helio / USDC deposit widget */
  const [depositReady, setDepositReady] = useState(false);
  const creditMoonPay = useServerFn(creditMoonPayTopup);
  const buyMajorFn = useServerFn(buyMajorWithOusd);
  const swapFn = useServerFn(executeOpenDexSwap);

  const isOusd = !!token.isOusd;
  const isMajor = !!token.majorId;
  const graduated = !isOusd && !isMajor && isOpenTokenGraduated(token);
  const tokenLogo = token.logoUrl || (isOusd ? OUSD_LOGO_URL : null);
  /** Wallet OUSD for every buyable token (OpenTokens, majors). Not for OUSD top-up. */
  const listMethodsFn = useServerFn(listTopupMethods);
  const { data: methodConfig } = useQuery({
    queryKey: ["topup-methods"],
    queryFn: () => listMethodsFn(),
    enabled: open,
  });
  /** Admin config keys use `openpay_balance` for the OpenPay checkout method. */
  const configKey = (id: PaymentMethod) =>
    id === "openpay_checkout" ? "openpay_balance" : id;
  const methods = useMemo(() => {
    const base = ALL_METHODS.filter((m) => {
      if (m.id === "wallet_ousd") return !isOusd;
      return true;
    });
    const cfg = (methodConfig ?? []) as any[];
    if (!cfg.length) return base;
    const byKey = new Map<string, any>(cfg.map((c) => [c.method_key, c]));
    return base
      .filter((m) => {
        // Wallet OUSD spend is not a deposit rail — always available for buys.
        if (m.id === "wallet_ousd") return true;
        const c = byKey.get(configKey(m.id));
        // Missing admin row → still show; only hide when explicitly disabled.
        return !c || c.enabled !== false;
      })
      .map((m) => {
        const c = byKey.get(configKey(m.id));
        return c ? { ...m, label: c.label || m.label, desc: c.description || m.desc } : m;
      })
      .sort(
        (a, b) =>
          Number(byKey.get(configKey(a.id))?.sort_order ?? 0) -
          Number(byKey.get(configKey(b.id))?.sort_order ?? 0),
      );
  }, [methodConfig, isOusd]);

  const methodIdsKey = useMemo(() => methods.map((m) => m.id).join(","), [methods]);

  useEffect(() => {
    if (methods.length && !methods.some((m) => m.id === method)) {
      setMethod(methods[0].id);
    }
  }, [methodIdsKey, method, methods]);

  const { data: openpayLink } = useQuery({
    queryKey: ["openpay-link", userId],
    queryFn: () => getLink(),
    enabled: open,
  });

  const { data: openpayBal } = useQuery({
    queryKey: ["openpay-linked-balance", userId],
    queryFn: () => getOpBalance(),
    enabled: open && !!openpayLink?.linked,
    staleTime: 30_000,
  });

  const amtNum = parseBuyAmount(amount);
  const parsed = amountSchema.safeParse(amount.trim() === "" ? NaN : amtNum);
  const valid = parsed.success;

  const { data: piQuote, isFetching: piQuoteLoading } = useQuery({
    queryKey: ["pi-topup-quote", amtNum],
    queryFn: () => quotePiTopup(amtNum),
    enabled: open && method === "pi" && valid,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) return;
    setAmount("25");
    setStep("amount");
    setMethod(isOusd ? "pi" : "wallet_ousd");
    setActionError(null);
    setBusy(false);
    setDepositReady(false);
    setConfirmOpen(false);
  }, [open, isOusd, token.id]);

  const opSpendable =
    openpayBal?.linked && typeof openpayBal.balance === "number" ? openpayBal.balance : null;
  const openpayShort =
    method === "openpay_checkout" &&
    opSpendable != null &&
    amtNum > 0 &&
    amtNum > opSpendable + 1e-9;
  const linked = !!openpayLink?.linked;

  async function executeMajorBuy(usdAmount: number) {
    if (!walletId || !token.majorId) throw new Error("Create a wallet first");
    const res = await buyMajorFn({
      data: {
        wallet_id: walletId,
        major_id: token.majorId,
        usd_amount: usdAmount,
      },
    });
    toast.success(
      `Bought ${formatNumber(res.token_amount, 6)} ${res.symbol} for ${formatUSD(res.usd_spent)}`,
    );
    await invalidateAfterBuy();
    onClose();
  }

  /** Graduated OpenTokens: spend OUSD on OpenDEX for the token. */
  async function executeDexBuy(usdAmount: number) {
    if (!walletId) throw new Error("Create a wallet first");
    if (ousdBalance < usdAmount) {
      throw new Error(`Need ${formatUSD(usdAmount)} OUSD (balance ${formatUSD(ousdBalance)})`);
    }
    const res = await swapFn({
      data: {
        wallet_id: walletId,
        from_id: OUSD_SWAP_ID,
        to_id: token.id,
        amount: usdAmount,
        slippage: 1,
      },
    });
    toast.success(
      `Bought ${formatNumber(res.amount_out, 4)} $${token.symbol} for ${formatUSD(res.amount_in)} OUSD`,
    );
    await invalidateAfterBuy();
    onClose();
  }

  async function executeTokenBuy(piAmount: number) {
    if (!walletId) throw new Error("Create a wallet first");
    const res = await buyFn({
      data: { token_id: token.id, wallet_id: walletId, pi_amount: piAmount },
    });
    toast.success(`Bought ${formatNumber(res.token_amount, 4)} $${token.symbol}`);
    if (res.graduated) toast.success("Token graduated to OpenDEX!");
    await invalidateAfterBuy();
    onClose();
  }

  async function invalidateAfterBuy() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["active-wallet", userId] }),
      qc.invalidateQueries({ queryKey: ["wallets"] }),
      qc.invalidateQueries({ queryKey: ["asset-token", token.id] }),
      qc.invalidateQueries({ queryKey: ["ot-holding", token.id] }),
      qc.invalidateQueries({ queryKey: ["holdings"] }),
      qc.invalidateQueries({ queryKey: ["ot-portfolio"] }),
      qc.invalidateQueries({ queryKey: ["recent-txs"] }),
    ]);
  }

  async function invalidateAfterTopup() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["active-wallet", userId] }),
      qc.invalidateQueries({ queryKey: ["wallets"] }),
      qc.invalidateQueries({ queryKey: ["holdings"] }),
      qc.invalidateQueries({ queryKey: ["recent-txs"] }),
      qc.invalidateQueries({ queryKey: ["openpay-linked-balance", userId] }),
    ]);
  }

  async function startOpenPayCheckout(amt: number) {
    const link = await getLink();
    if (!link?.linked) {
      throw new Error("Connect OpenPay in Settings first");
    }
    if (!walletId) {
      throw new Error("Select an active wallet first");
    }

    try {
      sessionStorage.setItem(
        PENDING_ASSET_BUY_KEY,
        JSON.stringify({
          tokenId: token.id,
          symbol: token.symbol,
          isOusd,
          majorId: token.majorId,
          amount: amt,
          graduated,
        }),
      );
    } catch {
      /* ignore */
    }

    const res = await createCharge({
      data: {
        amount: amt,
        origin: window.location.origin,
        walletId,
        returnPath,
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

    const pending = {
      reference: res.reference,
      amount: res.amount,
      partner_username: res.partner_username,
    };
    try {
      sessionStorage.setItem(PENDING_PAYLINK_KEY, JSON.stringify(pending));
    } catch {
      /* ignore */
    }
    window.location.href = res.pay_url;
  }

  async function submit() {
    setActionError(null);
    if (!valid) {
      const msg =
        amtNum > 0 && amtNum < MIN_BUY_AMOUNT
          ? `Minimum amount is $${MIN_BUY_AMOUNT}`
          : amtNum > MAX_BUY_AMOUNT
            ? `Maximum amount is $${MAX_BUY_AMOUNT.toLocaleString()}`
            : `Enter an amount between $${MIN_BUY_AMOUNT} and $${MAX_BUY_AMOUNT.toLocaleString()}`;
      setActionError(msg);
      toast.error(msg);
      return;
    }
    const amt = amtNum;

    if (method === "openpay_checkout" && openpayShort && opSpendable != null) {
      const msg = `OpenPay account has ${formatUSD(opSpendable)} — lower the amount, or use MoonPay / Pi.`;
      setActionError(msg);
      toast.error(msg);
      return;
    }

    if (method === "openpay_checkout" && !walletId) {
      const msg = "Select an active wallet first";
      setActionError(msg);
      toast.error(msg);
      return;
    }

    setBusy(true);
    try {
      if (isOusd) {
        if (method === "pi") {
          await topUpWithPi(amt);
          toast.success(`${formatUSD(amt)} OUSD credited from Pi (live price)`);
          await invalidateAfterTopup();
          setConfirmOpen(false);
          onClose();
          return;
        }
        if (method === "moonpay") {
          if (!walletId) {
            throw new Error("Select an active wallet first");
          }
          const externalTransactionId = `ousd_${walletId}_${Date.now()}`;
          setMoonpaySession({ amount: amt, externalTransactionId });
          setMoonpayVisible(true);
          setConfirmOpen(false);
          return;
        }
        if (method === "helio" || method === "usdc") {
          setDepositReady(true);
          setStep("deposit");
          setConfirmOpen(false);
          return;
        }
        await startOpenPayCheckout(amt);
        setConfirmOpen(false);
        return;
      }

      if (isMajor && token.majorId) {
        if (method === "wallet_ousd") {
          if (ousdBalance < amt) {
            throw new Error(`Need ${formatUSD(amt)} OUSD (balance ${formatUSD(ousdBalance)})`);
          }
          await executeMajorBuy(amt);
          setConfirmOpen(false);
          return;
        }
        if (method === "pi") {
          await topUpWithPi(amt);
          toast.success(`${formatUSD(amt)} OUSD credited from Pi (live price)`);
          await executeMajorBuy(amt);
          setConfirmOpen(false);
          return;
        }
        if (method === "moonpay") {
          if (!walletId) throw new Error("Select an active wallet first");
          const externalTransactionId = `major_${token.majorId}_${walletId}_${Date.now()}`;
          setMoonpaySession({ amount: amt, externalTransactionId });
          setMoonpayVisible(true);
          setConfirmOpen(false);
          return;
        }
        if (method === "helio" || method === "usdc") {
          setDepositReady(true);
          setStep("deposit");
          setConfirmOpen(false);
          return;
        }
        try {
          sessionStorage.setItem(
            PENDING_ASSET_BUY_KEY,
            JSON.stringify({
              tokenId: token.majorId,
              symbol: token.symbol,
              isOusd: false,
              majorId: token.majorId,
              amount: amt,
            }),
          );
        } catch {
          /* ignore */
        }
        await startOpenPayCheckout(amt);
        return;
      }

      if (graduated) {
        if (method === "wallet_ousd") {
          await executeDexBuy(amt);
          return;
        }
        if (method === "pi") {
          await topUpWithPi(amt);
          toast.success(`${formatUSD(amt)} OUSD credited from Pi (live price)`);
          await executeDexBuy(amt);
          return;
        }
        if (method === "moonpay") {
          if (!walletId) throw new Error("Select an active wallet first");
          const externalTransactionId = `ousd_${walletId}_${Date.now()}`;
          setMoonpaySession({ amount: amt, externalTransactionId });
          setMoonpayVisible(true);
          setConfirmOpen(false);
          return;
        }
        if (method === "helio" || method === "usdc") {
          setDepositReady(true);
          setStep("deposit");
          setConfirmOpen(false);
          return;
        }
        await startOpenPayCheckout(amt);
        return;
      }

      // Bonding curve token buy
      if (method === "wallet_ousd") {
        if (ousdBalance < amt) {
          throw new Error(`Need ${formatUSD(amt)} OUSD (balance ${formatUSD(ousdBalance)})`);
        }
        await executeTokenBuy(amt);
        return;
      }

      if (method === "pi") {
        await topUpWithPi(amt);
        toast.success(`${formatUSD(amt)} OUSD credited from Pi (live price)`);
        await executeTokenBuy(amt);
        return;
      }

      if (method === "moonpay") {
        if (!walletId) throw new Error("Select an active wallet first");
        const externalTransactionId = `ousd_${walletId}_${Date.now()}`;
        setMoonpaySession({ amount: amt, externalTransactionId });
        setMoonpayVisible(true);
        setConfirmOpen(false);
        return;
      }

      if (method === "helio" || method === "usdc") {
        setDepositReady(true);
        setStep("deposit");
        setConfirmOpen(false);
        return;
      }

      await startOpenPayCheckout(amt);
    } catch (err) {
      const msg = (err as Error).message || "Purchase failed";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  const ctaLabel = isOusd
    ? method === "pi"
      ? `Buy ${valid ? formatUSD(amtNum) : ""} OUSD with Pi`
      : method === "moonpay"
        ? `Buy with Card`
        : method === "usdc"
          ? `Pay with USDC`
          : method === "helio"
            ? `Deposit crypto`
            : openpayShort
              ? `Amount exceeds OpenPay balance`
              : `Pay ${valid ? formatUSD(amtNum) : ""} with OpenPay`
    : isMajor
      ? method === "wallet_ousd"
        ? `Buy ${token.symbol} with OUSD`
        : method === "moonpay"
          ? `Buy ${token.symbol} with Card`
          : method === "pi"
            ? `Buy ${token.symbol} with Pi`
            : method === "usdc"
              ? `Pay with USDC`
              : method === "helio"
                ? `Deposit crypto`
                : `Buy ${token.symbol}`
    : graduated
      ? method === "wallet_ousd"
        ? `Buy $${token.symbol} with OUSD`
        : method === "pi"
          ? `Buy $${token.symbol} with Pi`
          : method === "moonpay"
            ? `Buy $${token.symbol} with Card`
            : method === "usdc"
              ? `Pay with USDC`
              : method === "helio"
                ? `Deposit crypto`
                : openpayShort
                  ? `Amount exceeds OpenPay balance`
                  : `Buy $${token.symbol}`
      : method === "wallet_ousd"
        ? `Buy $${token.symbol}`
        : method === "pi"
          ? `Pay with Pi & Buy`
          : method === "moonpay"
            ? `Buy with Card`
            : method === "usdc"
              ? `Pay with USDC`
              : method === "helio"
                ? `Deposit crypto`
                : openpayShort
                  ? `Amount exceeds OpenPay balance`
                  : `Pay with OpenPay & Buy`;

  function goToMethod() {
    setActionError(null);
    if (!valid) {
      const msg =
        amtNum > 0 && amtNum < MIN_BUY_AMOUNT
          ? `Minimum amount is $${MIN_BUY_AMOUNT}`
          : `Enter an amount between $${MIN_BUY_AMOUNT} and $${MAX_BUY_AMOUNT.toLocaleString()}`;
      setActionError(msg);
      toast.error(msg);
      return;
    }
    setStep("method");
  }

  function handleBack() {
    if (step === "deposit") {
      setDepositReady(false);
      setStep("method");
      return;
    }
    if (step === "method") {
      setStep("amount");
      return;
    }
    onClose();
  }

  const headerTitle =
    step === "amount"
      ? `Buy ${token.name}`
      : step === "method"
        ? "Pay with"
        : method === "usdc"
          ? "USDC Pay"
          : "Crypto Deposit";

  const receiveHint =
    !isOusd && token.price > 0
      ? `≈ ${formatNumber(amtNum / token.price, amtNum / token.price < 1 ? 6 : 4)} ${token.symbol}`
      : isOusd
        ? formatOUSD(amtNum)
        : token.symbol;

  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {step !== "amount" ? (
            <button
              type="button"
              onClick={handleBack}
              className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-foreground press"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
          <div className="min-w-0">
            <div className="truncate text-lg font-bold tracking-tight">
              {headerTitle}
              {step === "amount" ? (
                <span className="text-muted-foreground"> {token.symbol}</span>
              ) : null}
            </div>
            {step === "amount" ? (
              <div className="text-sm text-muted-foreground">
                Price{" "}
                {isOusd
                  ? formatUSD(token.price)
                  : formatOUSD(token.price, { price: true, suffix: false })}{" "}
                {!isOusd && <span className="text-muted-foreground">OUSD</span>}
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground press"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* —— Step 1: Amount —— */}
      {step === "amount" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="flex flex-col items-center px-1 pb-4 pt-2">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-muted/70 py-1.5 pl-1.5 pr-3">
                {tokenLogo ? (
                  <img
                    src={tokenLogo}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    {token.symbol.slice(0, 1)}
                  </span>
                )}
                <span className="text-sm font-semibold">{token.symbol}</span>
              </div>

              <div className="flex w-full items-baseline justify-center gap-1">
                <span className="text-5xl font-bold text-muted-foreground/80">$</span>
                <Input
                  value={amount}
                  onChange={(e) => {
                    setActionError(null);
                    setDepositReady(false);
                    setAmount(sanitizeAmountInput(e.target.value));
                  }}
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  autoFocus
                  aria-label={isOusd ? "Amount in USD" : "Amount in OUSD"}
                  className="h-auto w-full max-w-[18rem] border-0 bg-transparent p-0 text-center text-[5rem] font-bold leading-none tabular-nums shadow-none focus-visible:ring-0"
                />
              </div>

              <p className="mt-3 text-sm font-medium text-muted-foreground">
                {isOusd ? "USD → OUSD" : "OUSD"}
                {valid ? (
                  <span className="text-muted-foreground/80"> · {receiveHint}</span>
                ) : null}
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setDepositReady(false);
                      setAmount(String(p));
                    }}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-semibold press",
                      amount === String(p)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground hover:bg-muted/80",
                    )}
                  >
                    ${p}
                  </button>
                ))}
                {opSpendable != null && opSpendable >= 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setDepositReady(false);
                      setAmount(String(Math.floor(opSpendable * 100) / 100));
                    }}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-semibold press",
                      Math.abs(amtNum - opSpendable) < 0.01
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground hover:bg-muted/80",
                    )}
                  >
                    Max
                  </button>
                )}
              </div>

              {!isOusd ? (
                <p className="mt-6 text-center text-xs text-muted-foreground">
                  Wallet balance · {formatNumber(ousdBalance, 2)} OUSD
                </p>
              ) : null}

              {actionError ? (
                <div className="mt-4 w-full rounded-2xl bg-destructive/15 px-3 py-2.5 text-xs text-destructive">
                  {actionError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="sticky bottom-0 shrink-0 space-y-2 bg-gradient-to-t from-background via-background to-transparent pb-1 pt-4">
            <Button
              type="button"
              disabled={!valid}
              onClick={goToMethod}
              className="h-14 w-full rounded-full text-base font-bold"
            >
              Continue
              <ChevronRight className="ml-1 h-5 w-5 opacity-90" />
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Next · choose how to pay
            </p>
          </div>
        </div>
      )}

      {/* —— Step 2: Payment method —— */}
      {step === "method" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
            <div className="mb-4 rounded-2xl bg-muted/50 px-4 py-3.5">
              <div className="flex items-center gap-3">
                {tokenLogo ? (
                  <img
                    src={tokenLogo}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                    {token.symbol.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">You buy</p>
                  <p className="truncate text-lg font-bold tabular-nums">
                    {isOusd ? formatOUSD(amtNum) : receiveHint}
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
              <p className="mt-2 text-[11px] text-muted-foreground">
                You pay {formatUSD(amtNum)}
                {isOusd ? " · 1 OUSD = $1.00" : ` · ${token.name}`}
              </p>
            </div>

            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payment method
            </div>
            <div className="space-y-2">
              {methods.map((m) => {
                const selected = method === m.id;
                const Icon = m.icon;
                const disabled = m.id === "openpay_checkout" && !linked;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setActionError(null);
                      setDepositReady(false);
                      setMethod(m.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all press",
                      selected
                        ? "border-primary bg-primary/5 shadow-glow"
                        : "border-border hover:bg-muted/50",
                      disabled && "opacity-50",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full",
                        m.logoUrl && "bg-background",
                        m.id === "moonpay" && "bg-[#7D00FE]/15 text-[#7D00FE]",
                        m.id === "helio" &&
                          "bg-gradient-to-br from-[#9945FF]/25 to-[#14F195]/20 text-[#9945FF]",
                        m.id === "usdc" && "bg-[#2775CA]/15",
                        m.id === "openpay_checkout" && "bg-[#0070BA]/10",
                        m.id === "wallet_ousd" && "bg-primary/10",
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{m.label}</span>
                        {m.id === "openpay_checkout" && linked ? (
                          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                            Linked
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {disabled ? "Connect OpenPay in Settings" : m.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {method === "pi" && (
              <div className="mt-3 space-y-2 rounded-2xl bg-muted/50 px-3.5 py-3 text-xs">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Pi payment
                </p>
                {piQuoteLoading && !piQuote ? (
                  <p className="text-muted-foreground">Fetching live π price…</p>
                ) : piQuote ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Live π price</span>
                      <span className="font-semibold tabular-nums">
                        ${formatNumber(piQuote.piUsdPrice, piQuote.piUsdPrice < 0.01 ? 6 : 4)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">You pay</span>
                      <span className="font-semibold tabular-nums">
                        {formatNumber(piQuote.piAmount, piQuote.piAmount < 1 ? 6 : 4)} π
                      </span>
                    </div>
                    <div className="border-t border-border/50 pt-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Memo
                      </p>
                      <p className="mt-0.5 break-words leading-relaxed text-foreground">
                        {piQuote.memo}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Pay with Pi · live π price → OUSD ($1)
                  </p>
                )}
              </div>
            )}

            {method === "openpay_checkout" && !linked && (
              <div className="mt-3 rounded-2xl bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
                Connect OpenPay to pay via checkout.{" "}
                <Link
                  to="/settings"
                  className="inline-flex items-center gap-1 font-semibold text-primary"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Settings
                </Link>
              </div>
            )}

            {method === "openpay_checkout" && linked && (
              <div
                className={cn(
                  "mt-3 rounded-2xl px-3 py-2.5 text-xs",
                  openpayShort
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-200"
                    : "bg-muted/60 text-muted-foreground",
                )}
              >
                {opSpendable != null ? (
                  <>
                    OpenPay account
                    {openpayBal?.username ? ` @${openpayBal.username}` : ""}:{" "}
                    <span className="font-semibold tabular-nums">{formatUSD(opSpendable)}</span>
                    {openpayShort
                      ? " — lower the amount, tap Max, or switch to MoonPay / Pi."
                      : " · pays into your OpenPay Pro wallet."}
                  </>
                ) : (
                  <>Pays from your connected OpenPay account into this Pro wallet.</>
                )}
                <div className="mt-1 text-[11px] opacity-80">
                  Pro wallet balance: {formatUSD(ousdBalance)} OUSD
                </div>
              </div>
            )}

            {!isOusd && method === "wallet_ousd" && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Balance: {formatNumber(ousdBalance, 2)} OUSD
              </p>
            )}

            {actionError ? (
              <div className="mt-3 rounded-2xl bg-destructive/15 px-3 py-2.5 text-xs text-destructive">
                {actionError}
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 shrink-0 space-y-2 bg-gradient-to-t from-background via-background to-transparent pb-1 pt-4">
            <Button
              type="button"
              className={cn(
                "h-14 w-full rounded-full text-base font-bold",
                method === "openpay_checkout" &&
                  "bg-[#0070BA] text-white hover:bg-[#0070BA]/90 hover:text-white",
                method === "moonpay" &&
                  "bg-[#7D00FE] text-white hover:bg-[#7D00FE]/90 hover:text-white",
              )}
              disabled={
                busy ||
                !valid ||
                (method === "openpay_checkout" && !linked) ||
                openpayShort
              }
              onClick={() => setConfirmOpen(true)}
            >
              {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {ctaLabel}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Fees & third-party terms shown before you pay
            </p>
          </div>
        </div>
      )}

      {/* —— Step 3: Deposit —— */}
      {step === "deposit" && depositReady && (method === "helio" || method === "usdc") && (
        <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto">
          <div className="rounded-2xl bg-muted/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">Paying exactly</p>
            <p className="text-xl font-bold tabular-nums">{formatUSD(amtNum)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              via {method === "usdc" ? "USDC · MoonPay Commerce" : "SOL / crypto · MoonPay Commerce"}
              {!isOusd ? ` · then buy ${token.symbol}` : null}
            </p>
          </div>
          <HelioDepositPanel
            product={method === "usdc" ? "usdc" : "crypto"}
            amountUsd={amtNum}
            onSuccess={() => {
              void invalidateAfterTopup();
              if (isOusd) onClose();
            }}
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
            Change amount or method
          </Button>
        </div>
      )}

      <TxConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isOusd ? "Confirm top-up" : "Confirm buy"}
        description={
          isOusd
            ? "Review amount, fees, and third-party payment"
            : `Review your ${token.symbol} purchase`
        }
        amount={formatUSD(amtNum)}
        subtitle={
          method === "pi" && piQuote
            ? `Pay ${formatNumber(piQuote.piAmount, piQuote.piAmount < 1 ? 6 : 4)} π`
            : !isOusd && token.price > 0
              ? `≈ ${formatNumber(amtNum / token.price, amtNum / token.price < 1 ? 6 : 4)} ${token.symbol}`
              : token.name
        }
        rows={[
          { label: "Asset", value: `${token.name} (${token.symbol})` },
          {
            label: "You pay",
            value:
              method === "pi" && piQuote
                ? `${formatNumber(piQuote.piAmount, piQuote.piAmount < 1 ? 6 : 4)} π`
                : formatUSD(amtNum),
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
          {
            label: "Pay with",
            value:
              method === "wallet_ousd"
                ? "OUSD balance"
                : method === "pi"
                  ? "Pi Network"
                  : method === "moonpay"
                    ? "Card (MoonPay)"
                    : method === "usdc"
                      ? "USDC Pay"
                      : method === "helio"
                        ? "Crypto Deposit"
                        : "OpenPay",
          },
          ...(!isOusd && method === "wallet_ousd"
            ? [{ label: "OUSD balance", value: formatUSD(ousdBalance) }]
            : []),
        ]}
        notice={
          method !== "wallet_ousd" ? <TopupFeesNotice method={method} /> : undefined
        }
        confirmLabel={ctaLabel}
        busy={busy}
        variant={method === "openpay_checkout" ? "openpay" : "default"}
        onConfirm={() => {
          void submit();
        }}
      />

      {moonpaySession ? (
        <MoonPayBuyOverlay
          visible={moonpayVisible}
          amount={moonpaySession.amount}
          externalCustomerId={userId}
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
            setMoonpayVisible(false);
            setBusy(true);
            try {
              await creditMoonPay({
                data: {
                  amount: paid,
                  moonpayTransactionId: id,
                  walletId: walletId!,
                },
              });
              toast.success(`${formatUSD(paid)} OUSD credited from MoonPay`);
              if (isMajor && token.majorId) {
                await executeMajorBuy(paid);
              } else if (graduated) {
                await executeDexBuy(paid);
              } else if (!isOusd) {
                await executeTokenBuy(paid);
              } else {
                await invalidateAfterTopup();
                onClose();
              }
            } catch (err) {
              const msg = (err as Error).message || "MoonPay credit failed";
              setActionError(msg);
              toast.error(msg);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );

  if (!open) return null;

  if (!isDesktop) {
    return (
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <SheetContent
          side="bottom"
          className="flex h-[92dvh] max-h-[92dvh] flex-col gap-0 rounded-t-[1.75rem] border-border/40 bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 [&>button.absolute]:hidden"
        >
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/35" />
          <SheetHeader className="sr-only">
            <SheetTitle>
              Buy {token.name} {token.symbol}
            </SheetTitle>
            <SheetDescription>Choose amount and payment method</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        hideClose
        className="fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 shadow-none duration-200 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 sm:rounded-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            Buy {token.name} {token.symbol}
          </DialogTitle>
          <DialogDescription>Choose amount and payment method</DialogDescription>
        </DialogHeader>
        <div className="mx-auto flex h-full w-full max-w-xl flex-col px-6 pb-6 pt-5">
          {body}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Run pending token buy after OpenPay return settles OUSD. */
export async function runPendingAssetBuy(opts: {
  buyFn: (args: { data: { token_id: string; wallet_id: string; pi_amount: number } }) => Promise<{
    token_amount: number;
    graduated?: boolean;
  }>;
  buyMajorFn?: (args: {
    data: {
      wallet_id: string;
      major_id: import("@/lib/major-tokens").MajorTokenId;
      usd_amount: number;
    };
  }) => Promise<{ token_amount: number; symbol: string }>;
  swapFn?: (args: {
    data: {
      wallet_id: string;
      from_id: string;
      to_id: string;
      amount: number;
      slippage: number;
    };
  }) => Promise<{ amount_out: number }>;
  walletId: string;
  onGraduated?: (tokenId: string) => void;
}) {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(PENDING_ASSET_BUY_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  const pending = JSON.parse(raw) as {
    tokenId: string;
    symbol: string;
    isOusd?: boolean;
    majorId?: import("@/lib/major-tokens").MajorTokenId;
    amount: number;
    graduated?: boolean;
  };

  if (pending.isOusd) {
    sessionStorage.removeItem(PENDING_ASSET_BUY_KEY);
    return { toppedUp: true, amount: pending.amount };
  }

  if (pending.majorId && opts.buyMajorFn) {
    const res = await opts.buyMajorFn({
      data: {
        wallet_id: opts.walletId,
        major_id: pending.majorId,
        usd_amount: pending.amount,
      },
    });
    sessionStorage.removeItem(PENDING_ASSET_BUY_KEY);
    return {
      bought: true,
      symbol: res.symbol,
      tokenAmount: res.token_amount,
      amount: pending.amount,
    };
  }

  if (pending.graduated && opts.swapFn) {
    const res = await opts.swapFn({
      data: {
        wallet_id: opts.walletId,
        from_id: OUSD_SWAP_ID,
        to_id: pending.tokenId,
        amount: pending.amount,
        slippage: 1,
      },
    });
    sessionStorage.removeItem(PENDING_ASSET_BUY_KEY);
    return {
      bought: true,
      symbol: pending.symbol,
      tokenAmount: res.amount_out,
      amount: pending.amount,
    };
  }

  if (pending.graduated) {
    sessionStorage.removeItem(PENDING_ASSET_BUY_KEY);
    return { toppedUp: true, amount: pending.amount, needsSwap: true as const };
  }

  const res = await opts.buyFn({
    data: {
      token_id: pending.tokenId,
      wallet_id: opts.walletId,
      pi_amount: pending.amount,
    },
  });
  sessionStorage.removeItem(PENDING_ASSET_BUY_KEY);
  if (res.graduated) opts.onGraduated?.(pending.tokenId);
  return {
    bought: true,
    symbol: pending.symbol,
    tokenAmount: res.token_amount,
    amount: pending.amount,
  };
}

export { PENDING_ASSET_BUY_KEY, PENDING_CHARGE_KEY, PENDING_PAYLINK_KEY };
