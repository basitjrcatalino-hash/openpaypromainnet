import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X, Settings2, Sparkles, Wallet as WalletIcon, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buyOpenToken, sellOpenToken } from "@/lib/opentoken.functions";
import { getOpenPayLinkStatus } from "@/lib/openpay-pro.functions";
import { topUpWithPi } from "@/lib/pi-network";
import {
  curveFromTokenRow,
  quoteBuy,
  quoteSell,
} from "@/lib/opentoken/bonding-curve";
import { formatNumber } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import { PaymentMethodPicker } from "@/components/payment-method-picker";

type BuyMethod = "openpay_balance" | "pi";

const BUY_METHODS = [
  {
    id: "openpay_balance" as const,
    label: "OpenPay Balance",
    icon: WalletIcon,
    desc: "Pay from your connected OpenPay account · real debit",
  },
  {
    id: "pi" as const,
    label: "Pi Network (π)",
    icon: Sparkles,
    desc: "Pay with Pi · 1 π = 1 OUSD credited instantly",
  },
];

const BUY_PRESETS = [
  { label: "10 OUSD", value: 10 },
  { label: "50 OUSD", value: 50 },
  { label: "100 OUSD", value: 100 },
];

export function TradePanel({
  token,
  walletId,
  userId,
  ousdBalance,
  tokenBalance,
  disabled,
  onClose,
}: {
  token: Record<string, any>;
  walletId?: string;
  userId: string;
  ousdBalance: number;
  tokenBalance: number;
  disabled?: boolean;
  onClose?: () => void;
}) {
  const qc = useQueryClient();
  const buyFn = useServerFn(buyOpenToken);
  const sellFn = useServerFn(sellOpenToken);
  const getLink = useServerFn(getOpenPayLinkStatus);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [payMethod, setPayMethod] = useState<BuyMethod>("openpay_balance");

  const { data: openpayLink } = useQuery({
    queryKey: ["openpay-link", userId],
    queryFn: () => getLink(),
  });

  const graduated = token.status === "graduated" || token.status === "halted";
  const curve = curveFromTokenRow(token);
  const amt = parseFloat(amount) || 0;
  const linked = !!openpayLink?.linked;

  const quote = useMemo(() => {
    if (side === "buy") return { kind: "buy" as const, ...quoteBuy(curve, amt) };
    return { kind: "sell" as const, ...quoteSell(curve, amt) };
  }, [curve, amt, side]);

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
        toast.error("Insufficient OUSD. Top up with OpenPay first.");
        return;
      }
    }

    setBusy(true);
    try {
      if (payMethod === "pi") {
        await topUpWithPi(amt);
        toast.success(`${formatNumber(amt, 2)} OUSD credited from Pi`);
      }

      const res = await buyFn({ data: { token_id: token.id, wallet_id: walletId, pi_amount: amt } });
      toast.success(`Bought ${formatNumber(res.token_amount, 4)} $${token.symbol}`);
      if (res.graduated) toast.success("Token graduated to OpenDEX!");
      setAmount("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ot-token", token.id] }),
        qc.invalidateQueries({ queryKey: ["ot-trades", token.id] }),
        qc.invalidateQueries({ queryKey: ["ot-ticks", token.id] }),
        qc.invalidateQueries({ queryKey: ["wallets"] }),
        qc.invalidateQueries({ queryKey: ["active-wallet", userId] }),
        qc.invalidateQueries({ queryKey: ["ot-holding"] }),
        qc.invalidateQueries({ queryKey: ["ot-portfolio"] }),
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
      toast.success(`Sold for ${formatNumber(res.pi_amount, 4)} OUSD`);
      setAmount("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ot-token", token.id] }),
        qc.invalidateQueries({ queryKey: ["ot-trades", token.id] }),
        qc.invalidateQueries({ queryKey: ["ot-ticks", token.id] }),
        qc.invalidateQueries({ queryKey: ["wallets"] }),
        qc.invalidateQueries({ queryKey: ["active-wallet", userId] }),
        qc.invalidateQueries({ queryKey: ["ot-holding"] }),
        qc.invalidateQueries({ queryKey: ["ot-portfolio"] }),
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
  }

  if (graduated) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-sm font-semibold text-foreground">OpenDEX</div>
        <p className="text-sm text-muted-foreground">
          This token graduated from the bonding curve. Trade it on OpenDEX with OUSD pairs.
        </p>
        <Button asChild className="w-full rounded-full">
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
    disabled ||
    !walletId ||
    amt <= 0 ||
    (payMethod === "openpay_balance" && !linked);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {side === "buy" ? `Buy $${token.symbol}` : `Sell $${token.symbol}`}
          </div>
          <div className="text-xs text-muted-foreground">
            Price {formatNumber(token.price_usd, token.price_usd < 0.01 ? 8 : 4)} OUSD
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground">
            <Settings2 className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        <button
          type="button"
          onClick={() => {
            setSide("buy");
            setAmount("");
          }}
          className={cn(
            "rounded-full py-2 text-sm font-medium transition-colors",
            side === "buy" ? "bg-emerald-500 text-black" : "text-muted-foreground hover:text-foreground/80",
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
            "rounded-full py-2 text-sm font-medium transition-colors",
            side === "sell" ? "bg-red-600 text-foreground" : "text-muted-foreground hover:text-foreground/80",
          )}
        >
          Sell
        </button>
      </div>

      <div className="flex flex-col items-center justify-center gap-1 py-4">
        <span className="text-5xl font-bold tabular-nums text-foreground">
          {amount || "0"}
        </span>
        <span className="text-sm font-medium text-muted-foreground">OUSD</span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {side === "buy" ? "OUSD" : `$${token.symbol}`}
        </span>
        <button
          type="button"
          className="text-emerald-400 hover:text-emerald-300"
          onClick={() =>
            setAmount(
              String(side === "buy" ? Math.max(0, ousdBalance) : Math.max(0, tokenBalance)),
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
                className="flex-1 rounded-full bg-muted py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <PaymentMethodPicker
            methods={BUY_METHODS}
            value={payMethod}
            onChange={setPayMethod}
          />

          {payMethod === "openpay_balance" && (
            <div className="rounded-2xl border border-border bg-muted/60 p-3 text-xs text-muted-foreground">
              {linked ? (
                <>
                  Paying from connected OpenPay
                  {openpayLink?.username
                    ? ` @${openpayLink.username}`
                    : openpayLink?.account_number
                      ? ` · ${openpayLink.account_number}`
                      : ""}
                  . Your wallet OUSD balance is debited for this buy.
                </>
              ) : (
                <span className="flex flex-wrap items-center gap-2">
                  Connect your OpenPay account first to buy with OpenPay Balance.
                  <Link to="/settings" className="inline-flex items-center gap-1 font-medium text-emerald-400">
                    <Link2 className="h-3.5 w-3.5" />
                    Settings → Connect
                  </Link>
                </span>
              )}
            </div>
          )}

          {payMethod === "pi" && (
            <div className="rounded-2xl border border-border bg-muted/60 p-3 text-xs text-muted-foreground">
              Pay with Pi Network. 1 π = 1 OUSD credited instantly, then your buy executes.
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
              onClick={() => setAmount(String(preset.value))}
              className="flex-1 rounded-full bg-muted py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
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
                <span className="tabular-nums text-foreground">
                  {formatNumber(quote.tokenOut, 4)} ${token.symbol}
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
                <span className="tabular-nums text-foreground">
                  {formatNumber(quote.piOut, 4)} OUSD
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
              "flex h-14 items-center justify-center rounded-2xl text-xl font-medium text-foreground transition",
              key === "backspace"
                ? "bg-transparent text-muted-foreground hover:text-foreground"
                : "bg-muted/40 hover:bg-muted",
            )}
          >
            {key === "backspace" ? "‹" : key}
          </button>
        ))}
      </div>

      <Button
        className={cn(
          "w-full rounded-full py-6 text-base font-semibold shadow-lg",
          side === "buy"
            ? "bg-emerald-500 text-black shadow-emerald-900/30 hover:bg-emerald-400"
            : "bg-red-600 text-foreground shadow-red-900/30 hover:bg-red-500",
        )}
        disabled={side === "buy" ? buyDisabled : busy || disabled || !walletId || amt <= 0}
        onClick={submit}
      >
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {side === "buy"
          ? payMethod === "pi"
            ? `Pay ${amt > 0 ? `${amt} OUSD` : ""} with Pi`
            : linked
              ? `Buy $${token.symbol}`
              : "Connect OpenPay to continue"
          : `Sell $${token.symbol}`}
      </Button>
    </div>
  );
}
