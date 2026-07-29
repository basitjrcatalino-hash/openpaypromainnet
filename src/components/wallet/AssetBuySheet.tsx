import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Loader2, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { PaymentMethodPicker } from "@/components/payment-method-picker";
import { buyOpenToken } from "@/lib/opentoken.functions";
import { isOpenTokenGraduated } from "@/lib/opentoken/bonding-curve";
import { topUpWithPi } from "@/lib/pi-network";
import {
  createOpenPayTopupCharge,
  getOpenPayLinkStatus,
} from "@/lib/openpay-pro.functions";
import { creditMoonPayTopup } from "@/lib/moonpay-topup.functions";
import { isSolanaMerchantConfigured } from "@/lib/solana-payment";
import { creditSolanaPayTopup } from "@/lib/solana-topup.functions";
import { MoonPayBuyOverlay } from "@/components/moonpay-buy-overlay";
import { SolanaPaymentButton } from "@/components/solana-payment-button";
import { OUSD_LOGO_URL, PI_NETWORK_LOGO_URL } from "@/lib/token-logos";
import { cn } from "@/lib/utils";
import { formatNumber, formatOUSD, formatUSD } from "@/lib/wallet-utils";

export type AssetBuyTarget = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  isOusd?: boolean;
  status?: string | null;
};

type PaymentMethod = "wallet_ousd" | "pi" | "openpay_checkout" | "moonpay" | "solana";

const PRESETS = [10, 25, 50, 100, 250];
const PENDING_CHARGE_KEY = "openpay_pending_charge";
const PENDING_PAYLINK_KEY = "openpay_pending_paylink";
const PENDING_ASSET_BUY_KEY = "asset_pending_buy";

const amountSchema = z.coerce.number().positive().min(1).max(50_000);

