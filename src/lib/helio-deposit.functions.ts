import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SessionSchema = z.object({
  product: z.enum(["crypto", "usdc"]).default("crypto"),
  defaultOnrampAmount: z.number().positive().min(1).max(50_000).optional(),
});

/**
 * Returns a MoonPay Commerce depositCustomerToken for the signed-in user.
 * Creates the Helio deposit customer on first use (per OPENPAY-PRO-{userId}).
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

    const session = await resolveHelioDepositCustomerToken({
      userId,
      product: data.product,
      defaultOnrampAmount: data.defaultOnrampAmount,
      customerEmail: email,
    });

    return {
      ok: true as const,
      depositCustomerToken: session.depositCustomerToken,
      customerId: session.customerId,
      depositId: session.depositId,
      product: session.product,
      mode: session.mode,
      apiConfigured: isHelioDepositApiConfigured(),
      network: "main" as const,
    };
  });
