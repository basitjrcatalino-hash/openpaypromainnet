import { useState } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import {
  PERP_MARGIN_ASSETS,
  type PerpMarginAsset,
  type PerpMarket,
} from "@/lib/perp";
import type { TradeMode } from "@/lib/exchange-depth";
import {
  SPOT_ORDER_KINDS,
  TIME_IN_FORCE,
  isTriggerKind,
  liquidationPrice,
  orderKindLabel,
  type SpotOrderKind,
  type TimeInForce,
} from "@/lib/trade-advanced";
import {
  PERP_MAKER_FEE_BPS,
  PERP_TAKER_FEE_BPS,
  SPOT_MAKER_FEE_BPS,
  SPOT_TAKER_FEE_BPS,
} from "@/lib/platform-treasury";
import { LeverageAdjustSheet } from "@/components/trade/LeverageAdjustSheet";
import { FundAccountSheet } from "@/components/trade/FundAccountSheet";

const PCTS = [0, 25, 50, 75, 100] as const;
const SPOT_FEE_RATE = SPOT_TAKER_FEE_BPS / 10_000;

export type SpotSide = "buy" | "sell";
export type SpotPayAsset = "USDT" | "OUSD" | "USDC";
export type OrderType = SpotOrderKind;

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
  triggerPrice?: string;
  onTriggerPrice?: (v: string) => void;
  trailPercent?: string;
  onTrailPercent?: (v: string) => void;
  tif?: TimeInForce;
  onTif?: (t: TimeInForce) => void;
  postOnly?: boolean;
  onPostOnly?: (v: boolean) => void;
  reduceOnly?: boolean;
  onReduceOnly?: (v: boolean) => void;
};

type FuturesProps = SharedProps & {
  mode: "futures";
  action: "open" | "close";
  onAction: (a: "open" | "close") => void;
  leverage: number;
  onLeverage: (n: number) => void;
  shortLeverage?: number;
  onShortLeverage?: (n: number) => void;
  marginAsset: PerpMarginAsset;
  onMarginAsset: (a: PerpMarginAsset) => void;
  available: number;
  onSubmitLong: () => void;
  onSubmitShort: () => void;
  hasLong?: boolean;
  hasShort?: boolean;
  tpPrice?: string;
  onTpPrice?: (v: string) => void;
  slPrice?: string;
  onSlPrice?: (v: string) => void;
  useTpsl?: boolean;
  onUseTpsl?: (v: boolean) => void;
};

type SpotProps = SharedProps & {
  mode: "spot";
  side: SpotSide;
  onSide: (s: SpotSide) => void;
  payAsset: SpotPayAsset;
  onPayAsset: (a: SpotPayAsset) => void;
  availableQuote: number;
  availableBase: number;
  fundingQuote?: number;
  fundingBase?: number;
  useOco?: boolean;
  onUseOco?: (v: boolean) => void;
  ocoStopPrice?: string;
  onOcoStopPrice?: (v: string) => void;
  onSubmit: () => void;
  tpPrice?: string;
  onTpPrice?: (v: string) => void;
  slPrice?: string;
  onSlPrice?: (v: string) => void;
  useTpsl?: boolean;
  onUseTpsl?: (v: boolean) => void;
};

export type ExchangeOrderFormProps = FuturesProps | SpotProps;

