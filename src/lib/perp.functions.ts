/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PERP_LEVERAGE_OPTIONS,
  PERP_MARGIN_ASSETS,
  PERP_MARKETS,
  type PerpMarket,
  type PerpPosition,
} from "@/lib/perp";
import { fetchPerpLiveQuote } from "@/lib/tradingview-perps";

const OpenSchema = z.object({
  market: z.enum(PERP_MARKETS),
  side: z.enum(["long", "short"]),
  leverage: z.number().refine((n) => (PERP_LEVERAGE_OPTIONS as readonly number[]).includes(n)),
  margin_asset: z.enum(PERP_MARGIN_ASSETS),
  margin: z.number().positive().max(1e12),
});

const CloseSchema = z.object({
  id: z.string().uuid(),
});

async function markPriceUsd(market: string): Promise<number> {
  const quote = await fetchPerpLiveQuote(market.toUpperCase() as PerpMarket);
  const px = quote.markPrice || quote.price;
  if (!Number.isFinite(px) || px <= 0) throw new Error(`No mark price for ${market}`);
  return px;
}

export const listPerpPositions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PerpPosition[]> => {
    const { data, error } = await (context.supabase as any)
      .from("perp_positions")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      // Table may not exist until migration applied
      if (/perp_positions|schema cache|does not exist/i.test(error.message)) return [];
      throw new Error(error.message);
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      wallet_id: r.wallet_id,
      market: String(r.market).toUpperCase() as PerpPosition["market"],
      side: String(r.side).toLowerCase() as PerpPosition["side"],
      leverage: Number(r.leverage),
      margin_asset: String(r.margin_asset).toUpperCase() as PerpPosition["margin_asset"],
      margin: Number(r.margin),
      entry_price: Number(r.entry_price),
      size_usd: Number(r.size_usd),
      status: r.status,
      exit_price: r.exit_price == null ? null : Number(r.exit_price),
      realized_pnl: r.realized_pnl == null ? null : Number(r.realized_pnl),
      closed_at: r.closed_at,
      created_at: r.created_at,
    }));
  });

export const openPerpPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OpenSchema.parse(d))
  .handler(async ({ context, data }) => {
    const entry = await markPriceUsd(data.market);
    const { data: pos, error } = await (context.supabase as any).rpc("perp_open_position", {
      _market: data.market,
      _side: data.side,
      _leverage: data.leverage,
      _margin_asset: data.margin_asset,
      _margin: data.margin,
      _entry_price: entry,
    });
    if (error) throw new Error(error.message);
    return pos;
  });

export const closePerpPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CloseSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: existing, error: findErr } = await (context.supabase as any)
      .from("perp_positions")
      .select("market, status")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!existing) throw new Error("Position not found");
    if (existing.status !== "open") throw new Error("Position is already closed");

    const exit = await markPriceUsd(String(existing.market));
    const { data: pos, error } = await (context.supabase as any).rpc("perp_close_position", {
      _position_id: data.id,
      _exit_price: exit,
    });
    if (error) throw new Error(error.message);
    return pos;
  });
