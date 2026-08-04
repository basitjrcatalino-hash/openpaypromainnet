import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import { unrealizedPnl, type PerpPosition } from "@/lib/perp";
import {
  liquidationPrice,
  maintenanceMargin,
  marginRatio,
  roePct,
} from "@/lib/trade-advanced";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[12px] font-semibold tabular-nums",
          tone === "up" && "text-[#0ecb81]",
          tone === "down" && "text-[#f6465d]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Position manager: TP/SL, add margin, close, reverse — OKX-style. */
export function PositionManageSheet({
  position,
  markPrice,
  open,
  onOpenChange,
  onSetTpSl,
  onAddMargin,
  onClose,
  onReverse,
  busy,
}: {
  position: PerpPosition | null;
  markPrice: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSetTpSl: (args: { tp: number | null; sl: number | null }) => void;
  onAddMargin: (amount: number) => void;
  onClose: () => void;
  onReverse: () => void;
  busy?: boolean;
}) {
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [margin, setMargin] = useState("");

  useEffect(() => {
    setTp(position?.take_profit_price ? String(position.take_profit_price) : "");
    setSl(position?.stop_loss_price ? String(position.stop_loss_price) : "");
    setMargin("");
  }, [position?.id, position?.take_profit_price, position?.stop_loss_price]);

  if (!position) return null;

  const mark = markPrice > 0 ? markPrice : position.entry_price;
  const pnl = unrealizedPnl({
    side: position.side,
    sizeUsd: position.size_usd,
    entryPrice: position.entry_price,
    markPrice: mark,
    margin: position.margin,
  });
  const liq =
    position.liquidation_price && position.liquidation_price > 0
      ? position.liquidation_price
      : liquidationPrice(position.side, position.entry_price, position.leverage);
  const digits = mark >= 1000 ? 1 : mark >= 1 ? 2 : 4;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="text-base">
            {position.market}USDT · {position.side.toUpperCase()} {position.leverage}×
          </SheetTitle>
        </SheetHeader>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Entry" value={formatNumber(position.entry_price, digits)} />
          <Stat label="Mark" value={formatNumber(mark, digits)} />
          <Stat label="Liquidation" value={liq > 0 ? formatNumber(liq, digits) : "—"} />
          <Stat
            label="Unrealized PnL"
            value={`${pnl >= 0 ? "+" : ""}${formatNumber(pnl, 4)}`}
            tone={pnl >= 0 ? "up" : "down"}
          />
          <Stat
            label="ROE"
            value={`${roePct(pnl, position.margin) >= 0 ? "+" : ""}${formatNumber(roePct(pnl, position.margin), 2)}%`}
            tone={pnl >= 0 ? "up" : "down"}
          />
          <Stat label="Position value" value={formatNumber(position.size_usd, 2)} />
          <Stat label="Initial margin" value={formatNumber(position.margin, 4)} />
          <Stat
            label="Maint. margin"
            value={formatNumber(maintenanceMargin(position.size_usd), 4)}
          />
          <Stat
            label="Margin ratio"
            value={`${formatNumber(marginRatio(position.margin, pnl, position.size_usd), 2)}×`}
          />
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Take profit / Stop loss
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] text-muted-foreground">TP price</span>
              <input
                value={tp}
                inputMode="decimal"
                onChange={(e) => setTp(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={formatNumber(mark * (position.side === "long" ? 1.05 : 0.95), digits)}
                className="h-9 w-full rounded-md bg-muted/60 px-2.5 text-sm font-semibold tabular-nums outline-none ring-1 ring-transparent focus:ring-primary/40"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] text-muted-foreground">SL price</span>
              <input
                value={sl}
                inputMode="decimal"
                onChange={(e) => setSl(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={formatNumber(mark * (position.side === "long" ? 0.95 : 1.05), digits)}
                className="h-9 w-full rounded-md bg-muted/60 px-2.5 text-sm font-semibold tabular-nums outline-none ring-1 ring-transparent focus:ring-primary/40"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onSetTpSl({
                tp: Number(tp) > 0 ? Number(tp) : null,
                sl: Number(sl) > 0 ? Number(sl) : null,
              })
            }
            className="flex h-9 w-full items-center justify-center rounded-lg bg-muted text-[12px] font-bold press disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save TP/SL"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Add margin ({position.margin_asset})
          </p>
          <div className="flex gap-2">
            <input
              value={margin}
              inputMode="decimal"
              onChange={(e) => setMargin(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              className="h-9 min-w-0 flex-1 rounded-md bg-muted/60 px-2.5 text-sm font-semibold tabular-nums outline-none ring-1 ring-transparent focus:ring-primary/40"
            />
            <button
              type="button"
              disabled={busy || !(Number(margin) > 0)}
              onClick={() => onAddMargin(Number(margin))}
              className="h-9 shrink-0 rounded-lg bg-muted px-4 text-[12px] font-bold press disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Adds margin from your Futures balance and lowers the liquidation price.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 pb-4">
          <button
            type="button"
            disabled={busy}
            onClick={onReverse}
            className="h-10 rounded-lg bg-muted text-[12px] font-bold press disabled:opacity-40"
          >
            Reverse
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-10 rounded-lg bg-[#f6465d] text-[12px] font-bold text-white press disabled:opacity-40"
          >
            Close position
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
