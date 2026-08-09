import { Link } from "@tanstack/react-router";
import { ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import { unrealizedPnl, type PerpPosition } from "@/lib/perp";
import type { TradeMode } from "@/lib/exchange-depth";
import type { SpotOrder } from "@/lib/spot-orders";
import type { PerpMarket } from "@/lib/perp";

export type DockTab =
  | "orders"
  | "orderHistory"
  | "tradeHistory"
  | "positions"
  | "assets";

export type TradeHistoryRow = {
  id: string;
  side: string;
  amount: number;
  price?: number | null;
  memo?: string | null;
  created_at: string;
  token_symbol?: string | null;
};

export type AssetBalanceRow = {
  symbol: string;
  amount: number;
};

export function TradeBottomDock({
  mode,
  market,
  tab,
  onTab,
  positions,
  markPrice,
  onClosePosition,
  closingId,
  onGoTrade,
  expanded,
  onExpanded,
  size = "md",
  onSize,

  openOrders = [],
  orderHistory = [],
  tradeHistory = [],
  assets = [],
  onCancelOrder,
  cancellingId,
}: {
  mode: TradeMode;
  market: PerpMarket;
  tab: DockTab;
  onTab: (t: DockTab) => void;
  positions: PerpPosition[];
  markPrice: number;
  onClosePosition: (id: string) => void;
  closingId?: string | null;
  onGoTrade?: () => void;
  expanded?: boolean;
  onExpanded?: (open: boolean) => void;
  openOrders?: SpotOrder[];
  orderHistory?: SpotOrder[];
  tradeHistory?: TradeHistoryRow[];
  assets?: AssetBalanceRow[];
  onCancelOrder?: (id: string) => void;
  cancellingId?: string | null;
}) {
  const open = positions.filter((p) => p.status === "open");
  const isExpanded = expanded ?? true;
  const openCount = mode === "spot" ? openOrders.length : open.length;

  const tabs: { id: DockTab; label: string }[] = [
    { id: "orders", label: `Open (${openCount})` },
    { id: "orderHistory", label: "Orders" },
    { id: "tradeHistory", label: "Trades" },
    { id: "positions", label: mode === "futures" ? `Pos (${open.length})` : "Holdings" },
    { id: "assets", label: "Assets" },
  ];

  return (
    <section className="shrink-0 border-t border-border/50 bg-background/95 backdrop-blur-md">
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 gap-2.5 overflow-x-auto text-[11px] font-semibold scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onTab(t.id);
                onExpanded?.(true);
              }}
              className={cn(
                "shrink-0 press",
                tab === t.id && isExpanded ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onGoTrade ? (
            <Button
              type="button"
              size="sm"
              className="h-7 rounded-md bg-[#ffad0a] px-3 text-[11px] font-bold text-black hover:bg-[#ffad0a]/90"
              onClick={onGoTrade}
            >
              Trade
            </Button>
          ) : null}
          {onExpanded ? (
            <button
              type="button"
              aria-label={isExpanded ? "Collapse" : "Expand"}
              onClick={() => onExpanded(!isExpanded)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground press hover:bg-muted/50"
            >
              <ChevronUp
                className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
              />
            </button>
          ) : null}
        </div>
      </div>

      {isExpanded ? (
        <div
          className={cn(
            "overflow-y-auto overscroll-contain px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
            size === "sm" ? "max-h-[22dvh]" : size === "full" ? "max-h-[70dvh]" : "max-h-[36dvh]",
          )}
        >
          {tab === "orders" ? (
            mode === "spot" ? (
              !openOrders.length ? (
                <Empty>
                  <p className="font-semibold text-foreground">No orders found</p>
                  <p className="mt-1 text-muted-foreground">
                    Transfer funds to your trading account to start trading.
                  </p>
                  <Link
                    to="/transfer"
                    search={{ from: "funding", to: "spot" }}
                    className="mt-3 inline-flex h-8 items-center rounded-full bg-muted px-4 text-[11px] font-bold text-foreground press"
                  >
                    Transfer now
                  </Link>
                </Empty>
              ) : (
                <ul className="space-y-2 pb-1">
                  {openOrders.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-card/60 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-xs font-bold">
                          <span
                            className={cn(
                              "mr-1.5 rounded px-1 py-0.5 text-[10px] uppercase",
                              o.side === "buy"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-rose-500/15 text-rose-400",
                            )}
                          >
                            {o.side}
                          </span>
                          {o.market}/USDT · Limit
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatNumber(o.amount, 6)} @ {formatNumber(o.price, 2)} ·{" "}
                          {o.pay_asset}
                        </p>
                      </div>
                      {onCancelOrder ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 rounded-full px-2 text-[10px]"
                          disabled={cancellingId === o.id}
                          onClick={() => onCancelOrder(o.id)}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <Empty>
                <p className="font-semibold text-foreground">No orders found</p>
                <p className="mt-1 text-muted-foreground">
                  Transfer funds to your trading account to start trading.
                </p>
                <Link
                  to="/transfer"
                  search={{ from: "funding", to: "trading" }}
                  className="mt-3 inline-flex h-8 items-center rounded-full bg-muted px-4 text-[11px] font-bold text-foreground press"
                >
                  Transfer now
                </Link>
              </Empty>
            )
          ) : null}

          {tab === "orderHistory" ? (
            !orderHistory.length ? (
              <Empty>No order history yet.</Empty>
            ) : (
              <ul className="space-y-2 pb-1">
                {orderHistory.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-card/40 px-3 py-2"
                  >
                    <div>
                      <p className="text-xs font-semibold">
                        {o.side.toUpperCase()} {o.market} · {o.status}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatNumber(o.filled || o.amount, 6)} @ {formatNumber(o.price, 2)}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === "tradeHistory" ? (
            !tradeHistory.length ? (
              <Empty>No trades for {market} yet.</Empty>
            ) : (
              <ul className="space-y-2 pb-1">
                {tradeHistory.map((tx) => (
                  <li
                    key={tx.id}
                    className="rounded-xl border border-border/50 bg-card/40 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold">
                        {tx.token_symbol ?? market} · {tx.side || tx.memo?.slice(0, 24)}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Amt {formatNumber(tx.amount, 6)}
                      {tx.price != null ? ` · $${formatNumber(tx.price, 2)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === "positions" ? (
            mode === "spot" ? (
              <Empty>
                Spot balances live in Spot. Transfer Funding → Spot to trade.{" "}
                <Link to="/transfer" search={{ from: "funding", to: "spot" }} className="font-semibold text-primary">
                  Transfer
                </Link>
              </Empty>
            ) : !open.length ? (
              <Empty>No open positions. Open long / short on Trade.</Empty>
            ) : (
              <ul className="space-y-2 pb-1">
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
                          Entry {formatNumber(p.entry_price, 2)} · Margin{" "}
                          {formatNumber(p.margin, 2)} {p.margin_asset}
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

          {tab === "assets" ? (
            !assets.length ? (
              <Empty>
                No balances.{" "}
                <Link to="/transfer" className="font-semibold text-primary">
                  Transfer
                </Link>
              </Empty>
            ) : (
              <ul className="space-y-1.5 pb-1">
                {assets.map((a) => (
                  <li
                    key={a.symbol}
                    className="flex items-center justify-between rounded-lg px-1 py-1.5 text-xs"
                  >
                    <span className="font-semibold">{a.symbol}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatNumber(a.amount, a.amount >= 1 ? 4 : 6)}
                    </span>
                  </li>
                ))}
                <li className="pt-1">
                  <Link
                    to="/transfer"
                    search={{ from: "funding", to: "spot" }}
                    className="text-[11px] font-semibold text-primary"
                  >
                    Transfer Funding → Spot
                  </Link>
                </li>
              </ul>
            )
          ) : null}
        </div>
      ) : (
        <div className="pb-[max(0.35rem,env(safe-area-inset-bottom))]" />
      )}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}
