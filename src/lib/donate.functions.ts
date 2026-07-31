import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DonateSchema = z.object({
  amount: z.number().positive().min(0.01).max(50_000),
  walletId: z.string().uuid().optional(),
});

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

/**
 * Donate OUSD from the user's active OpenPay Pro wallet to the platform treasury.
 */
export const donateOusd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DonateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const amount = round8(data.amount);
    if (!(amount > 0)) throw new Error("Enter a valid amount");

    const { fetchActiveWallet } = await import("./wallet-utils");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolvePlatformTreasuryWallet, creditPlatformFeeOusd } = await import(
      "./platform-treasury"
    );

    let wallet: {
      id: string;
      address: string;
      ousd_balance?: number | null;
    } | null = null;

    if (data.walletId) {
      const { data: w } = await supabase
        .from("wallets")
        .select("id, address, ousd_balance")
        .eq("id", data.walletId)
        .eq("user_id", userId)
        .maybeSingle();
      wallet = w;
    }
    if (!wallet) {
      wallet = await fetchActiveWallet<{
        id: string;
        address: string;
        ousd_balance?: number | null;
      }>(supabase, userId);
    }
    if (!wallet) throw new Error("Active wallet not found");

    const bal = round8(Number(wallet.ousd_balance ?? 0));
    if (bal < amount) throw new Error("Insufficient OUSD balance");

    const treasury = await resolvePlatformTreasuryWallet(supabaseAdmin);
    if (!treasury) throw new Error("Donation treasury is not configured");
    if (treasury.id === wallet.id) {
      throw new Error("Cannot donate to your own treasury wallet");
    }

    const nextUser = round8(bal - amount);
    const { error: debitErr } = await supabaseAdmin
      .from("wallets")
      .update({ ousd_balance: nextUser })
      .eq("id", wallet.id);
    if (debitErr) throw new Error(debitErr.message);

    const credited = await creditPlatformFeeOusd(supabaseAdmin, {
      amount,
      memo: `Donate · OpenPay Pro · from ${wallet.address.slice(0, 10)}…`,
      sourceWalletId: wallet.id,
      counterparty: wallet.address,
    });

    if (!credited.ok) {
      // Best-effort rollback
      await supabaseAdmin.from("wallets").update({ ousd_balance: bal }).eq("id", wallet.id);
      throw new Error(credited.skipped || "Could not credit donation treasury");
    }

    try {
      await supabaseAdmin.from("transactions").insert({
        wallet_id: wallet.id,
        type: "send",
        status: "confirmed",
        token_symbol: "OUSD",
        counterparty: treasury.address,
        amount,
        usd_value: amount,
        memo: "Donate · OpenPay Pro",
      });
    } catch {
      /* optional ledger */
    }

    return {
      ok: true as const,
      amount,
      balance: nextUser,
      treasuryAddress: treasury.address,
    };
  });