export function ExchangeOrderForm(props: ExchangeOrderFormProps) {
  const [levOpen, setLevOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [tpslLocal, setTpslLocal] = useState(false);

  const useTpsl = props.useTpsl ?? tpslLocal;
  const setUseTpsl = props.onUseTpsl ?? setTpslLocal;

  const price =
    props.orderType === "limit" && Number(props.limitPrice) > 0
      ? Number(props.limitPrice)
      : props.markPrice;
  const amt = Number(props.amount) || 0;
  const priceDigits = props.markPrice >= 1000 ? 1 : props.markPrice >= 1 ? 2 : 4;
  const total = amt > 0 && price > 0 ? amt * price : 0;
  const fee = total > 0 ? total * SPOT_FEE_RATE : 0;
  const receive =
    props.mode === "spot"
      ? props.side === "buy"
        ? amt > 0
          ? amt * (1 - SPOT_FEE_RATE)
          : 0
        : total > 0
          ? total * (1 - SPOT_FEE_RATE)
          : 0
      : 0;

  const longLev = props.mode === "futures" ? props.leverage : 1;
  const shortLev =
    props.mode === "futures" ? (props.shortLeverage ?? props.leverage) : 1;

  const perpNotional =
    props.mode === "futures" && amt > 0 && price > 0 ? amt * price : 0;
  const longMargin =
    props.mode === "futures" && perpNotional > 0 ? perpNotional / longLev : 0;
  const shortMargin =
    props.mode === "futures" && perpNotional > 0 ? perpNotional / shortLev : 0;
  const longLiq =
    props.mode === "futures" && price > 0
      ? liquidationPrice("long", price, longLev)
      : 0;
  const shortLiq =
    props.mode === "futures" && price > 0
      ? liquidationPrice("short", price, shortLev)
      : 0;
  const maxLongBase =
    props.mode === "futures" && price > 0
      ? (props.available * longLev) / price
      : 0;

  function applyBbo() {
    if (!(props.markPrice > 0)) return;
    const tick = props.markPrice >= 1000 ? 0.1 : props.markPrice >= 1 ? 0.01 : 0.0001;
    const sideBid =
      props.mode === "spot" ? props.side === "buy" : true;
    const px = sideBid
      ? Math.max(tick, props.markPrice - tick)
      : props.markPrice + tick;
    props.onLimitPrice(String(Number(px.toFixed(priceDigits))));
    if (props.orderType === "market") props.onOrderType("limit");
  }

  return (
    <div className="flex min-h-0 flex-col gap-2 text-[12px]">
      {props.mode === "futures" ? (
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted/50 p-0.5">
          {(["open", "close"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => props.onAction(a)}
              className={cn(
                "rounded py-1.5 text-xs font-bold capitalize press",
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
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted/50 p-0.5">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => props.onSide(s)}
              className={cn(
                "rounded py-1.5 text-xs font-bold capitalize press",
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

      {props.mode === "futures" ? (
        <div className="flex gap-1">
          <button
            type="button"
            className="flex flex-1 items-center justify-between rounded-md bg-muted/60 px-2 py-1.5 text-[11px] font-semibold text-foreground"
          >
            Isolated
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => setLevOpen(true)}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-muted/60 px-2 py-1.5 text-[11px] font-bold press"
          >
            <span className="text-[#0ecb81]">{longLev}x</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-[#f6465d]">{shortLev}x</span>
          </button>
        </div>
      ) : null}

      <select
        value={props.orderType}
        onChange={(e) => props.onOrderType(e.target.value as OrderType)}
        className="h-8 w-full rounded-md border-0 bg-muted/60 px-2 text-xs font-semibold text-foreground outline-none"
      >
        {SPOT_ORDER_KINDS.map((k) => (
          <option key={k} value={k}>
            {orderKindLabel(k)}
          </option>
        ))}
      </select>

      {props.orderType === "stop_limit" || props.orderType === "stop_market" ? (
        <Field
          label="Trigger price (USDT)"
          value={props.triggerPrice ?? ""}
          onChange={(v) => props.onTriggerPrice?.(v)}
          placeholder={props.markPrice > 0 ? formatNumber(props.markPrice, priceDigits) : "0"}
        />
      ) : null}

      {props.orderType === "trailing_stop" ? (
        <Field
          label="Trail distance (%)"
          value={props.trailPercent ?? ""}
          onChange={(v) => props.onTrailPercent?.(v)}
          placeholder="1.5"
        />
      ) : null}

      {props.orderType === "limit" || props.orderType === "stop_limit" ? (
        <div>
          <span className="mb-1 block text-[10px] text-muted-foreground">Price (USDT)</span>
          <div className="flex gap-1">
            <input
              value={props.limitPrice}
              onChange={(e) => props.onLimitPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="h-9 min-w-0 flex-1 rounded-md bg-muted/60 px-2.5 text-sm font-semibold tabular-nums outline-none ring-1 ring-transparent focus:ring-primary/40"
              placeholder={
                props.markPrice > 0 ? formatNumber(props.markPrice, priceDigits) : "0"
              }
            />
            <button
              type="button"
              onClick={applyBbo}
              className="h-9 shrink-0 rounded-md bg-muted/60 px-2.5 text-[11px] font-bold text-foreground press"
              title="Best bid/offer"
            >
              BBO
            </button>
          </div>
        </div>
      ) : (
        <div className="flex h-9 items-center justify-between rounded-md bg-muted/60 px-2.5 text-sm">
          <span className="text-muted-foreground">Price</span>
          <span className="font-semibold tabular-nums">Market</span>
        </div>
      )}

      <div>
        <span className="mb-1 block text-[10px] text-muted-foreground">
          Amount ({props.market})
        </span>
        <div className="flex gap-1">
          <input
            value={props.amount}
            onChange={(e) => props.onAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className="h-9 min-w-0 flex-1 rounded-md bg-muted/60 px-2.5 text-sm font-semibold tabular-nums outline-none ring-1 ring-transparent focus:ring-primary/40"
            placeholder="0"
          />
          <span className="flex h-9 shrink-0 items-center rounded-md bg-muted/60 px-2.5 text-[11px] font-bold text-foreground">
            {props.market}
          </span>
        </div>
      </div>

      <div className="space-y-1 px-0.5 pt-0.5">
        <div className="relative flex items-center justify-between">
          <div className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-muted-foreground/25" />
          {PCTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => props.onPct(p)}
              className={cn(
                "relative z-1 h-2.5 w-2.5 rounded-full border press",
                props.pct >= p && p > 0
                  ? "border-[#ffad0a] bg-[#ffad0a]"
                  : "border-muted-foreground/50 bg-background",
              )}
              aria-label={`${p}%`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground">
          {PCTS.map((p) => (
            <span key={p}>{p}%</span>
          ))}
        </div>
      </div>

      {props.mode === "spot" ? (
        <div className="flex h-8 items-center justify-between rounded-md bg-muted/40 px-2.5 text-[11px]">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold tabular-nums">
            {total > 0 ? `${formatNumber(total, 2)} USDT` : "—"}
          </span>
        </div>
      ) : null}

      {props.mode === "futures" ? (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            Available{" "}
            <span className="font-semibold text-foreground">
              {formatNumber(props.available, 4)} {props.marginAsset}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setFundOpen(true)}
            className="grid h-5 w-5 place-items-center rounded-full bg-muted/70 text-foreground press"
            aria-label="Add funds"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            Available{" "}
            <span className="font-semibold text-foreground">
              {formatNumber(
                props.side === "buy" ? props.availableQuote : props.availableBase,
                props.side === "buy" ? 4 : 6,
              )}{" "}
              {props.side === "buy" ? props.payAsset : props.market}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setFundOpen(true)}
            className="grid h-5 w-5 place-items-center rounded-full bg-muted/70 text-foreground press"
            aria-label="Add funds"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      )}

      {props.mode === "spot" ? (
        <p className="text-[10px] text-muted-foreground">
          Max {props.side === "buy" ? "buy" : "sell"}{" "}
          <span className="font-semibold text-foreground">
            {props.side === "buy"
              ? formatNumber(price > 0 ? props.availableQuote / price : 0, 6)
              : formatNumber(props.availableBase, 6)}{" "}
            {props.market}
          </span>
        </p>
      ) : null}

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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <input
              type="checkbox"
              checked={useTpsl}
              onChange={(e) => setUseTpsl(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#0ecb81]"
            />
            TP/SL
          </label>
          <span className="text-[10px] text-muted-foreground">Advanced</span>
        </div>
        {useTpsl ? (
          <div className="grid grid-cols-2 gap-1.5">
            <Field
              label="TP price"
              value={props.tpPrice ?? ""}
              onChange={(v) => props.onTpPrice?.(v)}
              placeholder="USDT"
            />
            <Field
              label="SL price"
              value={props.slPrice ?? ""}
              onChange={(v) => props.onSlPrice?.(v)}
              placeholder="USDT"
            />
          </div>
        ) : null}
      </div>

      {props.onTif || props.onPostOnly || props.onReduceOnly ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {props.onTif ? (
            <div className="flex gap-0.5 rounded-md bg-muted/50 p-0.5">
              {TIME_IN_FORCE.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => props.onTif?.(t)}
                  className={cn(
                    "rounded px-1.5 py-1 text-[9px] font-bold uppercase press",
                    (props.tif ?? "gtc") === t
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}
          {props.onPostOnly ? (
            <Chip
              active={!!props.postOnly}
              onClick={() => props.onPostOnly?.(!props.postOnly)}
              label="Post only"
            />
          ) : null}
          {props.onReduceOnly ? (
            <Chip
              active={!!props.reduceOnly}
              onClick={() => props.onReduceOnly?.(!props.reduceOnly)}
              label="Reduce only"
            />
          ) : null}
        </div>
      ) : null}

      {props.mode === "futures" && props.action === "open" ? (
        <div className="space-y-0.5 text-[10px] text-muted-foreground">
          <p>
            Max long{" "}
            <span className="font-semibold text-foreground">
              {formatNumber(maxLongBase, 4)} {props.market}
            </span>
          </p>
          <p>
            Cost{" "}
            <span className="font-semibold text-foreground">
              {longMargin > 0 ? formatNumber(longMargin, 4) : "—"} {props.marginAsset}
            </span>
          </p>
          <p>
            Liq. price{" "}
            <span className="font-semibold text-foreground">
              {longLiq > 0 ? formatNumber(longLiq, priceDigits) : "—"}
            </span>
          </p>
        </div>
      ) : null}

      {props.mode === "spot" && total > 0 ? (
        <div className="space-y-0.5 text-[10px] text-muted-foreground">
          <p>
            Est. fee ({SPOT_TAKER_FEE_BPS / 100}%){" "}
            <span className="font-semibold text-foreground">
              {formatNumber(fee, 4)} {props.payAsset}
            </span>
          </p>
          <p>
            You receive ≈{" "}
            <span className="font-semibold text-foreground">
              {props.side === "buy"
                ? `${formatNumber(receive, 6)} ${props.market}`
                : `${formatNumber(receive, 2)} ${props.payAsset}`}
            </span>
          </p>
          <p className="text-muted-foreground/80">
            Spot maker {SPOT_MAKER_FEE_BPS / 100}% · taker {SPOT_TAKER_FEE_BPS / 100}%
          </p>
        </div>
      ) : null}

      {props.mode === "futures" && amt > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Perp maker {PERP_MAKER_FEE_BPS / 100}% · taker {PERP_TAKER_FEE_BPS / 100}%
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
                className="flex h-11 w-full items-center justify-center rounded-lg bg-[#0ecb81] text-sm font-bold text-black press disabled:opacity-40"
              >
                {props.busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Open long ${longLev}x`
                )}
              </button>
              <div className="space-y-0.5 text-[10px] text-muted-foreground">
                <p>
                  Max short{" "}
                  <span className="font-semibold text-foreground">
                    {formatNumber(maxLongBase, 4)} {props.market}
                  </span>
                </p>
                <p>
                  Cost{" "}
                  <span className="font-semibold text-foreground">
                    {shortMargin > 0 ? formatNumber(shortMargin, 4) : "—"} {props.marginAsset}
                  </span>
                </p>
                <p>
                  Liq. price{" "}
                  <span className="font-semibold text-foreground">
                    {shortLiq > 0 ? formatNumber(shortLiq, priceDigits) : "—"}
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={props.busy || !(amt > 0)}
                onClick={props.onSubmitShort}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-[#f6465d] text-sm font-bold text-white press disabled:opacity-40"
              >
                {props.busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Open short ${shortLev}x`
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={props.busy || !props.hasLong}
                onClick={props.onSubmitLong}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-[#0ecb81]/90 text-sm font-bold text-black press disabled:opacity-40"
              >
                Close long
              </button>
              <button
                type="button"
                disabled={props.busy || !props.hasShort}
                onClick={props.onSubmitShort}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-[#f6465d]/90 text-sm font-bold text-white press disabled:opacity-40"
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
            "mt-1 flex h-11 w-full items-center justify-center rounded-lg text-sm font-bold press disabled:opacity-40",
            props.side === "buy" ? "bg-[#0ecb81] text-black" : "bg-[#f6465d] text-white",
          )}
        >
          {props.busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isTriggerKind(props.orderType) ? (
            `${props.side === "buy" ? "Buy" : "Sell"} ${orderKindLabel(props.orderType).toLowerCase()}`
          ) : (
            `${props.side === "buy" ? "Buy" : "Sell"} ${props.market}`
          )}
        </button>
      )}

      {props.mode === "futures" ? (
        <LeverageAdjustSheet
          open={levOpen}
          onOpenChange={setLevOpen}
          longLev={longLev}
          shortLev={shortLev}
          onLongLev={props.onLeverage}
          onShortLev={props.onShortLeverage ?? props.onLeverage}
          entryPrice={price > 0 ? price : props.markPrice}
          available={props.available}
          baseSymbol={props.market}
          quoteSymbol={props.marginAsset}
        />
      ) : null}

      <FundAccountSheet
        open={fundOpen}
        onOpenChange={setFundOpen}
        mode={props.mode}
        asset={
          props.mode === "futures"
            ? props.marginAsset
            : props.side === "buy"
              ? props.payAsset
              : props.market
        }
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        inputMode="decimal"
        className="h-9 w-full rounded-md bg-muted/60 px-2.5 text-sm font-semibold tabular-nums outline-none ring-1 ring-transparent focus:ring-primary/40"
        placeholder={placeholder}
      />
    </label>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-1 text-[9px] font-bold uppercase press",
        active ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}
