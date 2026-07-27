import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, X, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buyOpenToken, sellOpenToken } from "@/lib/opentoken.functions";
import {
  curveFromTokenRow,
  quoteBuy,
  quoteSell,
} from "@/lib/opentoken/bonding-curve";
import { formatNumber } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

/* ── quick-amount presets ─────────────────────────────────────────── */
const BUY_PRESETS = [
  { label: "₱10", value: 10 },
  { label: "₱50", value: 50 },
  { label: "₱100", value: 100 },
];

export function TradePanel({
  token,
  walletId,
  piBalance,
  tokenBalance,
  disabled,
  onClose,
}: {
  token: Record<string, any>;
  walletId?: string;
  piBalance: number;
  tokenBalance: number;
  disabled?: boolean;
  onClose?: () => void;
}) {
  const qc = useQueryClient();
  const buyFn = useServerFn(buyOpenToken);
  const sellFn = useServerFn(sellOpenToken);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const graduated = token.status === "graduated" || token.status === "halted";
  const curve = curveFromTokenRow(token);
  const amt = parseFloat(amount) || 0;

  const quote = useMemo(() => {
    if (side === "buy") return { kind: "buy" as const, ...quoteBuy(curve, amt) };
    return { kind: "sell" as const, ...quoteSell(curve, amt) };
  }, [curve, amt, side]);

  async function submit() {
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
      if (side === "buy") {
        const res = await buyFn({ data: { token_id: token.id, wallet_id: walletId, pi_amount: amt } });
        toast.success(`Bought ${formatNumber(res.token_amount, 4)} $${token.symbol}`);
        if (res.graduated) toast.success("Token graduated to OpenDEX!");
      } else {
        const res = await sellFn({
          data: { token_id: token.id, wallet_id: walletId, token_amount: amt },
        });
        toast.success(`Sold for ${formatNumber(res.pi_amount, 4)} OUSD`);
      }
      setAmount("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ot-token", token.id] }),
        qc.invalidateQueries({ queryKey: ["ot-trades", token.id] }),
        qc.invalidateQueries({ queryKey: ["ot-ticks", token.id] }),
        qc.invalidateQueries({ queryKey: ["wallets"] }),
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

  /* ── graduated state ───────────────────────────────────────────── */
  if (graduated) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-sm font-semibold text-white">Advanced trading</div>
        <p className="text-sm text-zinc-500">
          This token graduated from the bonding curve. OpenPay Swap / OpenDEX integration coming soon.
        </p>
        <Button className="w-full rounded-full bg-zinc-800 text-zinc-400" disabled>
          OpenDEX soon
        </Button>
      </div>
    );
  }

  /* ── numpad handler ─────────────────────────────────────────────── */
  function onNumpad(key: string) {
    if (key === "backspace") {
      setAmount((prev) => prev.slice(0, -1));
    } else if (key === ".") {
      if (!amount.includes(".")) setAmount((prev) => prev + ".");
    } else {
      setAmount((prev) => prev + key);
    }
  }

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">
            {side === "buy" ? `Buy $${token.symbol}` : `Sell $${token.symbol}`}
          </div>
          <div className="text-xs text-zinc-500">
            Price ₱{formatNumber(token.price_usd, token.price_usd < 0.01 ? 8 : 4)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-zinc-500 hover:text-white">
            <Settings2 className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-zinc-500 hover:text-white" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* buy/sell toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-zinc-900 p-1">
        <button
          type="button"
          onClick={() => { setSide("buy"); setAmount(""); }}
          className={cn(
            "rounded-full py-2 text-sm font-medium transition-colors",
            side === "buy"
              ? "bg-purple-600 text-white"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => { setSide("sell"); setAmount(""); }}
          className={cn(
            "rounded-full py-2 text-sm font-medium transition-colors",
            side === "sell"
              ? "bg-red-600 text-white"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          Sell
        </button>
      </div>

      {/* large amount display */}
      <div className="flex items-center justify-center py-6">
        <span className="text-5xl font-bold tabular-nums text-white">
          ₱{amount || "0"}
        </span>
      </div>

      {/* balance + payment method */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">
          {side === "buy" ? "OUSD" : `$${token.symbol}`} · Free
        </span>
        <button
          type="button"
          className="text-purple-400 hover:text-purple-300"
          onClick={() =>
            setAmount(String(side === "buy" ? Math.max(0, piBalance) : Math.max(0, tokenBalance)))
          }
        >
          Bal: {formatNumber(side === "buy" ? piBalance : tokenBalance, 4)}
        </button>
      </div>

      {/* quick amount chips */}
      <div className="flex gap-2">
        {(side === "buy" ? BUY_PRESETS : [
          { label: "25%", value: tokenBalance * 0.25 },
          { label: "50%", value: tokenBalance * 0.5 },
          { label: "Max", value: tokenBalance },
        ]).map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setAmount(String(preset.value))}
            className="flex-1 rounded-full bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* quote summary */}
      {amt > 0 && (
        <div className="space-y-1.5 rounded-2xl bg-zinc-900/60 px-4 py-3 text-xs">
          {quote.kind === "buy" ? (
            <>
              <div className="flex justify-between">
                <span className="text-zinc-500">You receive</span>
                <span className="tabular-nums text-white">{formatNumber(quote.tokenOut, 4)} ${token.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Avg price</span>
                <span className="tabular-nums text-zinc-400">{formatNumber(quote.avgPrice, 8)} OUSD</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-zinc-500">You receive</span>
                <span className="tabular-nums text-white">{formatNumber(quote.piOut, 4)} OUSD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Avg price</span>
                <span className="tabular-nums text-zinc-400">{formatNumber(quote.avgPrice, 8)} OUSD</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* numpad */}
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onNumpad(key)}
            className={cn(
              "flex h-14 items-center justify-center rounded-2xl text-xl font-medium text-white transition",
              key === "backspace"
                ? "bg-transparent text-zinc-400 hover:text-white"
                : "bg-zinc-900/40 hover:bg-zinc-800",
            )}
          >
            {key === "backspace" ? "‹" : key}
          </button>
        ))}
      </div>

      {/* submit */}
      <Button
        className={cn(
          "w-full rounded-full py-6 text-base font-semibold shadow-lg",
          side === "buy"
            ? "bg-purple-600 text-white shadow-purple-900/30 hover:bg-purple-500"
            : "bg-red-600 text-white shadow-red-900/30 hover:bg-red-500",
        )}
        disabled={busy || disabled || !walletId || amt <= 0}
        onClick={submit}
      >
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {side === "buy" ? `Buy $${token.symbol}` : `Sell $${token.symbol}`}
      </Button>
    </div>
  );
}
