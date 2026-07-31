import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function readOpenPayUsername(notifications: unknown): {
  linked: boolean;
  username?: string;
  openpayUserId?: string;
} {
  const n = (notifications ?? {}) as Record<string, unknown>;
  const link = n.openpay as
    | {
        linked?: boolean;
        username?: string;
        openpayUserId?: string;
        identifier?: string;
        account_number?: string;
      }
    | undefined;
  if (!link?.linked) return { linked: false };
  const username = (link.username || link.identifier || link.account_number || "")
    .replace(/^@+/, "")
    .trim();
  return {
    linked: true,
    username: username || undefined,
    openpayUserId: link.openpayUserId,
  };
}

function stripHeavyImages<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  for (const key of ["image", "image_url", "cover_url", "media_url"] as const) {
    const v = out[key];
    if (typeof v === "string" && v.startsWith("data:") && v.length > 8_000) {
      (out as Record<string, unknown>)[key] = null;
    }
  }
  if (out.item && typeof out.item === "object") {
    (out as Record<string, unknown>).item = stripHeavyImages(
      out.item as Record<string, unknown>,
    );
  }
  return out;
}

/** Marketplace feed proxied server-side — strips huge base64 so the UI stays fast. */
export const fetchOpenNftMarketplaceFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        collectionsLimit: z.number().int().positive().max(50).optional(),
        itemsLimit: z.number().int().positive().max(50).optional(),
      })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const {
      fetchOpenNftCollections,
      fetchOpenNftMarketplaceItems,
    } = await import("./openpay-nft");

    // Independent loads — don't fail the whole page if one list hits HTTP 546
    const [collectionsResult, itemsResult] = await Promise.allSettled([
      fetchOpenNftCollections({ limit: Math.min(data?.collectionsLimit ?? 2, 2) }),
      fetchOpenNftMarketplaceItems({ limit: Math.min(data?.itemsLimit ?? 2, 2) }),
    ]);

    const collections =
      collectionsResult.status === "fulfilled"
        ? collectionsResult.value.map((c) =>
            stripHeavyImages(c as unknown as Record<string, unknown>),
          )
        : [];
    const items =
      itemsResult.status === "fulfilled"
        ? itemsResult.value.map((i) =>
            stripHeavyImages(i as unknown as Record<string, unknown>),
          )
        : [];

    const collectionsError =
      collectionsResult.status === "rejected"
        ? (collectionsResult.reason as Error)?.message || "Collections failed"
        : null;
    const itemsError =
      itemsResult.status === "rejected"
        ? (itemsResult.reason as Error)?.message || "Items failed"
        : null;

    if (!collections.length && !items.length && (collectionsError || itemsError)) {
      throw new Error(itemsError || collectionsError || "Marketplace unavailable");
    }

    return {
      collections: collections as Awaited<ReturnType<typeof fetchOpenNftCollections>>,
      items: items as Awaited<ReturnType<typeof fetchOpenNftMarketplaceItems>>,
      collectionsError,
      itemsError,
    };
  });

/** Whether partner mint API is reachable + whether user is linked. */
export const getOpenNftMintStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("notifications")
      .eq("user_id", userId)
      .maybeSingle();
    const link = readOpenPayUsername(prefs?.notifications);

    let mintAvailable = false;
    let mintStatus = 0;
    let mintBase = "";
    try {
      const { probeOpenNftMintApi } = await import("./openpay-nft.server");
      const probe = await probeOpenNftMintApi();
      mintAvailable = probe.available;
      mintStatus = probe.status;
      mintBase = probe.base;
    } catch (e) {
      return {
        linked: link.linked,
        username: link.username ?? null,
        openpayUserId: link.openpayUserId ?? null,
        mintAvailable: false,
        mintStatus: 0,
        mintBase: "",
        partnerKeyConfigured: !/not configured/i.test((e as Error).message),
        message: (e as Error).message,
      };
    }

    return {
      linked: link.linked,
      username: link.username ?? null,
      openpayUserId: link.openpayUserId ?? null,
      mintAvailable,
      mintStatus,
      mintBase,
      partnerKeyConfigured: true,
      message: mintAvailable
        ? null
        : "Mint coming soon — OpenPay is still deploying nft-partner-api.",
    };
  });

