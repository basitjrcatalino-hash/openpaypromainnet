/**
 * Trust Wallet API — authenticated server functions for OpenPay Pro UI.
 * Secrets stay on the server (TW_ACCESS_ID / TW_HMAC_SECRET).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  trustWalletConfigured,
  trustWalletDomains,
  trustWalletListings,
  trustWalletSearchAssets,
  trustWalletSwapQuote,
  trustWalletTickers,
  trustWalletValidateAddress,
} from "@/lib/trustwallet.server";

/** Force JSON-serializable payload for TanStack Start server fns. */
function jsonPayload<T extends object>(value: unknown): T {
  return JSON.parse(JSON.stringify(value ?? {})) as T;
}

export const getTrustWalletStatus = createServerFn({ method: "GET" }).handler(
  async () => ({
    configured: trustWalletConfigured(),
    base: "https://tws.trustwallet.com",
  }),
);

const SearchSchema = z.object({
  query: z.string().min(1).max(120),
  networks: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const searchTrustWalletAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchSchema.parse(d))
  .handler(async ({ data }) => {
    const res = await trustWalletSearchAssets(data);
    if (!res.ok) throw new Error(res.error || "Trust Wallet search failed");
    return jsonPayload<{ total: number; docs: object[] }>({
      total: res.data.total ?? 0,
      docs: res.data.docs ?? [],
    });
  });

const ListingsSchema = z.object({
  category_id: z.string().optional(),
  currency: z.string().optional(),
  sort: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  networks: z.string().optional(),
  cursor: z.string().optional(),
});

export const listTrustWalletAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListingsSchema.parse(d))
  .handler(async ({ data }) => {
    const res = await trustWalletListings(data);
    if (!res.ok) throw new Error(res.error || "Trust Wallet listings failed");
    return jsonPayload<{ docs: object[]; cursor: string | null }>({
      docs: res.data.docs ?? [],
      cursor: res.data.cursor ?? null,
    });
  });

const PricesSchema = z.object({
  assets: z.array(z.string().min(1)).min(1).max(50),
  currency: z.string().optional(),
});

export const fetchTrustWalletPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PricesSchema.parse(d))
  .handler(async ({ data }) => {
    const res = await trustWalletTickers(
      data.assets,
      data.currency?.trim() || "USD",
    );
    if (!res.ok) throw new Error(res.error || "Trust Wallet prices failed");
    return jsonPayload<{
      tickers: Array<{
        id: string;
        price?: number;
        change_24h?: number;
        market_cap?: number;
        volume_24h?: number;
      }>;
    }>({ tickers: res.tickers });
  });

const ValidateSchema = z.object({
  address: z.string().min(4).max(256),
  asset_id: z.string().optional(),
  type: z.enum(["address", "transaction"]).optional(),
});

export const validateTrustWalletAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ValidateSchema.parse(d))
  .handler(async ({ data }) => {
    const res = await trustWalletValidateAddress(data);
    if (!res.ok) throw new Error(res.error || "Trust Wallet validate failed");
    return jsonPayload<{
      valid?: boolean;
      result?: string;
      details?: object | null;
    }>(res.data);
  });

const QuoteSchema = z.object({
  fromAsset: z.string().min(1),
  fromAddress: z.string().min(1),
  fromDomain: z.string().min(1),
  amount: z.string().min(1),
  toAsset: z.string().min(1),
  toDomain: z.string().min(1),
  toAddress: z.string().optional(),
  slippage: z.string().optional(),
  sortBy: z.string().optional(),
  contractCall: z.boolean().optional(),
  preferredProviders: z.array(z.string()).optional(),
  ignoredProviders: z.array(z.string()).optional(),
});

export const getTrustWalletSwapQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => QuoteSchema.parse(d))
  .handler(async ({ data }) => {
    const res = await trustWalletSwapQuote(data);
    if (!res.ok) throw new Error(res.error || "Trust Wallet quote failed");
    return jsonPayload<{ routes?: object[]; config?: object | null }>(res.data);
  });

export const listTrustWalletDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const res = await trustWalletDomains(true);
    if (!res.ok) throw new Error(res.error || "Trust Wallet domains failed");
    return jsonPayload<{ domains: object[] }>({
      domains: res.data.domains ?? [],
    });
  });
