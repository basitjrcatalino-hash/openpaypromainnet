import { Link } from "@tanstack/react-router";
import { ChevronUp, Download, Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import { unrealizedPnl, type PerpPosition } from "@/lib/perp";
import type { TradeMode } from "@/lib/exchange-depth";
import type { SpotOrder } from "@/lib/spot-orders";
import type { PerpMarket } from "@/lib/perp";
import type { SharePnl } from "@/components/trade/SharePnlDialog";


export type DockTab =
  | "orders"
  | "orderHistory"
  | "tradeHistory"
  | "positions"
  | "assets";

export type DockSize = "sm" | "md" | "full";
export type DockScope = "pair" | "all";


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

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]!);
  const body = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TradeBottomDock({
  mode,
  market,
  tab,
  onTab,
  positions,
  markPrice,
  priceByMarket,
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
  scope = "pair",
  onScope,
  onShare,
}: {
  mode: TradeMode;
  market: PerpMarket;
  tab: DockTab;
  onTab: (t: DockTab) => void;
  positions: PerpPosition[];
  markPrice: number;
  priceByMarket?: Partial<Record<string, number>>;
  onClosePosition: (id: string) => void;
  closingId?: string | null;
  onGoTrade?: () => void;
  expanded?: boolean;
  onExpanded?: (open: boolean) => void;
  size?: DockSize;
  onSize?: (s: DockSize) => void;

  openOrders?: SpotOrder[];
  orderHistory?: SpotOrder[];
  tradeHistory?: TradeHistoryRow[];
  assets?: AssetBalanceRow[];
  onCancelOrder?: (id: string) => void;
  cancellingId?: string | null;
  scope?: DockScope;
  onScope?: (s: DockScope) => void;
  onShare?: (d: SharePnl) => void;
}) {

  const open = positions.filter((p) => p.status === "open");
  const isExpanded = expanded ?? true;
  const openCount = mode === "spot" ? openOrders.length : open.length;
  const showScope = tab === "orderHistory" || tab === "tradeHistory";

  const tabs: { id: DockTab; label: string }[] = [
    { id: "orders", label: `Open (${openCount})` },
    { id: "orderHistory", label: "Orders" },
    { id: "tradeHistory", label: "Trades" },
    { id: "positions", label: mode === "futures" ? `Pos (${open.length})` : "Holdings" },
    { id: "assets", label: "Assets" },
  ];

  const positionsList = (list: PerpPosition[]) => (
    <ul className="space-y-2 pb-1">
      {list.map((p) => {
        const mark = Number(priceByMarket?.[p.market] ?? markPrice) || markPrice;
        const pnl = unrealizedPnl({
          side: p.side,
          sizeUsd: p.size_usd,
          entryPrice: p.entry_price,
          markPrice: mark,
          margin: p.margin,
        });
        const pnlPct = p.margin > 0 ? (pnl / p.margin) * 100 : 0;
        return (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-card/60 px-3 py-2.5"
          >
            <div className="min-w-0">
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
                Entry {formatNumber(p.entry_price, 2)} · Mark {formatNumber(mark, 2)} · Margin{" "}
                {formatNumber(p.margin, 2)} {p.margin_asset}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Size {formatNumber(p.size_usd, 2)} {p.margin_asset}
                {p.liquidation_price ? ` · Liq ${formatNumber(p.liquidation_price, 2)}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-xs font-bold tabular-nums",
                  pnl >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {pnl >= 0 ? "+" : ""}
                {formatNumber(pnl, 2)}
              </p>
              <p
                className={cn(
                  "text-[10px] font-semibold tabular-nums",
                  pnl >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {pnlPct >= 0 ? "+" : ""}
                {pnlPct.toFixed(2)}%
              </p>
              <div className="mt-1 flex items-center justify-end gap-1">
                {onShare ? (
                  <button
                    type="button"
                    aria-label="Share PnL"
                    title="Share PnL"
                    onClick={() =>
                      onShare({
                        market: p.market,
                        side: p.side,
                        leverage: p.leverage,
                        entryPrice: p.entry_price,
                        markPrice: mark,
                        pnl,
                        pnlPct,
                        amount: p.entry_price > 0 ? p.size_usd / p.entry_price : null,
                        quote: p.margin_asset,
                        mode: "futures",
                        at: p.created_at,
                      })
                    }
                    className="grid h-6 w-6 place-items-center rounded-full border border-border/60 text-muted-foreground press hover:text-foreground"
                  >
                    <Share2 className="h-3 w-3" />
                  </button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 rounded-full px-2 text-[10px]"
                  disabled={closingId === p.id}
                  onClick={() => onClosePosition(p.id)}
                >
                  Close
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );


  const exportRows = (): Record<string, unknown>[] => {
    if (tab === "orders" && mode !== "spot")
      return open.map((p) => ({
        market: p.market,
        side: p.side,
        leverage: p.leverage,
        entry_price: p.entry_price,
        size_usd: p.size_usd,
        margin: p.margin,
        opened_at: p.created_at,
      }));
    if (tab === "orders")
      return openOrders.map((o) => ({
        market: o.market,
        side: o.side,
        type: o.order_type,
        price: o.price,
        amount: o.amount,
        filled: o.filled,
        asset: o.pay_asset,
        status: o.status,
        created_at: o.created_at,
      }));

    if (tab === "orderHistory")
      return orderHistory.map((o) => ({
        market: o.market,
        side: o.side,
        type: o.order_type,
        price: o.price,
        amount: o.amount,
        filled: o.filled,
        avg_fill_price: o.avg_fill_price ?? "",
        status: o.status,
        created_at: o.created_at,
      }));
    if (tab === "tradeHistory")
      return tradeHistory.map((t) => ({
        symbol: t.token_symbol ?? market,
        side: t.side,
        amount: t.amount,
        price: t.price ?? "",
        memo: t.memo ?? "",
        created_at: t.created_at,
      }));
    if (tab === "positions")
      return open.map((p) => ({
        market: p.market,
        side: p.side,
        leverage: p.leverage,
        entry_price: p.entry_price,
        size_usd: p.size_usd,
        margin: p.margin,
        margin_asset: p.margin_asset,
        liquidation_price: p.liquidation_price ?? "",
        opened_at: p.created_at,
      }));
    return assets.map((a) => ({ symbol: a.symbol, amount: a.amount }));
  };

  const canExport = exportRows().length > 0;

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
          {onScope && isExpanded && showScope ? (
            <div className="mr-1 flex items-center gap-0.5 rounded-md bg-muted/40 p-0.5">
              {(["pair", "all"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onScope(s)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold press",
                    scope === s ? "bg-background text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s === "pair" ? market : "All"}
                </button>
              ))}
            </div>
          ) : null}
          {onSize && isExpanded ? (

            <div className="mr-0.5 flex items-center gap-0.5">
              {(["sm", "md", "full"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSize(s)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase press",
                    size === s
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s === "sm" ? "Compact" : s === "md" ? "Expanded" : "Full"}
                </button>
              ))}
            </div>
          ) : null}
          {isExpanded && canExport ? (
            <button
              type="button"
              aria-label="Export CSV"
              title="Export CSV"
              onClick={() => downloadCsv(`${market}-${tab}`, exportRows())}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground press hover:bg-muted/50"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          ) : null}
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
                    markPrice: Number(priceByMarket?.[p.market] ?? markPrice) || markPrice,

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
