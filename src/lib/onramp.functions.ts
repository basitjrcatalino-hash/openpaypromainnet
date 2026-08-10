import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildOnrampMerchantId } from "@/lib/onramp";

const SessionSchema = z.object({
  flow: z.enum(["onramp", "offramp"]).default("onramp"),
  amount: z.number().positive().min(1).max(50_000),
  walletId: z.string().uuid(),
  origin: z.string().url().max(500),
});

const SyncSchema = z.object({
  merchantRecognitionId: z.string().trim().min(8).max(200),
});

export const getOnrampStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getOnrampConfig, onrampConfigured, onrampApiConfigured } =
      await import("./onramp.server");
    const cfg = getOnrampConfig();
    return {
      configured: onrampConfigured(),
      apiConfigured: onrampApiConfigured(),
      env: cfg.env,
      coinCode: cfg.coinCode,
      fiatType: cfg.fiatType,
    };
  });

/** Create an Onramp.money hosted widget session (buy or sell). */
export const createOnrampSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SessionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id")
      .eq("id", data.walletId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!wallet) throw new Error("Wallet not found");

    const { buildOnrampWidgetUrl } = await import("./onramp.server");
    const merchantRecognitionId = buildOnrampMerchantId(data.walletId);
    const redirectUrl = `${data.origin.replace(/\/$/, "")}/topup?onramp_return=1&onramp_ref=${merchantRecognitionId}`;

    const widgetUrl = buildOnrampWidgetUrl({
      flow: data.flow,
      amountUsd: data.amount,
      merchantRecognitionId,
      redirectUrl,
    });

    return { ok: true as const, widgetUrl, merchantRecognitionId, flow: data.flow };
  });

/** Poll Onramp for order state and credit OUSD when complete. */
export const syncOnrampOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SyncSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { fetchOnrampOrder, isOnrampOrderComplete, onrampApiConfigured } =
      await import("./onramp.server");
    const { parseWalletIdFromOnrampMerchantId } = await import("./onramp");

    if (!onrampApiConfigured()) {
      return {
        ok: true as const,
        pending: true,
        status: "unknown",
        message:
          "Order tracking needs ONRAMP_API_KEY / ONRAMP_API_SECRET — OUSD is credited automatically by webhook.",
      };
    }

    const order = await fetchOnrampOrder(data.merchantRecognitionId);
    if (!order) {
      return { ok: true as const, pending: true, status: "not_found" };
    }
    if (!isOnrampOrderComplete(order.status)) {
      return { ok: true as const, pending: true, status: String(order.status ?? "pending") };
    }

    const { creditOnrampOrder } = await import("./onramp-credit.server");
    const result = await creditOnrampOrder({
      orderId: String(order.orderId ?? data.merchantRecognitionId),
      merchantRecognitionId: data.merchantRecognitionId,
      userId,
      walletId: parseWalletIdFromOnrampMerchantId(data.merchantRecognitionId),
      fiatAmount: order.fiatAmount ?? null,
      coinAmount: order.coinAmount ?? null,
    });

    return { pending: false, status: "completed", ...result };
  });
