import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X, Link2, Plus } from "lucide-react";
import { toast } from "sonner";
import { notifySuccess } from "@/lib/notify-success";
import { Button } from "@/components/ui/button";
import { buyOpenToken, sellOpenToken } from "@/lib/opentoken.functions";
import { TxConfirmModal } from "@/components/wallet/TxConfirmModal";
import {
  createOpenPayTopupCharge,
  getOpenPayLinkStatus,
  settleOpenPayCharge,
  settleOpenPayPayLinkTopup,
} from "@/lib/openpay-pro.functions";
import { topUpWithPi } from "@/lib/pi-network";
import {
  curveFromTokenRow,
  isOpenTokenGraduated,
  quoteBuy,
  quoteSell,
  OPENTOKEN_TRADE_FEE_BPS,
} from "@/lib/opentoken/bonding-curve";
import { formatNumber } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import { PaymentMethodPicker } from "@/components/payment-method-picker";
import { OUSD_LOGO_URL, PI_NETWORK_LOGO_URL } from "@/lib/token-logos";

type BuyMethod = "openpay_balance" | "pi";

const BUY_METHODS = [
  {
    id: "openpay_balance" as const,
    label: "OpenPay Balance",
    logoUrl: OUSD_LOGO_URL,
    desc: "Pay / top up from connected OpenPay · same as Buy",
  },
  {
    id: "pi" as const,
    label: "Pi Network (π)",
    logoUrl: PI_NETWORK_LOGO_URL,
    desc: "Pay with Pi · live π price → OUSD ($1) credited instantly",
  },
];
const BUY_PRESETS = [
  { label: "10", value: 10 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
];

const PENDING_CHARGE_KEY = "openpay_pending_charge";
const PENDING_PAYLINK_KEY = "openpay_pending_paylink";

/** Store a clean amount string (avoid float junk like 1153846.15384615). */
function toAmountInput(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  const decimals = Math.abs(n) >= 1_000_000 ? 2 : 8;
  return String(Number(n.toFixed(decimals)));
}

/** Compact / group the hero amount when it would overflow the screen. */
function formatAmountDisplay(raw: string): string {
  if (!raw) return "0";
  if (raw.endsWith(".")) return raw;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  if (Math.abs(n) >= 1_000_000) return formatNumber(n, 2, { compact: true });
  if (Math.abs(n) >= 10_000) {
    const frac = raw.includes(".") ? Math.min(4, (raw.split(".")[1] ?? "").length) : 0;
    return formatNumber(n, frac, { compact: false });
  }
  return raw;
}

export function TradePanel({
  token,
  walletId,
  userId,
  ousdBalance,
  tokenBalance,
  disabled,
  onClose,
  returnPath,
}: {
  token: Record<string, any>;
  walletId?: string;
  userId: string;
  ousdBalance: number;
  tokenBalance: number;
  disabled?: boolean;
  onClose?: () => void;
  /** Where OpenPay checkout should return (defaults to this token page). */
  returnPath?: string;
}) {
  const qc = useQueryClient();
  const buyFn = useServerFn(buyOpenToken);
  const sellFn = useServerFn(sellOpenToken);
  const getLink = useServerFn(getOpenPayLinkStatus);
  const createCharge = useServerFn(createOpenPayTopupCharge);
  const settleCharge = useServerFn(settleOpenPayCharge);
  const settlePayLink = useServerFn(settleOpenPayPayLinkTopup);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<BuyMethod>("openpay_balance");

  const { data: openpayLink } = useQuery({
    queryKey: ["openpay-link", userId],
    queryFn: () => getLink(),
  });

  const halted = token.status === "halted";
  // Only block OpenToken trading after true 100k OUSD graduation (or halt).
  const graduated = halted || isOpenTokenGraduated(token);
  const curve = curveFromTokenRow(token);
  const amt = parseFloat(amount) || 0;
  const linked = !!openpayLink?.linked;
  const needTopup = side === "buy" && payMethod === "openpay_balance" && amt > 0 && ousdBalance < amt;
  const topupAmount = Math.max(0, Math.ceil((amt - ousdBalance) * 100) / 100);
  const retPath = returnPath || `/opentoken/${token.id}`;

  // Settle OpenPay return when landing back on this token page
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const canceled = params.get("openpay_cancel");
    const returned = params.get("openpay_return");
    const chargeId =
      params.get("openpay_charge") ||
      (() => {
        try {
          return sessionStorage.getItem(PENDING_CHARGE_KEY);
        } catch {
          return null;
        }
      })();
    const openpayRef = params.get("openpay_ref");
    const openpayTx = params.get("openpay_tx");

    if (canceled) {
      toast.error("OpenPay payment canceled");
      cleanReturnParams();
      return;
    }

    if (!returned && !chargeId) return;

    void (async () => {
      try {
        if (openpayRef || returned) {
          let pending: { reference?: string; amount?: number } | null = null;
          try {
            pending = JSON.parse(sessionStorage.getItem(PENDING_PAYLINK_KEY) || "null");
          } catch {
            /* ignore */
          }
          const reference = openpayRef || pending?.reference;
          if (reference) {
            const r = await settlePayLink({
              data: { reference, txId: openpayTx || undefined, fromReturn: true },
            });
            if (r.credited) notifySuccess("OpenPay payment complete · OUSD credited", { sound: "receive" });
            else toast.message((r as { message?: string }).message || "Confirming payment…");
          }
        }
        if (chargeId) {
          const r = await settleCharge({ data: { chargeId } });
          if (r.credited) notifySuccess("OpenPay payment complete · OUSD credited", { sound: "receive" });
          else if (r.status) toast.message(`OpenPay charge status: ${r.status}`);
        }
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["active-wallet", userId] }),
          qc.invalidateQueries({ queryKey: ["wallets"] }),
        ]);
      } catch (err) {
        toast.error((err as Error).message || "Could not confirm OpenPay payment");
      } finally {
        try {
          sessionStorage.removeItem(PENDING_CHARGE_KEY);
          sessionStorage.removeItem(PENDING_PAYLINK_KEY);
        } catch {
          /* ignore */
        }
        cleanReturnParams();
      }
    })();
  }, [settleCharge, settlePayLink, qc, userId]);

  function cleanReturnParams() {
    const u = new URL(window.location.href);
    ["openpay_return", "openpay_cancel", "openpay_charge", "openpay_ref", "openpay_tx"].forEach((k) =>
      u.searchParams.delete(k),
    );
    window.history.replaceState({}, "", u.pathname + u.search);
  }

  const quote = useMemo(() => {
    if (side === "buy") return { kind: "buy" as const, ...quoteBuy(curve, amt) };
    return { kind: "sell" as const, ...quoteSell(curve, amt) };
  }, [curve, amt, side]);

  async function payWithOpenPay(topupAmt: number) {
    if (!walletId) {
      toast.error("Create a wallet first");
      return;
    }
    if (!linked) {
      toast.error("Connect OpenPay in Settings first");
      return;
    }
    if (topupAmt <= 0) {
      toast.error("Enter an amount to pay");
      return;
    }
    setPayBusy(true);
    try {
      const res = await createCharge({
        data: {
          amount: topupAmt,
          origin: window.location.origin,
          walletId,
          returnPath: retPath,
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
    } catch (err) {
      toast.error((err as Error).message || "OpenPay payment failed");
      setPayBusy(false);
    }
  }

  async function executeBuy() {
    if (!walletId) {
      toast.error("Create a wallet first");
      return;
    }
    if (amt <= 0) {
      toast.error("Enter an amount");
      return;
    }

    if (payMethod === "openpay_balance") {
      if (!linked) {
        toast.error("Connect OpenPay in Settings first");
        return;
      }
      if (ousdBalance < amt) {
        await payWithOpenPay(Math.max(amt - ousdBalance, amt));
        return;
      }
    }

    setBusy(true);
    try {
      if (payMethod === "pi") {
        await topUpWithPi(amt);
        notifySuccess(`${formatNumber(amt, 2)} OUSD credited from Pi`, { sound: "receive" });
      }

      const res = await buyFn({ data: { token_id: token.id, wallet_id: walletId, pi_amount: amt } });
      notifySuccess(`Bought ${formatNumber(res.token_amount, 4)} $${token.symbol}`, { sound: "receive" });
      if (res.graduated) notifySuccess("Token graduated to OpenDEX!", { sound: "success" });
      setAmount("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ot-token", token.id] }),
        qc.invalidateQueries({ queryKey: ["ot-trades", token.id] }),
        qc.invalidateQueries({ queryKey: ["ot-ticks", token.id] }),
        qc.invalidateQueries({ queryKey: ["wallets"] }),
        qc.invalidateQueries({ queryKey: ["active-wallet", userId] }),
        qc.invalidateQueries({ queryKey: ["ot-holding"] }),
        qc.invalidateQueries({ queryKey: ["ot-portfolio"] }),
        qc.invalidateQueries({ queryKey: ["all-txs"] }),
        qc.invalidateQueries({ queryKey: ["recent-txs"] }),
      ]);
      onClose?.();
    } catch (err) {
      toast.error((err as Error).message || "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  async function executeSell() {
    if (!walletId) {
      toast.error("Create a wallet first");
      return;
    }
    if (amt <= 0) {
      toast.error("Enter an amount");
      return;
    }

    setBusy(true);
    try {
      const res = await sellFn({
        data: { token_id: token.id, wallet_id: walletId, token_amount: amt },
      });
      notifySuccess(`Sold for ${formatNumber(res.pi_amount, 4)} OUSD`, { sound: "send" });
      setAmount("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ot-token", token.id] }),
        qc.invalidateQueries({ queryKey: ["ot-trades", token.id] }),
        qc.invalidateQueries({ queryKey: ["ot-ticks", token.id] }),
        qc.invalidateQueries({ queryKey: ["wallets"] }),
        qc.invalidateQueries({ queryKey: ["active-wallet", userId] }),
        qc.invalidateQueries({ queryKey: ["ot-holding"] }),
        qc.invalidateQueries({ queryKey: ["ot-portfolio"] }),
        qc.invalidateQueries({ queryKey: ["all-txs"] }),
        qc.invalidateQueries({ queryKey: ["recent-txs"] }),
      ]);
      onClose?.();
    } catch (err) {
      toast.error((err as Error).message || "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (side === "buy") await executeBuy();
    else await executeSell();
    setConfirmOpen(false);
  }

  if (graduated) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-sm font-semibold">OpenDEX</div>
        <p className="text-sm text-muted-foreground">
          This token graduated from the bonding curve. Trade it on OpenDEX with OUSD pairs.
        </p>
        <Button asChild className="h-12 w-full rounded-full bg-primary font-bold text-primary-foreground">
          <Link to="/swap" search={{ token: token.id }}>
            Trade on OpenDEX
          </Link>
        </Button>
      </div>
    );
  }

  function onNumpad(key: string) {
    if (key === "backspace") {
      setAmount((prev) => prev.slice(0, -1));
    } else if (key === ".") {
      if (!amount.includes(".")) setAmount((prev) => prev + ".");
    } else {
      setAmount((prev) => prev + key);
    }
  }

  const buyDisabled =
    busy ||
    payBusy ||
    disabled ||
    !walletId ||
    amt <= 0 ||
    (payMethod === "openpay_balance" && !linked);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">
            {side === "buy" ? `Buy $${token.symbol}` : `Sell $${token.symbol}`}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatNumber(token.price_usd, token.price_usd < 0.01 ? 8 : 4)} OUSD
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted press"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        <button
          type="button"
          onClick={() => {
            setSide("buy");
            setAmount("");
          }}
          className={cn(
            "rounded-full py-2.5 text-sm font-bold press",
            side === "buy" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => {
            setSide("sell");
            setAmount("");
          }}
          className={cn(
            "rounded-full py-2.5 text-sm font-bold press",
            side === "sell" ? "bg-red-500 text-white" : "text-muted-foreground",
          )}
        >
          Sell
        </button>
      </div>

      <div className="flex flex-col items-center justify-center gap-1 py-3">
        <span className="max-w-full truncate text-5xl font-bold tabular-nums tracking-tight">
          {formatAmountDisplay(amount)}
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {side === "buy" ? "OUSD" : `$${token.symbol}`}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{side === "buy" ? "You pay" : `You sell`}</span>
        <button
          type="button"
          className="font-semibold text-primary"
          onClick={() =>
            setAmount(
              toAmountInput(side === "buy" ? Math.max(0, ousdBalance) : Math.max(0, tokenBalance)),
            )
          }
        >
          Bal: {formatNumber(side === "buy" ? ousdBalance : tokenBalance, 4)}
        </button>
      </div>

      {side === "buy" && (
        <>
          <div className="flex gap-2">
            {BUY_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setAmount(String(preset.value))}
                className="flex-1 rounded-full bg-muted py-2.5 text-sm font-semibold press hover:bg-muted/80"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <PaymentMethodPicker methods={BUY_METHODS} value={payMethod} onChange={setPayMethod} />

          {payMethod === "openpay_balance" && (
            <div className="space-y-2 rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground">
              {linked ? (
                <>
                  <p>
                    OpenPay connected
                    {openpayLink?.username
                      ? ` · @${openpayLink.username}`
                      : openpayLink?.account_number
                        ? ` · ${openpayLink.account_number}`
                        : ""}
                    . Buys debit your Pro OUSD; if balance is low we open OpenPay Pay (same as Top
                    up).
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full rounded-full border-border"
                    disabled={payBusy || !walletId}
                    onClick={() => void payWithOpenPay(amt > 0 ? amt : 25)}
                  >
                    {payBusy ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Add funds · Pay with OpenPay
                    {amt > 0 ? ` (${formatNumber(amt, 2)})` : ""}
                  </Button>
                </>
              ) : (
                <span className="flex flex-wrap items-center gap-2">
                  Connect OpenPay to pay with your balance.
                  <Link
                    to="/settings"
                    className="inline-flex items-center gap-1 font-semibold text-primary"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Settings → Connect
                  </Link>
                </span>
              )}
            </div>
          )}

          {needTopup && linked && (
            <div className="rounded-2xl bg-primary/10 px-3 py-2.5 text-xs text-foreground">
              Need {formatNumber(topupAmount, 2)} more OUSD. Tap Buy to pay with OpenPay first.
            </div>
          )}

          {payMethod === "pi" && (
            <div className="rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground">
              Pay with Pi Network. Live π market price converts to OUSD ($1), then your buy executes.
            </div>
          )}
        </>
      )}

      {side === "sell" && (
        <div className="flex gap-2">
          {[
            { label: "25%", value: tokenBalance * 0.25 },
            { label: "50%", value: tokenBalance * 0.5 },
            { label: "Max", value: tokenBalance },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setAmount(toAmountInput(preset.value))}
              className="flex-1 rounded-full bg-muted py-2.5 text-sm font-semibold press"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {amt > 0 && (
        <div className="space-y-1.5 rounded-2xl bg-muted/60 px-4 py-3 text-xs">
          {quote.kind === "buy" ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">You receive</span>
                <span className="font-semibold tabular-nums">
                  {formatNumber(quote.tokenOut, 4)} ${token.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Fee ({OPENTOKEN_TRADE_FEE_BPS / 100}%)
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(quote.fee, 4)} OUSD
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg price</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(quote.avgPrice, 8)} OUSD
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">You receive</span>
                <span className="font-semibold tabular-nums">
                  {formatNumber(quote.piOut, 4)} OUSD
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Fee ({OPENTOKEN_TRADE_FEE_BPS / 100}%)
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(quote.fee, 4)} OUSD
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg price</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(quote.avgPrice, 8)} OUSD
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onNumpad(key)}
            className={cn(
              "flex h-14 items-center justify-center rounded-2xl text-xl font-semibold press",
              key === "backspace"
                ? "bg-transparent text-muted-foreground"
                : "bg-muted/50 hover:bg-muted",
            )}
          >
            {key === "backspace" ? "‹" : key}
          </button>
        ))}
      </div>

      <Button
        className={cn(
          "h-14 w-full rounded-full text-base font-bold shadow-lg",
          side === "buy"
            ? "bg-primary text-primary-foreground"
            : "bg-red-500 text-white hover:bg-red-500/90",
        )}
        disabled={side === "buy" ? buyDisabled : busy || disabled || !walletId || amt <= 0}
        onClick={() => setConfirmOpen(true)}
      >
        {(busy || payBusy) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {side === "buy"
          ? payMethod === "pi"
            ? `Pay ${amt > 0 ? `${amt} ` : ""}with Pi & Buy`
            : !linked
              ? "Connect OpenPay to continue"
              : needTopup
                ? `Pay ${formatNumber(topupAmount, 2)} OUSD with OpenPay`
                : `Buy $${token.symbol}`
          : `Sell $${token.symbol}`}
      </Button>

      <TxConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={side === "buy" ? "Confirm buy" : "Confirm sell"}
        description={
          side === "buy"
            ? `Buy $${token.symbol} on the bonding curve`
            : `Sell $${token.symbol} for OUSD`
        }
        amount={
          side === "buy"
            ? `${formatNumber(amt, 4)} OUSD`
            : `${formatNumber(amt, amt < 1 ? 6 : 4)} $${token.symbol}`
        }
        subtitle={
          amt > 0
            ? quote.kind === "buy"
              ? `≈ ${formatNumber(quote.tokenOut, 0)} $${token.symbol}`
              : `≈ ${formatNumber(quote.piOut, 4)} OUSD`
            : undefined
        }
        rows={[
          { label: "Token", value: `$${token.symbol}` },
          { label: "Side", value: side === "buy" ? "Buy" : "Sell" },
          ...(side === "buy"
            ? [
                {
                  label: "Pay with",
                  value: payMethod === "pi" ? "Pi Network" : "OpenPay / OUSD",
                },
                {
                  label: "You receive",
                  value:
                    quote.kind === "buy"
                      ? `${formatNumber(quote.tokenOut, 0)} $${token.symbol}`
                      : "—",
                },
              ]
            : [
                {
                  label: "You receive",
                  value:
                    quote.kind === "sell" ? `${formatNumber(quote.piOut, 4)} OUSD` : "—",
                },
              ]),
          {
            label: "Fee",
            value: `${formatNumber(quote.fee, 4)} OUSD`,
          },
        ]}
        confirmLabel={
          side === "buy"
            ? payMethod === "pi"
              ? `Pay with Pi & Buy`
              : needTopup
                ? `Pay ${formatNumber(topupAmount, 2)} OUSD & Buy`
                : `Buy $${token.symbol}`
            : `Sell $${token.symbol}`
        }
        busy={busy || payBusy}
        variant={side === "sell" ? "destructive" : "default"}
        onConfirm={() => void submit()}
      />
    </div>
  );
}
