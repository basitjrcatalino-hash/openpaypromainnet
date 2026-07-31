/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  WITHDRAWAL_MIN_OUSD,
  WITHDRAWAL_TREASURY_ADDRESS,
  WITHDRAWAL_TREASURY_USERNAME,
  isValidDestinationAddress,
} from "@/lib/withdraw-ousd";

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin only");
}

async function getAdmin() {
  const { hasSupabaseAdminEnv } = await import("@/integrations/supabase/env.server");
  if (!hasSupabaseAdminEnv()) throw new Error("Server admin client not configured");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function resolveWithdrawalTreasury(admin: any): Promise<{
  id: string;
  user_id: string;
  address: string;
  ousd_balance?: number | null;
} | null> {
  const { data: byAddr } = await admin
    .from("wallets")
    .select("id, user_id, address, ousd_balance")
    .ilike("address", WITHDRAWAL_TREASURY_ADDRESS.toLowerCase())
    .limit(1)
    .maybeSingle();
  if (byAddr) return byAddr;

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", WITHDRAWAL_TREASURY_USERNAME)
    .limit(1)
    .maybeSingle();
  if (!profile?.id) return null;

  const { data: byUser } = await admin
    .from("wallets")
    .select("id, user_id, address, ousd_balance")
    .eq("user_id", profile.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return byUser ?? null;
}

const CreateSchema = z.object({
  amount: z.number().positive().max(1e12),
  destination_address: z
    .string()
    .trim()
    .min(20)
    .max(128)
    .refine(isValidDestinationAddress, "Enter a valid Pi / OUSD wallet address"),
  note: z.string().trim().max(500).nullable().optional(),
  display_name: z.string().trim().max(80).nullable().optional(),
  username: z.string().trim().max(40).nullable().optional(),
});

export const getWithdrawContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { fetchActiveWallet } = await import("./wallet-utils");
    const wallet = await fetchActiveWallet<{
      id: string;
      address: string;
      ousd_balance?: number | null;
      name?: string | null;
    }>(supabase, userId, "id, address, ousd_balance, name");

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, username, pi_username, pi_wallet_address")
      .eq("id", userId)
      .maybeSingle();

    return {
      wallet: wallet
        ? {
            id: wallet.id,
            address: wallet.address,
            name: wallet.name ?? null,
            ousd_balance: Number(wallet.ousd_balance ?? 0),
          }
        : null,
      profile: {
        display_name: profile?.display_name ?? null,
        username: profile?.username ?? profile?.pi_username ?? null,
        pi_wallet_address: profile?.pi_wallet_address ?? null,
      },
      min_ousd: WITHDRAWAL_MIN_OUSD,
      treasury_address: WITHDRAWAL_TREASURY_ADDRESS,
      treasury_username: WITHDRAWAL_TREASURY_USERNAME,
    };
  });

export const createOusdWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const amount = round8(data.amount);
    if (amount < WITHDRAWAL_MIN_OUSD) {
      throw new Error(`Minimum withdrawal is ${WITHDRAWAL_MIN_OUSD} OUSD`);
    }

    const dest = data.destination_address.trim();
    const admin = await getAdmin();
    const { fetchActiveWallet } = await import("./wallet-utils");
    const wallet = await fetchActiveWallet<{
      id: string;
      address: string;
      ousd_balance?: number | null;
      name?: string | null;
    }>(supabase, userId, "id, address, ousd_balance, name");
    if (!wallet) throw new Error("Active wallet not found");

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, username, pi_username")
      .eq("id", userId)
      .maybeSingle();

    const displayName =
      data.display_name?.trim() ||
      profile?.display_name ||
      wallet.name ||
      null;
    const username =
      data.username?.trim()?.replace(/^@+/, "") ||
      profile?.username ||
      profile?.pi_username ||
      null;

    const bal = Number(wallet.ousd_balance ?? 0);
    if (bal + 1e-12 < amount) throw new Error("Insufficient OUSD balance");

    const treasury = await resolveWithdrawalTreasury(admin);
    if (!treasury) {
      throw new Error(
        `Withdrawal treasury not found (@${WITHDRAWAL_TREASURY_USERNAME} / ${WITHDRAWAL_TREASURY_ADDRESS})`,
      );
    }

    if (dest.toLowerCase() === String(wallet.address).toLowerCase()) {
      throw new Error("Destination cannot be your OpenPay Pro wallet — use your Pi mainnet OUSD address");
    }

    const nextUser = round8(bal - amount);
    const { error: debitErr } = await admin
      .from("wallets")
      .update({ ousd_balance: nextUser })
      .eq("id", wallet.id)
      .eq("user_id", userId);
    if (debitErr) throw new Error(debitErr.message);

    const { data: freshT } = await admin
      .from("wallets")
      .select("ousd_balance")
      .eq("id", treasury.id)
      .maybeSingle();
    const nextTreasury = round8(Number(freshT?.ousd_balance ?? treasury.ousd_balance ?? 0) + amount);
    const { error: creditErr } = await admin
      .from("wallets")
      .update({ ousd_balance: nextTreasury })
      .eq("id", treasury.id);
    if (creditErr) {
      // best-effort rollback
      await admin.from("wallets").update({ ousd_balance: bal }).eq("id", wallet.id);
      throw new Error(creditErr.message);
    }

    const note = data.note?.trim() || null;
    const { data: row, error: insErr } = await admin
      .from("ousd_withdrawals")
      .insert({
        user_id: userId,
        wallet_id: wallet.id,
        amount,
        destination_address: dest,
        display_name: displayName,
        username,
        note,
        status: "pending",
        treasury_address: WITHDRAWAL_TREASURY_ADDRESS,
        treasury_wallet_id: treasury.id,
      })
      .select("*")
      .single();
    if (insErr) {
      await admin.from("wallets").update({ ousd_balance: bal }).eq("id", wallet.id);
      await admin
        .from("wallets")
        .update({ ousd_balance: round8(nextTreasury - amount) })
        .eq("id", treasury.id);
      throw new Error(insErr.message);
    }

    try {
      await admin.from("transactions").insert([
        {
          wallet_id: wallet.id,
          type: "send",
          status: "pending",
          token_symbol: "OUSD",
          counterparty: WITHDRAWAL_TREASURY_ADDRESS,
          amount,
          usd_value: amount,
          memo: note
            ? `OUSD withdraw → ${dest} · ${note}`
            : `OUSD withdraw → ${dest}`,
        },
        {
          wallet_id: treasury.id,
          type: "receive",
          status: "confirmed",
          token_symbol: "OUSD",
          counterparty: wallet.address,
          amount,
          usd_value: amount,
          memo: `Withdrawal lock from @${username || "user"} · pending payout to ${dest}`,
        },
      ]);
    } catch (e) {
      console.warn("[withdraw] ledger insert failed", e);
    }

    return { ok: true as const, withdrawal: row };
  });