/**
 * Mint an NFT on OpenPay OpenNFT marketplace via partner API.
 * Always attributes `properties.source = "openpay_pro"`.
 */
export const mintOpenNftOnOpenPay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(2000).optional().nullable(),
        imageUrl: z.string().url(),
        price: z.number().min(0).max(1_000_000),
        quantity: z.number().int().positive().max(10_000).optional(),
        listOnMarketplace: z.boolean().optional(),
        category: z.string().trim().max(40).optional(),
        walletId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("notifications")
      .eq("user_id", userId)
      .maybeSingle();
    const link = readOpenPayUsername(prefs?.notifications);
    if (!link.linked || !link.username) {
      throw new Error("Connect your OpenPay account in Settings before minting OpenNFTs");
    }

    const { resolveCreditWallet } = await import("./wallet-utils");
    const wallet = await resolveCreditWallet<{ id: string; address?: string }>(
      supabase,
      userId,
      data.walletId,
    );
    if (!wallet) throw new Error("Active wallet not found");

    const externalMintId = `pro_mint_${userId.replace(/-/g, "").slice(0, 12)}_${Date.now().toString(36)}`;
    const code = `pro-${externalMintId}`.slice(0, 64);

    const { mintOpenNftPartner, OpenNftMintUnavailableError } = await import(
      "./openpay-nft.server"
    );

    let result;
    try {
      result = await mintOpenNftPartner({
        name: data.name,
        code,
        description: data.description || `Minted on OpenPay Pro`,
        image_url: data.imageUrl,
        media_url: data.imageUrl,
        media_type: "image",
        quantity: data.quantity ?? 1,
        price: data.price,
        currency: "OUSD",
        creator_mode: "platform",
        recipient_username: link.username,
        list_on_marketplace: data.listOnMarketplace ?? true,
        payment_method: "openpay_balance",
        properties: {
          source: "openpay_pro",
          external_mint_id: externalMintId,
          category: data.category || "pro",
          pro_user_id: userId,
          pro_wallet_id: wallet.id,
        },
      });
    } catch (e) {
      if (e instanceof OpenNftMintUnavailableError) throw e;
      throw e;
    }

    // Mirror locally for Pro wallet history (best-effort)
    try {
      await supabase.from("nfts").insert({
        creator_id: userId,
        owner_wallet_id: wallet.id,
        name: data.name,
        description: data.description ?? null,
        media_url: data.imageUrl,
        media_type: "image",
        price: data.price,
        royalty_bps: 0,
        listed: true,
      });
    } catch {
      /* local mirror optional */
    }

    try {
      await supabase.from("transactions").insert({
        wallet_id: wallet.id,
        type: "mint",
        status: "confirmed",
        token_symbol: "NFT",
        counterparty: `openpay-nft:${result.item_id}`,
        amount: Number(data.price) || 0,
        usd_value: Number(data.price) || 0,
        memo: `OpenPay OpenNFT mint · ${data.name} · ${result.permalink}`,
      });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { notifyWalletTransaction } = await import("./tx-alerts.server");
      await notifyWalletTransaction(supabaseAdmin as never, wallet.id, {
        type: "mint",
        token_symbol: "NFT",
        amount: Number(data.price) || 0,
        memo: `OpenPay OpenNFT mint · ${data.name}`,
        counterparty: `openpay-nft:${result.item_id}`,
        status: "confirmed",
        wallet_id: wallet.id,
      });
    } catch {
      /* ledger / alert optional */
    }

    const { raw: _raw, ...safeResult } = result as typeof result & { raw?: unknown };
    return {
      ...safeResult,
      external_mint_id: externalMintId,
      recipient_username: link.username,
    };
  });
