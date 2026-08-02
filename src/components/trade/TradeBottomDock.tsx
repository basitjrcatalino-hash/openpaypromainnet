import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import { unrealizedPnl, type PerpPosition } from "@/lib/perp";
import type { TradeMode } from "@/lib/exchange-depth";

export function TradeBottomDock({
  mode,
  tab,
  onTab,
  positions,
  markPrice,
  onClosePosition,
  closingId,
  onGoTrade,
}: {
  mode: TradeMode;
  tab: "orders" | "positions";
  onTab: (t: "orders" | "positions") => void;
  positions: PerpPosition[];
  markPrice: number;
  onClosePosition: (id: string) => void;
  closingId?: string | null;
  onGoTrade?: () => void;
}) {
  const open = positions.filter((p) => p.status === "open");

  return (
    <section className="border-t border-border/50 px-4 pb-4 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex gap-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onTab("orders")}
            className={cn(tab === "orders" ? "text-foreground" : "text-muted-foreground")}
          >
            Orders (0)
          </button>
          <button
            type="button"
            onClick={() => onTab("positions")}
            className={cn(tab === "positions" ? "text-foreground" : "text-muted-foreground")}
          >
            {mode === "futures" ? `Positions (${open.length})` : "Holdings"}
          </button>
        </div>
        {onGoTrade ? (
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-md bg-[#ffad0a] px-4 text-xs font-bold text-black hover:bg-[#ffad0a]/90"
            onClick={onGoTrade}
          >
            Trade
          </Button>
        ) : null}
      </div>

      {mode === "spot" && tab === "positions" ? (
        <p className="rounded-xl border border-border/50 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          Spot balances live in Funding.{" "}
          <Link to="/assets" className="font-semibold text-primary">
            View Assets
          </Link>
        </p>
      ) : null}

      {mode === "futures" && tab === "positions" ? (
        !open.length ? (
          <p className="rounded-xl border border-border/50 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
            No open positions. Open long / short on the Trade tab.
          </p>
        ) : (
          <ul className="space-y-2">
            {open.map((p) => {
              const pnl = unrealizedPnl({
                side: p.side,
                sizeUsd: p.size_usd,
                entryPrice: p.entry_price,
                markPrice,
                margin: p.margin,
              });
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-card/60 px-3 py-2.5"
                >
                  <div>
                    <p className="text-xs font-bold">
                      <span
                        className={cn(
                          "mr-1.5 rounded px-1 py-0.5 text-[10px] uppercase",
                          p.side === "long"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-rose-500/15 text-rose-400",
                        )}
                      >
                        {p.side}
                      </span>
                      {p.market} · {p.leverage}×
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Entry {formatNumber(p.entry_price, 2)} · Margin {formatNumber(p.margin, 2)}{" "}
                      {p.margin_asset}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-xs font-bold tabular-nums",
                        pnl >= 0 ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {pnl >= 0 ? "+" : ""}
                      {formatNumber(pnl, 2)}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-1 h-6 rounded-full px-2 text-[10px]"
                      disabled={closingId === p.id}
                      onClick={() => onClosePosition(p.id)}
                    >
                      Close
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      {tab === "orders" ? (
        <p className="rounded-xl border border-border/50 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          No open orders. Market fills execute instantly.
        </p>
      ) : null}
    </section>
  );
}
