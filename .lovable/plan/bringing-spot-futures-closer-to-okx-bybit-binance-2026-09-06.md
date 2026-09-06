# Bringing Spot & Futures closer to OKX / Bybit / Binance

Recommendations, ordered by impact. You can approve all of it, or tell me which phases you want.

## What you already have
A four-column desk (markets list, chart, order book + recent trades, order form), a resizable bottom dock, spot limit/market/stop orders, futures positions with leverage, liquidation price and live PnL.

## Phase 1 — The trading feel (highest impact, pure UI)
- **Order book upgrades**: depth-percentage background bars behind each row, price-grouping selector (0.1 / 0.01 / 0.001), and a book/buy-only/sell-only display toggle. Clicking a row fills price into the form, clicking a size fills the amount.
- **Sticky mid-price row** with last trade price, an up/down arrow, and the mark/index price underneath.
- **Buy/Sell colour discipline**: green up, red down, everywhere, with a single accent for actions.
- **Percentage slider** on the order form (25/50/75/100%) with a draggable track, plus "Order value", "Available", "Max buy/sell" lines under the inputs.
- **Compact number formatting** and monospaced digits so the book and trades stop shifting.

## Phase 2 — Order types and controls exchanges have
- Spot: **market, limit, stop-limit, stop-market, trailing stop, OCO**, plus **post-only / IOC / FOK** time-in-force flags.
- Futures: **reduce-only**, **TP/SL attached at entry**, **trailing stop**, and **close position at market** on the dock.
- **Margin mode switch (Cross / Isolated)** and **position mode (One-way / Hedge)** in the pair header, matching OKX placement.
- **Leverage slider** with a risk warning and estimated liquidation preview before submitting.

## Phase 3 — The information layer
- Pair header: 24h change, high, low, 24h volume in base and quote, **funding rate + countdown to next funding**, open interest, mark and index price.
- **Funding history** and **open interest** tabs beside the chart.
- **Order confirmation drawer** showing cost, fee, estimated liquidation and slippage before it sends.
- Bottom dock tabs matching exchanges: **Positions / Open Orders / Order History / Trade History / Funding / Assets**, each with filters and a CSV export.

## Phase 4 — Mobile trading (this is where exchanges differ most)
- Mobile shows a stacked layout: pair header, chart, then a **Buy/Sell full-width pair of buttons** that opens a bottom-sheet order ticket — not the desktop form squeezed down.
- Swipeable tabs between Chart / Order book / Trades.
- One-tap **Close** and **TP/SL** on each position row.

## Phase 5 — Backend to make it real
- Server-side **order matching worker** that runs on a schedule: fills marketable limit orders, fires stop/trailing triggers, applies TP/SL to positions, and runs liquidations when margin ratio breaches maintenance.
- **Funding payments** every 8 hours on open futures positions, recorded as ledger entries.
- **Fee tiers** (maker/taker) stored in a table and applied on fill, so admin can change them without a code change.
- Every fill, funding payment and liquidation writes a row so history tabs and analytics are truthful.

## Design direction
Keep the dark OKX-style desk: near-black panes separated by hairlines, dense 11–12px data type, generous tap targets only on the action controls. No card shadows or rounded panels inside the terminal — exchanges use flat, edge-to-edge grids. Reserve rounding and colour for the Buy/Sell buttons and the mode switch.

## Technical notes
- New tables: `trade_fees`, `funding_payments`, `order_triggers`; new columns on the orders/positions tables for `time_in_force`, `reduce_only`, `tp_price`, `sl_price`, `trailing_offset`, `margin_mode`, `position_mode`. Each with grants and owner-scoped RLS.
- Matching/funding/liquidation run through a scheduled public API route so a cron can drive it.
- Order book grouping, percentage bars and the mobile ticket are presentation-only changes in `OrderBook.tsx`, `ExchangeOrderForm.tsx`, `ExchangeTerminal.tsx` and `trade.tsx`.
