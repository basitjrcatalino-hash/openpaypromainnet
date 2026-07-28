import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_LAUNCH_FEE_OUSD,
  DEFAULT_TOTAL_SUPPLY,
  DEFAULT_VIRTUAL_PI,
  DEFAULT_VIRTUAL_TOKENS,
  curveFromTokenRow,
  quoteBuy,
} from "@/lib/opentoken/bonding-curve";
import { formatNumber } from "@/lib/wallet-utils";

const BUY_PRESETS = [0, 10, 50, 100, 250];

export function FairLaunchConfirm({
  name,
  symbol,
  fee = DEFAULT_LAUNCH_FEE_OUSD,
  busy,
  ousdBalance = 0,
  initialBuy,
  onInitialBuyChange,
  onBack,
  onConfirm,
}: {
  name: string;
  symbol: string;
  fee?: number;
  busy?: boolean;
  ousdBalance?: number;
  initialBuy: number;
  onInitialBuyChange: (n: number) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const [buyText, setBuyText] = useState(String(initialBuy || ""));

  const buyAmt = Math.max(0, Number(buyText) || 0);
  const totalDue = fee + buyAmt;
  const canAfford = ousdBalance >= totalDue;

  const quote = useMemo(() => {
    if (buyAmt <= 0) return null;
    const curve = curveFromTokenRow({
      curve_virtual_pi: DEFAULT_VIRTUAL_PI,
      curve_virtual_tokens: DEFAULT_VIRTUAL_TOKENS,
      curve_reserve_pi: 0,
      curve_supply_sold: 0,
      total_supply: DEFAULT_TOTAL_SUPPLY,
    });
    return quoteBuy(curve, buyAmt);
  }, [buyAmt]);

  function setBuy(n: number) {
    const v = Math.max(0, n);
    setBuyText(v ? String(v) : "");
    onInitialBuyChange(v);
  }

  return (
    <div className="space-y-5 rounded-3xl bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold tracking-tight">Confirm mint</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ${symbol} ({name}) launches on the OpenToken bonding curve. Mint fee is {fee} OUSD.
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl bg-muted/50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Choose how many ${symbol} you want to buy (optional)
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tip: optional, but buying a small amount helps protect your coin from snipers — like
            pump.fun.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-background px-3 py-2">
          <Input
            type="text"
            inputMode="decimal"
            value={buyText}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.]/g, "");
              setBuyText(raw);
              onInitialBuyChange(Math.max(0, Number(raw) || 0));
            }}
            className="h-10 border-0 bg-transparent p-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            placeholder="0"
            aria-label="Initial buy amount in OUSD"
          />
          <span className="shrink-0 text-sm font-semibold text-muted-foreground">OUSD</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BUY_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setBuy(p)}
              className="rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold press hover:bg-muted/80"
            >
              {p === 0 ? "Skip" : `$${p}`}
            </button>
          ))}
        </div>
        {quote && buyAmt > 0 ? (
          <p className="text-xs text-muted-foreground">
            You receive ≈{" "}
            <span className="font-semibold text-foreground">
              {formatNumber(quote.tokenOut, 0)} ${symbol}
            </span>
            {quote.fee > 0 ? (
              <>
                {" "}
                · trade fee {formatNumber(quote.fee, 4)} OUSD
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Skip to mint without buying (curve starts at 0).</p>
        )}
      </div>

      <ul className="space-y-2.5 rounded-2xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        <li>
          Mint fee: <span className="font-semibold text-foreground">{fee} OUSD</span>
        </li>
        {buyAmt > 0 ? (
          <li>
            Creator buy: <span className="font-semibold text-foreground">{buyAmt} OUSD</span> → you
            receive ${symbol} into this wallet
          </li>
        ) : null}
        <li>
          Total due: <span className="font-semibold text-foreground">{totalDue} OUSD</span>
          {" · "}
          available{" "}
          <span className={canAfford ? "font-semibold text-foreground" : "font-semibold text-red-400"}>
            {ousdBalance.toFixed(2)} OUSD
          </span>
        </li>
        <li>Graduates to OpenDEX at 100,000 OUSD bonded</li>
      </ul>

      {!canAfford ? (
        <p className="text-center text-sm font-medium text-red-400">
          Insufficient OUSD: need {totalDue}, available {ousdBalance.toFixed(2)}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="h-12 flex-1 rounded-full"
          onClick={onBack}
          disabled={busy}
        >
          Back
        </Button>
        <Button
          type="button"
          className="h-12 flex-1 rounded-full bg-primary font-bold text-primary-foreground"
          onClick={onConfirm}
          disabled={busy || !canAfford}
        >
          {busy
            ? "Minting…"
            : buyAmt > 0
              ? `Pay ${totalDue} OUSD & Create`
              : `Pay ${fee} OUSD & Create`}
        </Button>
      </div>
    </div>
  );
}
