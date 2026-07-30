import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SessionSchema = z.object({
  product: z.enum(["crypto", "usdc"]).default("crypto"),
  /** Exact USD the user typed on Buy — required for amount-locked Helio sessions. */
  defaultOnrampAmount: z.number().positive().min(1).max(50_000),
});

/**
 * Returns a MoonPay Commerce depositCustomerToken for the signed-in user.
 * Creates an amount-scoped Helio deposit customer (OPENPAY-PRO-{userId}-{product}-{cents})
 * so the widget prefills the exact Buy amount.
 */
export const getHelioDepositSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SessionSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { resolveHelioDepositCustomerToken, isHelioDepositApiConfigured } =
      await import("./helio-deposit.server");

    let email: string | null = null;
    try {
      const { data: auth } = await supabase.auth.getUser();
      email = auth.user?.email ?? null;
    } catch {
      /* ignore */
    }

    const amount = Math.round(data.defaultOnrampAmount);
    const session = await resolveHelioDepositCustomerToken({
      userId,
      product: data.product,
      defaultOnrampAmount: amount,
      customerEmail: email,
    });

    return {
      ok: true as const,
      depositCustomerToken: session.depositCustomerToken,
      customerId: session.customerId,
      depositId: session.depositId,
      product: session.product,
      amountUsd: session.amountUsd ?? amount,
      mode: session.mode,
      apiConfigured: isHelioDepositApiConfigured(),
      network: "main" as const,
    };
  });
