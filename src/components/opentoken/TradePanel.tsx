import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buyOpenToken, sellOpenToken } from "@/lib/opentoken.functions";
import {
  curveFromTokenRow,
  quoteBuy,
  quoteSell,
} from "@/lib/opentoken/bonding-curve";
import { formatNumber } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export function TradePanel({
  token,
  walletId,
  piBalance,
  tokenBalance,
  disabled,
}: {
  token: Record<string, any>;
  walletId?: string;
  piBalance: number;
  tokenBalance: number;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const buyFn = useServerFn(buyOpenToken);
  const sellFn = useServerFn(sellOpenToken);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [payAsset, setPayAsset] = useState<"pi" | "ousd">("pi");

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
    if (payAsset !== "pi") {
      toast.message("OUSD trading coming soon");
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
        toast.success(`Sold for ${formatNumber(res.pi_amount, 4)} π`);
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
    } catch (err) {
      toast.error((err as Error).message || "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  if (graduated) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="text-sm font-semibold">Advanced trading</div>
        <p className="mt-2 text-sm text-muted-foreground">
          This token graduated from the bonding curve. OpenPay Swap / OpenDEX integration is coming soon.
        </p>
        <Button className="mt-4 w-full rounded-full" variant="outline" disabled>
          OpenDEX soon
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <Tabs value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}>
        <TabsList className="grid w-full grid-cols-2 rounded-full">
          <TabsTrigger value="buy" className="rounded-full">Buy</TabsTrigger>
          <TabsTrigger value="sell" className="rounded-full">Sell</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setPayAsset("pi")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            payAsset === "pi" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          Pi
        </button>
        <button
          type="button"
          onClick={() => setPayAsset("ousd")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            payAsset === "ousd" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          OUSD soon
        </button>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{side === "buy" ? "You pay (π)" : `You sell ($${token.symbol})`}</span>
          <button
            type="button"
            className="text-primary"
            onClick={() =>
              setAmount(String(side === "buy" ? Math.max(0, piBalance) : Math.max(0, tokenBalance)))
            }
          >
            Bal {formatNumber(side === "buy" ? piBalance : tokenBalance, 4)}
          </button>
        </div>
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0.0"
          className="rounded-xl text-lg"
        />
      </div>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {quote.kind === "buy" ? (
          <>
            <div className="flex justify-between">
              <span>You receive</span>
              <span className="tabular-nums text-foreground">{formatNumber(quote.tokenOut, 4)} ${token.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg price</span>
              <span className="tabular-nums">{formatNumber(quote.avgPrice, 8)} π</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span>You receive</span>
              <span className="tabular-nums text-foreground">{formatNumber(quote.piOut, 4)} π</span>
            </div>
            <div className="flex justify-between">
              <span>Avg price</span>
              <span className="tabular-nums">{formatNumber(quote.avgPrice, 8)} π</span>
            </div>
          </>
        )}
      </div>

      <Button
        className={cn(
          "mt-4 w-full rounded-full",
          side === "buy" ? "bg-gradient-primary text-primary-foreground" : "",
        )}
        variant={side === "sell" ? "destructive" : "default"}
        disabled={busy || disabled || !walletId}
        onClick={submit}
      >
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {side === "buy" ? `Buy $${token.symbol}` : `Sell $${token.symbol}`}
      </Button>
    </div>
  );
}