export const listMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any)
      .from("ousd_withdrawals")
      .select(
        "id, amount, destination_address, display_name, username, note, status, admin_note, payout_tx_hash, created_at, updated_at, reviewed_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const cancelMyWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const admin = await getAdmin();

    const { data: row, error } = await admin
      .from("ousd_withdrawals")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Withdrawal not found");
    if (row.status !== "pending") throw new Error("Only pending withdrawals can be cancelled");

    await refundWithdrawal(admin, row, userId, "Cancelled by user");

    const { error: updErr } = await admin
      .from("ousd_withdrawals")
      .update({
        status: "cancelled",
        admin_note: "Cancelled by user",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending");
    if (updErr) throw new Error(updErr.message);

    return { ok: true as const };
  });

const ReviewSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  admin_note: z.string().trim().max(1000).nullable().optional(),
  payout_tx_hash: z.string().trim().max(200).nullable().optional(),
});

export const listAdminWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { data, error } = await admin
      .from("ousd_withdrawals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const reviewOusdWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { userId } = context;

    const { data: row, error } = await admin
      .from("ousd_withdrawals")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Withdrawal not found");
    if (row.status !== "pending") throw new Error("Already reviewed");

    if (data.action === "reject") {
      await refundWithdrawal(admin, row, row.user_id, data.admin_note || "Rejected by admin");
      const { error: updErr } = await admin
        .from("ousd_withdrawals")
        .update({
          status: "rejected",
          admin_note: data.admin_note?.trim() || "Rejected",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "pending");
      if (updErr) throw new Error(updErr.message);
      return { ok: true as const, status: "rejected" as const };
    }

    // approve — funds already at treasury; admin pays out to destination off-platform
    const { error: updErr } = await admin
      .from("ousd_withdrawals")
      .update({
        status: "completed",
        admin_note: data.admin_note?.trim() || null,
        payout_tx_hash: data.payout_tx_hash?.trim() || null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending");
    if (updErr) throw new Error(updErr.message);

    try {
      await admin
        .from("transactions")
        .update({ status: "confirmed" })
        .eq("wallet_id", row.wallet_id)
        .eq("type", "send")
        .eq("status", "pending")
        .eq("token_symbol", "OUSD")
        .eq("amount", row.amount)
        .ilike("memo", "OUSD withdraw%");
    } catch {
      /* best effort */
    }

    return { ok: true as const, status: "completed" as const };
  });

async function refundWithdrawal(
  admin: any,
  row: {
    id: string;
    wallet_id: string;
    amount: number | string;
    treasury_wallet_id?: string | null;
    destination_address?: string;
  },
  _userId: string,
  reason: string,
) {
  const amount = round8(Number(row.amount));
  const treasuryId = row.treasury_wallet_id;
  if (treasuryId) {
    const { data: t } = await admin
      .from("wallets")
      .select("ousd_balance")
      .eq("id", treasuryId)
      .maybeSingle();
    const tBal = Number(t?.ousd_balance ?? 0);
    if (tBal + 1e-12 < amount) {
      throw new Error("Treasury has insufficient OUSD to refund — contact support");
    }
    await admin
      .from("wallets")
      .update({ ousd_balance: round8(tBal - amount) })
      .eq("id", treasuryId);
  }

  const { data: w } = await admin
    .from("wallets")
    .select("ousd_balance, address")
    .eq("id", row.wallet_id)
    .maybeSingle();
  if (!w) throw new Error("User wallet missing for refund");
  const next = round8(Number(w.ousd_balance ?? 0) + amount);
  await admin.from("wallets").update({ ousd_balance: next }).eq("id", row.wallet_id);

  try {
    await admin.from("transactions").insert({
      wallet_id: row.wallet_id,
      type: "receive",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty: WITHDRAWAL_TREASURY_ADDRESS,
      amount,
      usd_value: amount,
      memo: `Withdrawal refund · ${reason}`,
    });
    if (treasuryId) {
      await admin.from("transactions").insert({
        wallet_id: treasuryId,
        type: "send",
        status: "confirmed",
        token_symbol: "OUSD",
        counterparty: w.address,
        amount,
        usd_value: amount,
        memo: `Withdrawal refund · ${reason}`,
      });
    }
  } catch (e) {
    console.warn("[withdraw] refund ledger failed", e);
  }
}
