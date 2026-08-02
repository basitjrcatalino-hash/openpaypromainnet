import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fetchMajorUsdPrices,
  LEDGER_BALANCE_COLUMN,
  type LedgerMajorId,
} from "@/lib/ledger-majors";

const DonateSchema = z.object({
  amount: z.number().positive().min(0.01).max(50_000),
  walletId: z.string().uuid().optional(),
});

export const DONATE_LEDGER_ASSETS = ["USDT", "USDC", "SOL"] as const;
export type DonateLedgerAsset = (typeof DONATE_LEDGER_ASSETS)[number];

const LedgerDonateSchema = z.object({
  amount: z.number().positive().min(0.01).max(50_000),
  pay_asset: z.enum(DONATE_LEDGER_ASSETS),
  walletId: z.string().uuid().optional(),
});

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}
function round12(n: number) {
  return Math.round(n * 1e12) / 1e12;
}

function isStable(asset: DonateLedgerAsset): boolean {
  return asset === "USDT" || asset === "USDC";
}

function balanceColumn(asset: DonateLedgerAsset): string {
  return LEDGER_BALANCE_COLUMN[asset.toLowerCase() as LedgerMajorId];
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

/**
 * Spend Pro wallet USDT / USDC / SOL → credit OUSD to the platform treasury (donation).
 */
export const donateWithLedgerAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LedgerDonateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { amount, pay_asset: payAsset, walletId } = data;
    const grossUsd = round8(amount);
    const col = balanceColumn(payAsset);

    const { fetchActiveWallet } = await import("./wallet-utils");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { creditPlatformFeeOusd } = await import("./platform-treasury");

    let wallet: Record<string, unknown> | null = null;
    if (walletId) {
      const { data: w } = await supabase
        .from("wallets")
        .select(`id, address, ousd_balance, ${col}`)
        .eq("id", walletId)
        .eq("user_id", userId)
        .maybeSingle();
      wallet = w as Record<string, unknown> | null;
    }
    if (!wallet) {
      wallet = (await fetchActiveWallet<Record<string, unknown>>(
        supabase,
        userId,
        `id, address, ousd_balance, ${col}`,
      )) as Record<string, unknown> | null;
    }
    if (!wallet?.id) throw new Error("Active wallet not found");

    const walletIdResolved = String(wallet.id);
    const address = String(wallet.address ?? "");
    const payBal = round12(Number(wallet[col] ?? 0));

    let payDebit: number;
    let payPriceUsd = 1;
    if (isStable(payAsset)) {
      payDebit = grossUsd;
    } else {
      const prices = await fetchMajorUsdPrices(["sol"]);
      payPriceUsd = Number(prices.sol) || 0;
      if (!(payPriceUsd > 0)) throw new Error("Could not price SOL");
      payDebit = round12(grossUsd / payPriceUsd);
    }

    if (payBal + 1e-12 < payDebit) {
      throw new Error(
        `Insufficient ${payAsset} (need ${payDebit}, have ${round12(payBal)})`,
      );
    }

    const nextPay = isStable(payAsset)
      ? round8(payBal - payDebit)
      : round12(payBal - payDebit);

    const debitPatch =
      payAsset === "USDT"
        ? { usdt_balance: nextPay }
        : payAsset === "USDC"
          ? { usdc_balance: nextPay }
          : { sol_balance: nextPay };

    const { error: debitErr } = await supabaseAdmin
      .from("wallets")
      .update(debitPatch)
      .eq("id", walletIdResolved);
    if (debitErr) throw new Error(debitErr.message);

    const credited = await creditPlatformFeeOusd(supabaseAdmin, {
      amount: grossUsd,
      memo: isStable(payAsset)
        ? `Donate · ${payAsset} → treasury · $${grossUsd}`
        : `Donate · ${payDebit} SOL → treasury · ≈ $${grossUsd}`,
      sourceWalletId: walletIdResolved,
      counterparty: address || `${payAsset.toLowerCase()}:ledger`,
    });

    if (!credited.ok) {
      const rollback =
        payAsset === "USDT"
          ? { usdt_balance: payBal }
          : payAsset === "USDC"
            ? { usdc_balance: payBal }
            : { sol_balance: payBal };
      await supabaseAdmin.from("wallets").update(rollback).eq("id", walletIdResolved);
      throw new Error(credited.skipped || "Could not credit donation treasury");
    }

    try {
      await supabaseAdmin.from("transactions").insert({
        wallet_id: walletIdResolved,
        type: "send",
        status: "confirmed",
        token_symbol: payAsset,
        counterparty: "treasury:donate",
        amount: payDebit,
        usd_value: grossUsd,
        memo: `Donate · ${payAsset} · OpenPay Pro`,
      });
    } catch {
      /* optional */
    }

    return {
      ok: true as const,
      amount: grossUsd,
      pay_asset: payAsset,
      pay_debit: payDebit,
      pay_price_usd: payPriceUsd,
    };
  });

