import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  name: z.string().min(1).max(80),
  symbol: z.string().min(1).max(24),
  network: z.string().min(1).max(40),
  category: z.string().max(40).nullable().optional(),
  priceUsd: z.number().finite(),
  change24h: z.number().finite(),
  marketCap: z.number().finite().nullable().optional(),
  volume24h: z.number().finite().nullable().optional(),
  description: z.string().max(600).nullable().optional(),
  /** Cache key fragment — e.g. token id */
  tokenKey: z.string().min(1).max(80),
});

/**
 * Phantom-style AI market insight + related news for a token detail page.
 * Uses OpenRouter model inclusionai/ling-3.0-flash:free (server-side key).
 */
export const getTokenMarketInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    const { generateTokenInsights, isOpenRouterConfigured } = await import(
      "./token-insights.server"
    );

    const insights = await generateTokenInsights({
      name: data.name,
      symbol: data.symbol,
      network: data.network,
      category: data.category,
      priceUsd: data.priceUsd,
      change24h: data.change24h,
      marketCap: data.marketCap,
      volume24h: data.volume24h,
      description: data.description,
    });

    return {
      ok: true as const,
      tokenKey: data.tokenKey,
      configured: isOpenRouterConfigured(),
      ...insights,
    };
  });
