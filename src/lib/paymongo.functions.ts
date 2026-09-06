import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PAYMONGO_MAX_USD, PAYMONGO_MIN_USD } from "@/lib/paymongo";

export const getPaymongoConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { isPaymongoConfigured, getPhpPerUsd } = await import("@/lib/paymongo.server");
    return { configured: isPaymongoConfigured(), phpPerUsd: getPhpPerUsd() };
  });

const CreateSchema = z.object({
  amountUsd: z.number().min(PAYMONGO_MIN_USD).max(PAYMONGO_MAX_USD),
  provider: z.string().trim().max(40).optional(),
  providerName: z.string().trim().max(60).optional(),
});

export const createPaymongoQrTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { createQrPhIntent } = await import("@/lib/paymongo.server");
    const orderRef = `OP-${Date.now().toString(36).toUpperCase()}`;
    const intent = await createQrPhIntent({
      amountUsd: Math.round(data.amountUsd * 100) / 100,
      userId: context.userId,
      orderRef,
      ...(data.provider ? { preferredProvider: data.provider } : {}),
      ...(data.providerName ? { preferredProviderName: data.providerName } : {}),
    });
    if (!intent.qrImageUrl) {
      throw new Error("QR code was not returned by PayMongo. Enable QR Ph on your account.");
    }
    return { ...intent, orderRef };
  });

const ConfirmSchema = z.object({
  intentId: z.string().trim().min(4).max(128),
  walletId: z.string().uuid().optional(),
});

/** Poll a QR Ph intent; credits OUSD 1:1 once PayMongo reports `succeeded`. Idempotent. */
export const confirmPaymongoTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConfirmSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getIntentStatus } = await import("@/lib/paymongo.server");
    const info = await getIntentStatus(data.intentId);

    if (info.userId && info.userId !== userId) throw new Error("Payment belongs to another user");
    if (!info.paid) return { paid: false as const, status: info.status };

    const txHash = `paymongo:${data.intentId}`;
    const { data: existing } = await supabase
      .from("transactions")
      .select("id, amount")
      .eq("tx_hash", txHash)
      .maybeSingle();
    if (existing) {
      return {
        paid: true as const,
        status: info.status,
        alreadyCredited: true as const,
        amount: Number(existing.amount),
      };
    }

    const { fetchActiveWallet } = await import("./wallet-utils");
    let wallet: { id: string } | null = null;
    if (data.walletId) {
      const { data: w } = await supabase
        .from("wallets")
        .select("id")
        .eq("id", data.walletId)
        .eq("user_id", userId)
        .maybeSingle();
      wallet = w;
    }
    if (!wallet) wallet = await fetchActiveWallet<{ id: string }>(supabase, userId);
    if (!wallet) throw new Error("Active wallet not found");

    const gross = Math.round((info.amountUsd || 0) * 100) / 100;
    if (gross <= 0) throw new Error("Payment amount missing");

    const { creditTopupWithFee } = await import("./topup-fee");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const credited = await creditTopupWithFee({
        client: supabase,
        admin: supabaseAdmin,
        userWalletId: wallet.id,
        grossAmount: gross,
        counterparty: `paymongo:${data.intentId.slice(0, 14)}`,
        txHash,
        memo: `PayMongo QR Ph top-up · ${data.intentId}`,
      });
      return {
        paid: true as const,
        status: info.status,
        alreadyCredited: false as const,
        amount: credited.netAmount,
        balance: credited.balance,
      };
    } catch (err) {
      if (/duplicate|unique/i.test((err as Error).message ?? "")) {
        return { paid: true as const, status: info.status, alreadyCredited: true as const, amount: gross };
      }
      throw err;
    }
  });