/**
 * Start OpenPay Balance / payment-link donation (money stays with partner — no Pro credit).
 */
export const createOpenPayDonateCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        amount: z.number().positive().max(50_000),
        origin: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { openpayPro } = await import("./openpay-pro.server");
    const { resolvePartnerRedirectOrigin } = await import("./openpay-connect.server");
    const { supabase, userId } = context;
    const origin = resolvePartnerRedirectOrigin(data.origin);
    const reference = `pro_donate_${userId.replace(/-/g, "").slice(0, 12)}_${Date.now()}`;
    const successUrl = `${origin}/solana-pay?donate_return=1`;
    const cancelUrl = `${origin}/solana-pay?donate_cancel=1`;

    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("notifications")
      .eq("user_id", userId)
      .maybeSingle();
    const n = (prefs?.notifications ?? {}) as Record<string, unknown>;
    const link = (n.openpay as {
      linked?: boolean;
      account_number?: string;
      identifier?: string;
      username?: string;
      access_token?: string;
    } | undefined) ?? { linked: false };
    if (!link.linked) {
      throw new Error("Connect your OpenPay account in Settings before donating with OpenPay Balance");
    }

    const pendingBase = {
      reference,
      amount: data.amount,
      created_at: new Date().toISOString(),
      payer_account: link.account_number || link.identifier,
      payer_username: link.username,
      purpose: "donate",
    };

    try {
      const charge = await openpayPro.createCharge({
        amount: data.amount,
        currency: "OUSD",
        description: `Donate · OpenPay Pro`,
        reference,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      if (!charge?.id) throw new Error("OpenPay checkout unavailable");
      charge.checkout_url = `https://openpy.space/paybutton/${encodeURIComponent(charge.id)}`;

      const notifications: Record<string, unknown> = {
        ...((prefs?.notifications as Record<string, unknown>) ?? {}),
        openpay_pending_donate: {
          ...pendingBase,
          charge_id: charge.id,
          mode: "checkout",
        },
      };
      await supabase.from("user_preferences").upsert({
        user_id: userId,
        notifications: notifications as never,
        updated_at: new Date().toISOString(),
      });

      return { mode: "checkout" as const, charge, reference };
    } catch (e) {
      console.warn("[openpay donate] PayButton failed, using /pay link:", (e as Error).message);
    }

    const me = await openpayPro.me();
    const partnerUsername = me.username;
    const partnerAccount = me.account_number;
    if (!partnerUsername) {
      throw new Error("Partner OpenPay username unavailable — cannot start donation");
    }

    const payer = (link.account_number || link.username || link.identifier || "").replace(/^@+/, "");
    if (
      payer &&
      (payer.toLowerCase() === partnerUsername.toLowerCase() ||
        (partnerAccount && payer.toUpperCase() === partnerAccount.toUpperCase()))
    ) {
      throw new Error(
        "This OpenPay account owns the partner app, so it cannot pay itself. Connect a different OpenPay user.",
      );
    }

    const pay_url =
      `https://openpy.space/pay/@${encodeURIComponent(partnerUsername)}` +
      `?amount=${encodeURIComponent(String(data.amount))}` +
      `&currency=OUSD` +
      `&note=${encodeURIComponent(reference)}` +
      `&success_url=${encodeURIComponent(successUrl)}` +
      `&cancel_url=${encodeURIComponent(cancelUrl)}`;

    const notifications: Record<string, unknown> = {
      ...((prefs?.notifications as Record<string, unknown>) ?? {}),
      openpay_pending_donate: {
        ...pendingBase,
        partner_username: partnerUsername,
        partner_account: partnerAccount,
        mode: "pay_link",
      },
    };
    await supabase.from("user_preferences").upsert({
      user_id: userId,
      notifications: notifications as never,
      updated_at: new Date().toISOString(),
    });

    return {
      mode: "pay_link" as const,
      pay_url,
      reference,
      amount: data.amount,
      partner_username: partnerUsername,
    };
  });

/** Clear pending donate after OpenPay checkout return (no Pro wallet credit). */
export const settleOpenPayDonate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("notifications")
      .eq("user_id", userId)
      .maybeSingle();
    const notifications = {
      ...((prefs?.notifications as Record<string, unknown>) ?? {}),
    };
    const pending = notifications.openpay_pending_donate as
      | { amount?: number; reference?: string }
      | undefined;
    const amount = Number(pending?.amount ?? 0);
    delete notifications.openpay_pending_donate;
    await supabase.from("user_preferences").upsert({
      user_id: userId,
      notifications: notifications as never,
      updated_at: new Date().toISOString(),
    });
    return {
      ok: true as const,
      amount: amount > 0 ? amount : null,
      reference: pending?.reference ?? null,
    };
  });
