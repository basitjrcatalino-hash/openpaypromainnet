import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  banxaConfigured,
  banxaPaymentMethodId,
  createBanxaBuyOrder,
  fetchBanxaOrder,
  getBanxaConfig,
  isBanxaOrderComplete,
} from "@/lib/banxa.server";
import {
  isBanxaTopupMethod,
  type BanxaTopupMethodKey,
} from "@/lib/topup-methods";

const CreateSchema = z.object({
  amount: z.number().positive().min(1).max(50_000),
  methodKey: z.enum([
    "banxa_apple_pay",
    "banxa_google_pay",
    "banxa_card",
    "banxa_bank",
  ]),
  walletId: z.string().uuid(),
  origin: z.string().url().max(500),
});

const SyncSchema = z.object({
  banxaOrderId: z.string().trim().min(8).max(128).optional(),
  externalOrderId: z.string().trim().min(8).max(200).optional(),
});

export const getBanxaTopupStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const cfg = getBanxaConfig();
    return {
      configured: banxaConfigured(),
      env: cfg.env,
      fiat: cfg.fiat,
      crypto: cfg.crypto,
      blockchain: cfg.blockchain,
    };
  });

/**
 * Create a Banxa Hosted Checkout buy order for Apple Pay / Google Pay / Card / Bank.
 * Returns checkoutUrl for redirect / embed.
 */
export const createBanxaTopupOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!isBanxaTopupMethod(data.methodKey)) {
      throw new Error("Invalid Banxa payment method");
    }
    const methodKey = data.methodKey as BanxaTopupMethodKey;

    const { data: wallet } = await supabase
      .from("wallets")
      .select("id")
      .eq("id", data.walletId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!wallet) throw new Error("Wallet not found");

    // Respect admin maintenance toggle
    const { data: methodRow } = await supabase
      .from("topup_methods")
      .select("enabled")
      .eq("method_key", methodKey)
      .maybeSingle();
    if (methodRow && methodRow.enabled === false) {
      throw new Error("This payment method is temporarily unavailable");
    }

    const paymentMethodId = banxaPaymentMethodId(methodKey);
    const externalOrderId = `ousd_${data.walletId}_${Date.now()}`;
    const redirectUrl = `${data.origin.replace(/\/$/, "")}/topup?banxa_return=1&banxa_ext=${encodeURIComponent(externalOrderId)}`;

    let email: string | null = null;
    try {
      const { data: authUser } = await supabase.auth.getUser();
      email = authUser.user?.email ?? null;
    } catch {
      /* optional */
    }

    const order = await createBanxaBuyOrder({
      paymentMethodId,
      fiatAmount: data.amount,
      externalCustomerId: userId,
      externalOrderId,
      redirectUrl,
      email,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cfg = getBanxaConfig();
    await supabaseAdmin.from("banxa_topup_orders").insert({
      user_id: userId,
      wallet_id: data.walletId,
      method_key: methodKey,
      banxa_order_id: order.id,
      external_order_id: externalOrderId,
      fiat_currency: cfg.fiat,
      fiat_amount: data.amount,
      payment_method_id: paymentMethodId,
      checkout_url: order.checkoutUrl,
      status: "created",
    });

    return {
      ok: true as const,
      checkoutUrl: order.checkoutUrl,
      banxaOrderId: order.id,
      externalOrderId,
      paymentMethodId,
      fiat: cfg.fiat,
      amount: data.amount,
    };
  });

/**
 * Poll Banxa order after redirect return; credit OUSD when complete.
 */
export const syncBanxaTopupOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SyncSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.banxaOrderId && !data.externalOrderId) {
      throw new Error("Order id required");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    type BanxaOrderRow = {
      id: string;
      wallet_id: string;
      banxa_order_id: string | null;
      external_order_id: string;
      fiat_amount: number;
      credited: boolean;
      status: string;
    };

    let row: BanxaOrderRow | null = null;

    if (data.externalOrderId) {
      const { data: r } = await supabase
        .from("banxa_topup_orders")
        .select(
          "id, wallet_id, banxa_order_id, external_order_id, fiat_amount, credited, status",
        )
        .eq("external_order_id", data.externalOrderId)
        .eq("user_id", userId)
        .maybeSingle();
      row = (r as BanxaOrderRow | null) ?? null;
    }
    if (!row && data.banxaOrderId) {
      const { data: r } = await supabase
        .from("banxa_topup_orders")
        .select(
          "id, wallet_id, banxa_order_id, external_order_id, fiat_amount, credited, status",
        )
        .eq("banxa_order_id", data.banxaOrderId)
        .eq("user_id", userId)
        .maybeSingle();
      row = (r as BanxaOrderRow | null) ?? null;
    }
    if (!row) throw new Error("Banxa order not found");

    const orderRow = row;
    if (orderRow.credited) {
      return {
        ok: true as const,
        alreadyCredited: true as const,
        status: orderRow.status,
        amount: Number(orderRow.fiat_amount),
      };
    }

    const orderId = orderRow.banxa_order_id || data.banxaOrderId;
    if (!orderId) throw new Error("Missing Banxa order id");

    const remote = await fetchBanxaOrder(orderId);
    const status = remote.status || "unknown";

    await supabaseAdmin
      .from("banxa_topup_orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderRow.id);

    if (!isBanxaOrderComplete(status)) {
      return {
        ok: true as const,
        alreadyCredited: false as const,
        status,
        pending: true as const,
      };
    }

    const { creditBanxaTopupOrder } = await import("./banxa-credit.server");
    const credited = await creditBanxaTopupOrder({
      banxaOrderId: orderId,
      externalOrderId: orderRow.external_order_id,
      userId,
      walletId: orderRow.wallet_id,
      fiatAmount: Number(remote.fiatAmount ?? orderRow.fiat_amount),
      cryptoAmount: remote.cryptoAmount ? Number(remote.cryptoAmount) : null,
    });

    return {
      ok: true as const,
      alreadyCredited: credited.alreadyCredited,
      status: "complete",
      amount: credited.amount,
    };
  });