const ALL_METHODS: {
  id: PaymentMethod;
  label: string;
  logoUrl?: string;
  icon?: typeof CreditCard;
  solanaMark?: boolean;
  desc: string;
}[] = [
  {
    id: "wallet_ousd",
    label: "Wallet OUSD",
    logoUrl: OUSD_LOGO_URL,
    desc: "Pay with your OpenPay Pro OUSD balance",
  },
  {
    id: "openpay_checkout",
    label: "OpenPay Balance",
    logoUrl: OUSD_LOGO_URL,
    desc: "Pay from your connected OpenPay account",
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
    desc: "Pay with Pi · 1 π = 1 OUSD",
  },
  {
    id: "solana",
    label: "Solana Pay",
    solanaMark: true,
    desc: "Pay with SOL or USDC · 1 USD = 1 OUSD",
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

export function AssetBuySheet({
  open,
  onClose,
  userId,
  walletId,
  ousdBalance,
  token,
  returnPath,
  onNavigateSwap,
}: Props) {
  const qc = useQueryClient();
  const buyFn = useServerFn(buyOpenToken);
  const createCharge = useServerFn(createOpenPayTopupCharge);
  const getLink = useServerFn(getOpenPayLinkStatus);

  const [amount, setAmount] = useState("25");
  const [method, setMethod] = useState<PaymentMethod>(
    token.isOusd ? "pi" : "wallet_ousd",
  );
  const [busy, setBusy] = useState(false);
  const [moonpayVisible, setMoonpayVisible] = useState(false);
  const [moonpaySession, setMoonpaySession] = useState<{
    amount: number;
    externalTransactionId: string;
  } | null>(null);
  const creditMoonPay = useServerFn(creditMoonPayTopup);
  const creditSolana = useServerFn(creditSolanaPayTopup);

  const isOusd = !!token.isOusd;
  const graduated = !isOusd && isOpenTokenGraduated(token);
  const solanaReady = isSolanaMerchantConfigured();
  const methods = ALL_METHODS.filter((m) => {
    if (isOusd && m.id === "wallet_ousd") return false;
    if (!solanaReady && m.id === "solana") return false;
    return true;
  });

  const { data: openpayLink } = useQuery({
    queryKey: ["openpay-link", userId],
    queryFn: () => getLink(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setAmount("25");
    setMethod(isOusd ? "pi" : "wallet_ousd");
  }, [open, isOusd]);

  const amtNum = Number(amount) || 0;
  const parsed = amountSchema.safeParse({ amount: amtNum });
  const valid = parsed.success;

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
    ]);
  }

  async function startOpenPayCheckout(amt: number) {
    const link = await getLink();
    if (!link?.linked) {
      toast.error("Connect OpenPay in Settings first");
      return;
    }
    if (!walletId) {
      toast.error("Select an active wallet first");
      return;
    }

    try {
      sessionStorage.setItem(
        PENDING_ASSET_BUY_KEY,
        JSON.stringify({
          tokenId: token.id,
          symbol: token.symbol,
          isOusd,
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
    if (!valid) {
      toast.error("Enter a valid amount (min $1)");
      return;
    }
    const amt = amtNum;

    setBusy(true);
    try {
      if (isOusd) {
        if (method === "pi") {
          await topUpWithPi(amt);
          toast.success(`${formatUSD(amt)} OUSD credited from Pi`);
          await invalidateAfterTopup();
          onClose();
          return;
        }
        if (method === "moonpay") {
          if (!walletId) { toast.error("Select an active wallet first"); return; }
          const externalTransactionId = `ousd_${walletId}_${Date.now()}`;
          setMoonpaySession({ amount: amt, externalTransactionId });
          setMoonpayVisible(true);
          setBusy(false);
          return;
        }
        if (method === "solana") {
          setBusy(false);
          return;
        }
        await startOpenPayCheckout(amt);
        return;
      }

      if (graduated) {
        if (method === "wallet_ousd") {
          if (ousdBalance < amt) {
            toast.error(`Need ${formatUSD(amt)} OUSD — top up first`);
            return;
          }
          onClose();
          onNavigateSwap?.();
          return;
        }
        if (method === "pi") {
          await topUpWithPi(amt);
          toast.success(`${formatUSD(amt)} OUSD credited — opening swap`);
          await invalidateAfterTopup();
          onClose();
          onNavigateSwap?.();
          return;
        }
        await startOpenPayCheckout(amt);
        return;
      }

      // Bonding curve token buy
      if (method === "wallet_ousd") {
        if (ousdBalance < amt) {
          toast.error(`Need ${formatUSD(amt)} OUSD (balance ${formatUSD(ousdBalance)})`);
          return;
        }
        await executeTokenBuy(amt);
        return;
      }

      if (method === "pi") {
        await topUpWithPi(amt);
        toast.success(`${formatUSD(amt)} OUSD credited from Pi`);
        await executeTokenBuy(amt);
        return;
      }

      if (method === "moonpay") {
        if (!walletId) { toast.error("Select an active wallet first"); return; }
        const externalTransactionId = `ousd_${walletId}_${Date.now()}`;
        setMoonpaySession({ amount: amt, externalTransactionId });
        setMoonpayVisible(true);
        setBusy(false);
        return;
      }

      if (method === "solana") {
        setBusy(false);
        return;
      }

      await startOpenPayCheckout(amt);
    } catch (err) {
      toast.error((err as Error).message || "Purchase failed");
    } finally {
      setBusy(false);
    }
  }

  const ctaLabel = isOusd
    ? method === "pi"
      ? `Buy ${valid ? formatUSD(amtNum) : ""} OUSD with Pi`
      : method === "moonpay"
        ? `Buy with Card`
        : method === "solana"
          ? `Pay with Solana`
          : `Pay ${valid ? formatUSD(amtNum) : ""} with OpenPay`
    : graduated
      ? method === "wallet_ousd"
        ? `Swap for $${token.symbol}`
        : method === "pi"
          ? `Top up & swap`
          : method === "moonpay"
            ? `Buy with Card & Swap`
            : method === "solana"
              ? `Pay with Solana & Swap`
              : `Pay with OpenPay`
      : method === "wallet_ousd"
        ? `Buy $${token.symbol}`
        : method === "pi"
          ? `Pay with Pi & Buy`
          : method === "moonpay"
            ? `Buy with Card`
            : method === "solana"
              ? `Pay with Solana & Buy`
              : `Pay with OpenPay & Buy`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-background/80 backdrop-blur-sm">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-card px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/40" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold">Buy {token.name}</div>
            <div className="text-sm text-muted-foreground">
              Price{" "}
              {isOusd
                ? formatUSD(token.price)
                : formatOUSD(token.price, { price: true, suffix: false })}{" "}
              {!isOusd && <span className="text-muted-foreground">OUSD</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground press"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-1 py-4">
          <span className="text-5xl font-bold tabular-nums tracking-tight">
            {amount || "0"}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {isOusd ? "USD" : "OUSD"}
          </span>
        </div>

        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(String(p))}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold press",
                amount === String(p) ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              ${p}
            </button>
          ))}
        </div>

        <PaymentMethodPicker methods={methods} value={method} onChange={setMethod} className="mb-4" />

        {method === "openpay_checkout" && !openpayLink?.linked && (
          <div className="mb-4 rounded-2xl bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
            Connect OpenPay to pay via checkout.{" "}
            <Link to="/settings" className="inline-flex items-center gap-1 font-semibold text-primary">
              <Link2 className="h-3.5 w-3.5" />
              Settings
            </Link>
          </div>
        )}

        {!isOusd && method === "wallet_ousd" && (
          <p className="mb-4 text-center text-xs text-muted-foreground">
            Balance: {formatNumber(ousdBalance, 2)} OUSD
          </p>
        )}

        {method === "solana" && solanaReady ? (
          <SolanaPaymentButton
            mode="buyNow"
            showQR
            position="inline"
            className="w-full"
            paymentConfig={{
              products: [
                {
                  id: `asset-buy-${token.id}-${amtNum}`,
                  name: isOusd ? `OUSD top-up ${formatUSD(amtNum)}` : `Buy $${token.symbol}`,
                  price: amtNum,
                  quantity: 1,
                },
              ],
            }}
            onPaymentStart={() => setBusy(true)}
            onPaymentSuccess={(signature) => {
              void (async () => {
                try {
                  await creditSolana({ data: { signature, wallet_id: walletId! } });
                  toast.success(`${formatUSD(amtNum)} OUSD credited from Solana`);
                  if (!isOusd && !graduated) {
                    await executeTokenBuy(amtNum);
                  } else {
                    await invalidateAfterTopup();
                    onClose();
                  }
                } catch (err) {
                  toast.error((err as Error).message || "Solana top-up failed");
                } finally {
                  setBusy(false);
                }
              })();
            }}
            onPaymentError={() => setBusy(false)}
            onCancel={() => setBusy(false)}
          >
            <button
              type="button"
              disabled={busy || !valid}
              className="flex h-12 w-full items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground press disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : ctaLabel}
            </button>
          </SolanaPaymentButton>
        ) : (
          <Button
            type="button"
            className="h-12 w-full rounded-full text-base font-bold"
            disabled={busy || !valid || (method === "openpay_checkout" && !openpayLink?.linked)}
            onClick={() => void submit()}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : ctaLabel}
          </Button>
        )}

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
                await creditMoonPay({ data: { transaction_id: id, wallet_id: walletId! } });
                toast.success(`${formatUSD(paid)} OUSD credited from MoonPay`);
                if (!isOusd && !graduated) {
                  await executeTokenBuy(paid);
                } else {
                  await invalidateAfterTopup();
                  onClose();
                }
              } catch (err) {
                toast.error((err as Error).message || "MoonPay credit failed");
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Run pending token buy after OpenPay return settles OUSD. */
export async function runPendingAssetBuy(opts: {
  buyFn: (args: { data: { token_id: string; wallet_id: string; pi_amount: number } }) => Promise<{
    token_amount: number;
    graduated?: boolean;
  }>;
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
    amount: number;
    graduated?: boolean;
  };

  if (pending.isOusd || pending.graduated) {
    sessionStorage.removeItem(PENDING_ASSET_BUY_KEY);
    return { toppedUp: true, amount: pending.amount };
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
