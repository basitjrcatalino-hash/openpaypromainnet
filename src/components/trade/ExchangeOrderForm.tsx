import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import {
  PERP_LEVERAGE_OPTIONS,
  PERP_MARGIN_ASSETS,
  type PerpMarginAsset,
  type PerpMarket,
  type PerpSide,
} from "@/lib/perp";
import type { TradeMode } from "@/lib/exchange-depth";
import { PLATFORM_TRADE_FEE_BPS, applyPerpNotionalFee } from "@/lib/platform-treasury";

const PCTS = [0, 25, 50, 75, 100] as const;
const FEE_RATE = PLATFORM_TRADE_FEE_BPS / 10_000;

export type SpotSide = "buy" | "sell";
export type SpotPayAsset = "USDT" | "OUSD" | "USDC";
export type OrderType = "market" | "limit";

type SharedProps = {
  market: PerpMarket;
  mode: TradeMode;
  markPrice: number;
  orderType: OrderType;
  onOrderType: (t: OrderType) => void;
  limitPrice: string;
  onLimitPrice: (v: string) => void;
  amount: string;
  onAmount: (v: string) => void;
  pct: number;
  onPct: (p: number) => void;
  busy?: boolean;
};

type FuturesProps = SharedProps & {
  mode: "futures";
  action: "open" | "close";
  onAction: (a: "open" | "close") => void;
  leverage: number;
  onLeverage: (n: number) => void;
  marginAsset: PerpMarginAsset;
  onMarginAsset: (a: PerpMarginAsset) => void;
  available: number;
  onSubmitLong: () => void;
  onSubmitShort: () => void;
  hasLong?: boolean;
  hasShort?: boolean;
};

type SpotProps = SharedProps & {
  mode: "spot";
  side: SpotSide;
  onSide: (s: SpotSide) => void;
  payAsset: SpotPayAsset;
  onPayAsset: (a: SpotPayAsset) => void;
  availableQuote: number;
  availableBase: number;
  onSubmit: () => void;
};

export type ExchangeOrderFormProps = FuturesProps | SpotProps;

export function ExchangeOrderForm(props: ExchangeOrderFormProps) {
  const price =
    props.orderType === "limit" && Number(props.limitPrice) > 0
      ? Number(props.limitPrice)
      : props.markPrice;
  const amt = Number(props.amount) || 0;
  const priceDigits = props.markPrice >= 1000 ? 1 : props.markPrice >= 1 ? 2 : 4;
  const total = amt > 0 && price > 0 ? amt * price : 0;
  const fee = total > 0 ? total * FEE_RATE : 0;
  const receive =
    props.mode === "spot"
      ? props.side === "buy"
        ? amt > 0
          ? amt * (1 - FEE_RATE)
          : 0
        : total > 0
          ? total * (1 - FEE_RATE)
          : 0
      : 0;
  const perpFee =
    props.mode === "futures" && amt > 0
      ? applyPerpNotionalFee(amt, props.leverage)
      : null;

  return (
    <div className="flex min-h-0 flex-col gap-2 text-[12px]">
      {props.mode === "futures" ? (
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-0.5">
          {(["open", "close"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => props.onAction(a)}
              className={cn(
                "rounded-md py-1.5 text-xs font-bold capitalize press",
                props.action === a
                  ? a === "open"
                    ? "bg-[#0ecb81] text-black"
                    : "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-0.5">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => props.onSide(s)}
              className={cn(
                "rounded-md py-1.5 text-xs font-bold capitalize press",
                props.side === s
                  ? s === "buy"
                    ? "bg-[#0ecb81] text-black"
                    : "bg-[#f6465d] text-white"
                  : "text-muted-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {props.mode === "spot" ? (
        <div className="flex gap-1">
          <Link
            to="/swap"
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-muted/50 py-1.5 text-[10px] font-bold text-muted-foreground press hover:text-foreground"
          >
            <ArrowLeftRight className="h-3 w-3" />
            Convert / Swap
          </Link>
        </div>
      ) : null}

      {props.mode === "futures" ? (
        <div className="flex gap-1">
          <span className="flex-1 rounded-md bg-muted/60 px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground">
            Isolated
          </span>
          <div className="flex flex-1 gap-0.5 overflow-x-auto rounded-md bg-muted/60 p-0.5">
            {PERP_LEVERAGE_OPTIONS.filter((l) => l >= 1).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => props.onLeverage(l)}
                className={cn(
                  "min-w-8 flex-1 rounded px-1 py-1 text-[10px] font-bold",
                  props.leverage === l
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {l}x
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <select
        value={props.orderType}
        onChange={(e) => props.onOrderType(e.target.value as OrderType)}
        className="h-8 w-full rounded-md border-0 bg-muted/60 px-2 text-xs font-semibold text-foreground outline-none"
      >
        <option value="market">Market</option>
        <option value="limit">Limit</option>
      </select>

      {props.orderType === "limit" ? (
        <label className="block">
          <span className="mb-1 block text-[10px] text-muted-foreground">Price (USDT)</span>
          <input
            value={props.limitPrice}
            onChange={(e) => props.onLimitPrice(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className="h-9 w-full rounded-md bg-muted/60 px-2.5 text-sm font-semibold tabular-nums outline-none ring-1 ring-transparent focus:ring-primary/40"
            placeholder={props.markPrice > 0 ? formatNumber(props.markPrice, priceDigits) : "0"}
          />
        </label>
      ) : (
        <div className="flex h-9 items-center justify-between rounded-md bg-muted/60 px-2.5 text-sm">
          <span className="text-muted-foreground">Price</span>
          <span className="font-semibold tabular-nums">Market</span>
        </div>
      )}

      {props.mode === "futures" ? (
        <div className="flex gap-1 rounded-md bg-muted/40 p-0.5">
          {PERP_MARGIN_ASSETS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => props.onMarginAsset(a)}
              className={cn(
                "flex-1 rounded py-1 text-[10px] font-bold",
                props.marginAsset === a ? "bg-card shadow-sm" : "text-muted-foreground",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-1 rounded-md bg-muted/40 p-0.5">
          {(["USDT", "OUSD", "USDC"] as SpotPayAsset[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => props.onPayAsset(a)}
              className={cn(
                "flex-1 rounded py-1 text-[10px] font-bold",
                props.payAsset === a ? "bg-card shadow-sm" : "text-muted-foreground",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-[10px] text-muted-foreground">
          {props.mode === "futures" ? "Margin" : `Quantity (${props.market})`}
        </span>
        <input
          value={props.amount}
          onChange={(e) => props.onAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          className="h-9 w-full rounded-md bg-muted/60 px-2.5 text-sm font-semibold tabular-nums outline-none ring-1 ring-transparent focus:ring-primary/40"
          placeholder="0"
        />
      </label>

      {props.mode === "spot" ? (
        <div className="flex h-8 items-center justify-between rounded-md bg-muted/40 px-2.5 text-[11px]">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold tabular-nums">
            {total > 0 ? `${formatNumber(total, 2)} USDT` : "—"}
          </span>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-1 px-0.5">
        {PCTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => props.onPct(p)}
            className={cn(
              "h-2 w-2 rounded-full border border-muted-foreground/40 press",
              props.pct >= p && p > 0 ? "border-primary bg-primary" : "",
              p === 0 && "opacity-40",
            )}
            aria-label={`${p}%`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {PCTS.map((p) => (
          <span key={p}>{p}%</span>
        ))}
      </div>

      {props.mode === "futures" ? (
        <p className="text-[10px] text-muted-foreground">
          Available{" "}
          <span className="font-semibold text-foreground">
            {formatNumber(props.available, 4)} {props.marginAsset}
          </span>{" "}
          ·{" "}
          <Link
            to="/transfer"
            search={{ from: "funding", to: "trading", asset: props.marginAsset }}
            className="text-primary"
          >
            Transfer
          </Link>
        </p>
      ) : (
        <div className="space-y-0.5 text-[10px] text-muted-foreground">
          <p>
            Available{" "}
            <span className="font-semibold text-foreground">
              {formatNumber(props.availableQuote, 4)} {props.payAsset}
            </span>
          </p>
          <p>
            Max {props.side === "buy" ? "buy" : "sell"}{" "}
            <span className="font-semibold text-foreground">
              {props.side === "buy"
                ? formatNumber(price > 0 ? props.availableQuote / price : 0, 6)
                : formatNumber(props.availableBase, 6)}{" "}
              {props.market}
            </span>
          </p>
          {total > 0 ? (
            <>
              <p>
                Est. fee ({PLATFORM_TRADE_FEE_BPS / 100}%){" "}
                <span className="font-semibold text-foreground">
                  {formatNumber(fee, 4)} {props.payAsset}
                </span>
              </p>
              <p>
                {props.side === "buy" ? "You receive ≈" : "You receive ≈"}{" "}
                <span className="font-semibold text-foreground">
                  {props.side === "buy"
                    ? `${formatNumber(receive, 6)} ${props.market}`
                    : `${formatNumber(receive, 2)} ${props.payAsset}`}
                </span>
              </p>
            </>
          ) : null}
        </div>
      )}

      {props.mode === "futures" && amt > 0 && perpFee ? (
        <div className="space-y-0.5 text-[10px] text-muted-foreground">
          <p>
            Notional ≈{" "}
            <span className="font-semibold text-foreground">
              {formatNumber(perpFee.notional, 2)} {props.marginAsset}
            </span>
          </p>
          <p>
            Est. fee ({PLATFORM_TRADE_FEE_BPS / 100}% of notional){" "}
            <span className="font-semibold text-foreground">
              {formatNumber(perpFee.fee, 4)} {props.marginAsset}
            </span>
          </p>
          {props.action === "open" ? (
            <p>
              Margin + fee ≈{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(perpFee.totalDebit, 4)} {props.marginAsset}
              </span>
            </p>
          ) : (
            <p>Close fee deducted from returned equity</p>
          )}
        </div>
      ) : null}

      {props.mode === "futures" && !(amt > 0) ? (
        <p className="text-[10px] text-muted-foreground">
          Platform fee {PLATFORM_TRADE_FEE_BPS / 100}% on notional (open & close)
        </p>
      ) : null}

      {props.mode === "futures" ? (
        <div className="mt-1 space-y-2">
          {props.action === "open" ? (
            <>
              <button
                type="button"
                disabled={props.busy || !(amt > 0)}
                onClick={props.onSubmitLong}
                className="flex h-10 w-full items-center justify-center rounded-lg bg-[#0ecb81] text-sm font-bold text-black press disabled:opacity-40"
              >
                {props.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Open long ${props.leverage}x`}
              </button>
              <button
                type="button"
                disabled={props.busy || !(amt > 0)}
                onClick={props.onSubmitShort}
                className="flex h-10 w-full items-center justify-center rounded-lg bg-[#f6465d] text-sm font-bold text-white press disabled:opacity-40"
              >
                {props.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Open short ${props.leverage}x`}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={props.busy || !props.hasLong}
                onClick={props.onSubmitLong}
                className="flex h-10 w-full items-center justify-center rounded-lg bg-[#0ecb81]/90 text-sm font-bold text-black press disabled:opacity-40"
              >
                Close long
              </button>
              <button
                type="button"
                disabled={props.busy || !props.hasShort}
                onClick={props.onSubmitShort}
                className="flex h-10 w-full items-center justify-center rounded-lg bg-[#f6465d]/90 text-sm font-bold text-white press disabled:opacity-40"
              >
                Close short
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={props.busy || !(amt > 0)}
          onClick={props.onSubmit}
          className={cn(
            "mt-1 flex h-10 w-full items-center justify-center rounded-lg text-sm font-bold press disabled:opacity-40",
            props.side === "buy" ? "bg-[#0ecb81] text-black" : "bg-[#f6465d] text-white",
          )}
        >
          {props.busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : props.orderType === "limit" ? (
            `${props.side === "buy" ? "Buy" : "Sell"} limit`
          ) : (
            `${props.side === "buy" ? "Buy" : "Sell"} ${props.market}`
          )}
        </button>
      )}
    </div>
  );
}

export type { PerpSide };
