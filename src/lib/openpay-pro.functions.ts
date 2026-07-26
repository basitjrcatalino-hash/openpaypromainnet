import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findLocalProfileByHandle, normalizeRecipientId } from "./recipient-resolve";

function isAmbiguousUsernameError(message: string): boolean {
  return /column reference ["']?username["']? is ambiguous/i.test(message);
}

// Public — anyone can look up an OpenPay recipient before sending.
export const resolveOpenPayAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ identifier: z.string().trim().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const identifier = normalizeRecipientId(data.identifier);

    // Prefer local profile first for @handles (no service-role required).
    try {
      const local = await findLocalProfileByHandle(context.supabase as any, identifier);
      if (local) {
        return {
          ok: true as const,
          account: {
            name: local.display_name ?? undefined,
            username: local.username ?? local.pi_username ?? identifier,
          },
          source: "local" as const,
        };
      }
    } catch {
      // continue — may lack permission under RLS
    }

    try {
      const { openpayPro } = await import("./openpay-pro.server");
      const acct = await openpayPro.resolveAccount(identifier);
      return { ok: true as const, account: acct, source: "partner" as const };
    } catch (e) {
      const message = (e as Error).message || "Account not found";
      if (isAmbiguousUsernameError(message)) {
        return {
          ok: false as const,
          error: `Could not find OpenPay user @${identifier}. Try their email or OP account number, or send via OpenPay Pro wallet.`,
        };
      }
      return { ok: false as const, error: message };
    }
  });

export const getOpenPayPartnerInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { openpayPro } = await import("./openpay-pro.server");
    try {
      const me = await openpayPro.me();
      return { ok: true as const, account: me };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

// Create a PayButton charge so the user pays from THEIR OpenPay balance.
// If /charges is broken on OpenPay (expires_at SQL bug), fall back to the
// hosted /pay/@partnerUsername link — same result: user sends OUSD on OpenPay,
// then Pro settles after the partner wallet receives the credit.
export const createOpenPayTopupCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        amount: z.number().positive().max(50_000),
        origin: z.string().url(),
        /** Wallet that should receive the credit — must be the activated one */
        walletId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { openpayPro } = await import("./openpay-pro.server");
    const { resolvePartnerRedirectOrigin } = await import("./openpay-connect.server");
    const { resolveCreditWallet } = await import("./wallet-utils");
    const { supabase, userId } = context;
    const origin = resolvePartnerRedirectOrigin(data.origin);
    const reference = `pro_topup_${userId.replace(/-/g, "").slice(0, 12)}_${Date.now()}`;

    const creditWallet = await resolveCreditWallet<{ id: string; name?: string; address?: string }>(
      supabase,
      userId,
      data.walletId,
    );
    if (!creditWallet) throw new Error("Active wallet not found — switch to a wallet and retry");

    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("notifications")
      .eq("user_id", userId)
      .maybeSingle();
    const link = readOpenPayLink(prefs?.notifications);
    if (!link.linked) {
      throw new Error("Connect your OpenPay account in Settings before topping up with OpenPay Balance");
    }

    const pendingBase = {
      reference,
      amount: data.amount,
      wallet_id: creditWallet.id,
      created_at: new Date().toISOString(),
      payer_account: link.account_number || link.identifier,
      payer_username: link.username,
    };

    // 1) Prefer official PayButton checkout
    try {
      const charge = await openpayPro.createCharge({
        amount: data.amount,
        currency: "OUSD",
        description: `OUSD top-up · OpenPay Pro`,
        reference,
        success_url: `${origin}/topup?openpay_return=1`,
        cancel_url: `${origin}/topup?openpay_cancel=1`,
      });
      if (!charge?.id) throw new Error("OpenPay checkout unavailable");
      charge.checkout_url = `https://openpy.space/paybutton/${encodeURIComponent(charge.id)}`;

      const notifications: Record<string, unknown> = {
        ...((prefs?.notifications as Record<string, unknown>) ?? {}),
        openpay_pending_topup: {
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

      return { mode: "checkout" as const, charge, reference, wallet_id: creditWallet.id };
    } catch (e) {
      const msg = (e as Error).message || "";
      console.warn("[openpay topup] PayButton /charges failed, using /pay link:", msg);
    }

    // 2) Fallback: user pays partner tag from their OpenPay balance via /pay/@username
    const me = await openpayPro.me();
    const partnerUsername = me.username;
    const partnerAccount = me.account_number;
    if (!partnerUsername) {
      throw new Error("Partner OpenPay username unavailable — cannot start payment");
    }

    // Paying yourself is blocked on OpenPay /pay/:username
    const payer = (link.account_number || link.username || link.identifier || "").replace(/^@+/, "");
    if (
      payer &&
      (payer.toLowerCase() === partnerUsername.toLowerCase() ||
        (partnerAccount && payer.toUpperCase() === partnerAccount.toUpperCase()))
    ) {
      throw new Error(
        "This OpenPay account owns the partner app, so it cannot pay itself. Connect a different OpenPay user, or use Pi Network.",
      );
    }

    // Optionally warn if OAuth balance is too low (non-blocking if token missing)
    if (link.access_token) {
      try {
        const { fetchOAuthUserBalance } = await import("./openpay-connect.server");
        const bal = await fetchOAuthUserBalance(link.access_token);
        if (Number(bal.balance) < data.amount) {
          throw new Error(
            `Insufficient OpenPay balance (${Number(bal.balance).toFixed(2)} OUSD). Top up OpenPay first, then retry.`,
          );
        }
      } catch (e) {
        if (/Insufficient OpenPay balance/i.test((e as Error).message)) throw e;
        /* ignore balance check failures */
      }
    }

    const pay_url =
      `https://openpy.space/pay/${encodeURIComponent(partnerUsername)}` +
      `?amount=${encodeURIComponent(data.amount.toFixed(2))}` +
      `&currency=OUSD` +
      `&note=${encodeURIComponent(reference)}` +
      `&success_url=${encodeURIComponent(`${origin}/topup`)}` +
      `&cancel_url=${encodeURIComponent(`${origin}/topup`)}`;

    // Persist pending so settle can credit the same activated wallet
    const notifications: Record<string, unknown> = {
      ...((prefs?.notifications as Record<string, unknown>) ?? {}),
      openpay_pending_topup: {
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
      wallet_id: creditWallet.id,
    };
  });

/** After user returns from /pay/@partner — match incoming OpenPay credit and credit Pro OUSD. */
export const settleOpenPayPayLinkTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        reference: z.string().min(8).max(120).optional(),
        txId: z.string().min(4).max(200).optional(),
        /** When true, allow settle after OpenPay thank-you redirect if pending is fresh */
        fromReturn: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { openpayPro } = await import("./openpay-pro.server");
    const { supabase, userId } = context;

    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("notifications")
      .eq("user_id", userId)
      .maybeSingle();
    const n = (prefs?.notifications ?? {}) as Record<string, unknown>;
    const pending = n.openpay_pending_topup as
      | {
          reference?: string;
          amount?: number;
          wallet_id?: string;
          payer_account?: string;
          payer_username?: string;
          created_at?: string;
        }
      | undefined;

    const reference = data.reference || pending?.reference;
    if (!reference || !pending?.amount) {
      throw new Error("No pending OpenPay top-up to settle — start Top Up again");
    }
    const amount = Number(pending.amount);
    const createdAt = pending.created_at ? Date.parse(pending.created_at) : 0;
    const fresh = createdAt > 0 && Date.now() - createdAt < 2 * 60 * 60 * 1000; // 2h

    let matchedId = data.txId || "";

    try {
      const transfers = await openpayPro.listTransfers({ limit: 50 });
      const payerKeys = [pending.payer_account, pending.payer_username]
        .filter(Boolean)
        .map((s) => String(s).replace(/^@+/, "").toLowerCase());

      const match = transfers.find((t) => {
        if (Math.abs(Number(t.amount) - amount) > 0.009) return false;
        const note = String(t.note || "");
        if (!note.includes(reference)) return false;
        const dir = String(t.direction || "").toLowerCase();
        if (dir && dir !== "credit") return false;
        if (payerKeys.length) {
          const cp = String(t.counterparty_identifier || "").replace(/^@+/, "").toLowerCase();
          if (cp && !payerKeys.some((k) => k === cp)) return false;
        }
        return String(t.status || "completed").toLowerCase() !== "failed";
      });

      const match2 =
        match ||
        transfers.find((t) => {
          if (Math.abs(Number(t.amount) - amount) > 0.009) return false;
          return String(t.note || "").includes(reference);
        });

      if (match2?.id) matchedId = String(match2.id);
      else if (match2?.transaction_id) matchedId = String(match2.transaction_id);
    } catch (e) {
      console.warn("[openpay topup] listTransfers failed:", (e as Error).message);
    }

    // OpenPay P2P may not appear on partner /transfers — honor fresh thank-you return
    if (!matchedId && !(data.fromReturn && fresh)) {
      return {
        credited: false as const,
        status: "pending" as const,
        message: "Payment not seen yet — finish paying on OpenPay, then tap Confirm payment",
      };
    }

    const counterparty = `openpay-paylink:${matchedId || data.txId || reference}`;
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("counterparty", counterparty)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return { credited: true as const, status: "paid" as const, already: true };
    }

    // Also block double-credit on same reference
    const { data: existingRef } = await supabase
      .from("transactions")
      .select("id")
      .eq("memo", `OpenPay balance top-up · ${reference}`)
      .limit(1)
      .maybeSingle();
    if (existingRef) {
      return { credited: true as const, status: "paid" as const, already: true };
    }

    const { resolveCreditWallet } = await import("./wallet-utils");
    const wallet = await resolveCreditWallet<{ id: string; ousd_balance?: number | null }>(
      supabase,
      userId,
      pending.wallet_id,
    );
    if (!wallet) throw new Error("Active wallet not found");

    const newBal = Number(wallet.ousd_balance ?? 0) + amount;
    const { error: uErr } = await supabase
      .from("wallets")
      .update({ ousd_balance: newBal })
      .eq("id", wallet.id);
    if (uErr) throw new Error(uErr.message);

    await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      type: "buy",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty,
      amount,
      usd_value: amount,
      memo: `OpenPay balance top-up · ${reference}`,
    });

    // Clear pending
    const next = { ...n };
    delete next.openpay_pending_topup;
    await supabase.from("user_preferences").upsert({
      user_id: userId,
      notifications: next as never,
      updated_at: new Date().toISOString(),
    });

    return { credited: true as const, status: "paid" as const, balance: newBal, wallet_id: wallet.id };
  });

// Poll after the buyer returns from OpenPay hosted checkout. If paid and not
// yet credited, credit the wallet exactly once.
export const settleOpenPayCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().min(4).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { openpayPro } = await import("./openpay-pro.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;

    const charge = await openpayPro.getCharge(data.chargeId);
    if (charge.status !== "paid") {
      return { status: charge.status, credited: false };
    }

    // Idempotency: use counterparty tag to guarantee single credit.
    const counterparty = `openpay:${charge.id}`;
    const { data: existing } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("counterparty", counterparty)
      .limit(1)
      .maybeSingle();
    if (existing) return { status: "paid", credited: true, already: true };

    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("notifications")
      .eq("user_id", userId)
      .maybeSingle();
    const pending = (prefs?.notifications as Record<string, unknown> | null)?.openpay_pending_topup as
      | { wallet_id?: string; charge_id?: string }
      | undefined;

    const { resolveCreditWallet } = await import("./wallet-utils");
    const wallet = await resolveCreditWallet<{ id: string; ousd_balance?: number | null }>(
      supabase,
      userId,
      pending?.wallet_id,
    );
    if (!wallet) throw new Error("Active wallet not found");

    const amount = Number(charge.amount);
    const newBal = Number(wallet.ousd_balance ?? 0) + amount;
    const { error: uErr } = await supabase
      .from("wallets")
      .update({ ousd_balance: newBal })
      .eq("id", wallet.id);
    if (uErr) throw new Error(uErr.message);

    await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      type: "buy",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty,
      amount,
      usd_value: amount,
      memo: `OpenPay checkout ${charge.id}`,
    });

    if (prefs?.notifications) {
      const next = { ...((prefs.notifications as Record<string, unknown>) ?? {}) };
      delete next.openpay_pending_topup;
      await supabase.from("user_preferences").upsert({
        user_id: userId,
        notifications: next as never,
        updated_at: new Date().toISOString(),
      });
    }

    return { status: "paid", credited: true, balance: newBal, wallet_id: wallet.id };
  });

// Push OpenPay balance from the partner wallet to any OpenPay user
// (@username, OP account number, or email). Debits this wallet's OUSD
// balance in the same transaction so the ledger stays consistent.
// Local @usernames are settled in-app to avoid the partner API's
// ambiguous "username" SQL bug.
export const sendViaOpenPay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        to: z.string().trim().min(2).max(120),
        amount: z.number().positive().max(1_000_000),
        note: z.string().max(140).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { openpayPro } = await import("./openpay-pro.server");
    const { resolveCreditWallet } = await import("./wallet-utils");
    const { findLocalProfileByHandle, findLocalWalletAddressByHandle, normalizeRecipientId } =
      await import("./recipient-resolve");
    const { supabase, userId } = context;
    const to = normalizeRecipientId(data.to);

    const wallet = await resolveCreditWallet<{
      id: string;
      address?: string;
      ousd_balance?: number | null;
    }>(supabase, userId);
    if (!wallet) throw new Error("Active wallet not found");
    const cur = Number(wallet.ousd_balance ?? 0);
    if (cur < data.amount) throw new Error("Insufficient OUSD balance");

    // Local OpenPay Pro user → settle in-app when service role is available
    let localProfile: Awaited<ReturnType<typeof findLocalProfileByHandle>> = null;
    let localAddress: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabaseAdmin: any = null;

    const { hasSupabaseAdminEnv } = await import("@/integrations/supabase/env.server");
    if (hasSupabaseAdminEnv()) {
      try {
        const mod = await import("@/integrations/supabase/client.server");
        supabaseAdmin = mod.supabaseAdmin;
        localProfile = await findLocalProfileByHandle(supabaseAdmin, to);
        localAddress = localProfile
          ? await findLocalWalletAddressByHandle(supabaseAdmin, to)
          : null;
      } catch {
        localProfile = null;
        localAddress = null;
        supabaseAdmin = null;
      }
    }

    if (localProfile && localAddress && supabaseAdmin) {
      if (localAddress === wallet.address) {
        throw new Error("Cannot send to your own address");
      }

      const newBal = cur - data.amount;
      const { error: debitErr } = await supabase
        .from("wallets")
        .update({ ousd_balance: newBal })
        .eq("id", wallet.id);
      if (debitErr) throw new Error(debitErr.message);

      const { data: rcpt } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .eq("address", localAddress)
        .maybeSingle();
      if (rcpt) {
        await supabaseAdmin
          .from("wallets")
          .update({ ousd_balance: Number(rcpt.ousd_balance ?? 0) + data.amount })
          .eq("id", rcpt.id);
        await supabaseAdmin.from("transactions").insert({
          wallet_id: rcpt.id,
          type: "receive",
          status: "confirmed",
          token_symbol: "OUSD",
          counterparty: wallet.address,
          amount: data.amount,
          usd_value: data.amount,
          memo: data.note ?? `From @${localProfile.username ?? to}`,
        });
      }

      await supabase.from("transactions").insert({
        wallet_id: wallet.id,
        type: "send",
        status: "confirmed",
        token_symbol: "OUSD",
        counterparty: localAddress,
        amount: data.amount,
        usd_value: data.amount,
        memo: data.note ?? `OpenPay to @${localProfile.username ?? to}`,
      });

      return {
        ok: true,
        balance: newBal,
        transfer: { to: localAddress, amount: data.amount, status: "local" },
      };
    }

    const idem = `${wallet.id}-${Date.now()}`;
    let result;
    try {
      result = await openpayPro.sendTransfer(
        { to, amount: data.amount, note: data.note ?? undefined },
        idem,
      );
    } catch (e) {
      const message = (e as Error).message || "Transfer failed";
      if (isAmbiguousUsernameError(message)) {
        throw new Error(
          `Could not send to @${to} via OpenPay. Try their email or OP account number, or use OpenPay Pro wallet.`,
        );
      }
      throw new Error(message);
    }

    const newBal = cur - data.amount;
    await supabase.from("wallets").update({ ousd_balance: newBal }).eq("id", wallet.id);

    await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      type: "send",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty: `openpay:${to}`,
      amount: data.amount,
      usd_value: data.amount,
      memo: data.note ?? `OpenPay transfer`,
    });

    return { ok: true, balance: newBal, transfer: result };
  });

export type OpenPayLinkRecord = {
  linked: boolean;
  openpayUserId?: string;
  username?: string;
  account_number?: string;
  name?: string;
  email?: string;
  identifier?: string;
  source?: "partner" | "local";
  linkedAt?: string;
  /** OAuth user access token (opa_live_…) — server-stored in prefs, never expose to browser UI */
  access_token?: string;
  token_expires_at?: string;
};

function readOpenPayLink(notifications: unknown): OpenPayLinkRecord {
  const n = (notifications ?? {}) as Record<string, unknown>;
  const link = n.openpay as OpenPayLinkRecord | undefined;
  if (link?.linked) return link;
  return { linked: false };
}

async function writeOpenPayLink(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  link: OpenPayLinkRecord | null,
) {
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("notifications")
    .eq("user_id", userId)
    .maybeSingle();
  const notifications: Record<string, unknown> = {
    ...((prefs?.notifications as Record<string, unknown>) ?? {}),
  };
  if (link) notifications.openpay = link;
  else delete notifications.openpay;

  const { error } = await supabase.from("user_preferences").upsert({
    user_id: userId,
    notifications,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export const getOpenPayLinkStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("notifications")
      .eq("user_id", userId)
      .maybeSingle();
    const link = readOpenPayLink(prefs?.notifications);
    // Persist linked status across sessions; expired tokens do not auto-unlink
    const { access_token: _t, ...safe } = link;
    return safe as OpenPayLinkRecord;
  });

export const linkOpenPayAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ identifier: z.string().trim().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const identifier = normalizeRecipientId(data.identifier);

    let link: OpenPayLinkRecord | null = null;

    // 1) Partner OpenPay resolve — no service-role key required
    try {
      const { openpayPro } = await import("./openpay-pro.server");
      const acct = await openpayPro.resolveAccount(identifier);
      link = {
        linked: true,
        openpayUserId: acct.account_number || acct.username || acct.email || `op_${identifier}`,
        username: acct.username,
        account_number: acct.account_number,
        name: acct.name,
        email: acct.email,
        identifier: acct.account_number || identifier,
        source: "partner",
        linkedAt: new Date().toISOString(),
      };
    } catch (e) {
      const msg = (e as Error).message || "";

      // 2) Local OpenPay Pro profile fallback (user-scoped first, then admin if available)
      let local: Awaited<ReturnType<typeof findLocalProfileByHandle>> = null;
      try {
        local = await findLocalProfileByHandle(supabase as any, identifier);
      } catch {
        /* ignore RLS miss */
      }
      if (!local) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          local = await findLocalProfileByHandle(supabaseAdmin, identifier);
        } catch (adminErr) {
          const adminMsg = (adminErr as Error).message || "";
          if (/SUPABASE_(SERVICE_ROLE|SECRET)_KEY/i.test(adminMsg) && !local) {
            // Partner failed + no service role — surface a useful connect hint
            throw new Error(
              msg.includes("OP…") || msg.includes("account number")
                ? msg
                : `Could not connect @${identifier}. Try the OP account number, or add SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY in Vercel env vars.`,
            );
          }
          if (!/SUPABASE_(SERVICE_ROLE|SECRET)_KEY/i.test(adminMsg)) {
            // keep going with partner error below
          }
        }
      }

      if (local) {
        link = {
          linked: true,
          openpayUserId: local.id,
          username: local.username ?? local.pi_username ?? identifier,
          name: local.display_name ?? undefined,
          identifier,
          source: "local",
          linkedAt: new Date().toISOString(),
        };
      } else if (/not configured/i.test(msg)) {
        throw new Error(
          "OpenPay partner API key is not configured. Add OPENPAY_PARTNER_API_KEY, or link a local @username.",
        );
      } else if (isAmbiguousUsernameError(msg) || /username lookup is temporarily unavailable/i.test(msg)) {
        throw new Error(
          `Could not resolve @${identifier} on OpenPay. Try email or OP account number.`,
        );
      } else {
        throw new Error(msg || "OpenPay account not found");
      }
    }

    await writeOpenPayLink(supabase, userId, link);
    return link;
  });

export const unlinkOpenPayAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Only path that clears the OpenPay session — connect status otherwise persists
    await writeOpenPayLink(supabase, userId, null);
    return { linked: false as const };
  });

/** Start OAuth 2.0 Connect with OpenPay — redirects to openpy.space/connect */
export const startOpenPayConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ origin: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // If already linked, still allow authorize so the user can refresh tokens —
    // but never clear the existing link here. Unlink is disconnect-only.
    const { createConnectState, buildOpenPayAuthorizeUrl, resolvePartnerRedirectOrigin, OPENPAY_CONNECT_CALLBACK_PATH } =
      await import("./openpay-connect.server");
    const origin = resolvePartnerRedirectOrigin(data.origin);
    const redirect_uri = `${origin}${OPENPAY_CONNECT_CALLBACK_PATH}`;
    const state = createConnectState(context.userId, redirect_uri);
    const { authorize_url } = buildOpenPayAuthorizeUrl({
      origin,
      state,
      callbackPath: OPENPAY_CONNECT_CALLBACK_PATH,
      scope: "profile balance",
    });
    return { authorize_url, state, redirect_uri, expires_in: 600 };
  });

/** Finish OAuth: exchange opc_… code → opa_live_… token → GET /user/me */
export const completeOpenPayConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().min(8).max(4000),
        state: z.string().min(10).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const {
      verifyConnectState,
      exchangeOAuthCode,
      fetchOAuthUserMe,
    } = await import("./openpay-connect.server");

    const st = verifyConnectState(data.state);
    if (st.uid !== context.userId) {
      throw new Error("Connect session does not belong to this user");
    }

    const token = await exchangeOAuthCode({
      code: data.code,
      redirect_uri: st.redirect_uri,
    });

    const profile = await fetchOAuthUserMe(token.access_token);
    const expiresAt =
      typeof token.expires_in === "number"
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : undefined;

    const link: OpenPayLinkRecord = {
      linked: true,
      openpayUserId:
        profile.account_number ||
        profile.username ||
        profile.user_id ||
        token.user_id ||
        `op_${st.uid}`,
      username: profile.username,
      account_number: profile.account_number,
      name: profile.full_name,
      email: profile.email,
      identifier: profile.account_number || profile.username || profile.user_id,
      source: "partner",
      linkedAt: new Date().toISOString(),
      access_token: token.access_token,
      token_expires_at: expiresAt,
    };
    await writeOpenPayLink(context.supabase, context.userId, link);

    // Don't return access_token to the client
    const { access_token: _t, ...safe } = link;
    return safe as OpenPayLinkRecord;
  });

/**
 * Dev/partner helper: connect the OpenPay account that owns the partner API key
 * after the user confirms in-app (no OpenPay redirect). Useful when OAuth page
 * is not deployed yet.
 */
export const connectPartnerOwnerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { openpayPro } = await import("./openpay-pro.server");
    const me = await openpayPro.me();
    let balance: number | undefined;
    try {
      const bal = await openpayPro.balance();
      balance = bal.balance;
    } catch {
      /* ignore */
    }
    void balance;
    if (!me.account_number && !me.username) {
      throw new Error("Partner OpenPay account could not be loaded");
    }
    const link: OpenPayLinkRecord = {
      linked: true,
      openpayUserId: me.account_number || me.username,
      username: me.username,
      account_number: me.account_number,
      name: me.name,
      email: me.email,
      identifier: me.account_number || me.username,
      source: "partner",
      linkedAt: new Date().toISOString(),
    };
    await writeOpenPayLink(context.supabase, context.userId, link);
    return link;
  });

export const syncOpenPayOUSD = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ walletId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("notifications")
      .eq("user_id", userId)
      .maybeSingle();
    const link = readOpenPayLink(prefs?.notifications);
    if (!link.linked || !link.identifier) {
      throw new Error("Connect OpenPay before syncing");
    }

    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select("*")
      .eq("id", data.walletId)
      .eq("user_id", userId)
      .maybeSingle();
    if (wErr || !wallet) throw new Error("Wallet not found");

    let partnerBalance = Number(wallet.ousd_balance ?? 0);

    if (link.source === "partner") {
      try {
        // Prefer OAuth user token (/user/balance) when Connect completed via OAuth 2.0
        if (link.access_token) {
          const { fetchOAuthUserBalance, fetchOAuthUserMe } = await import(
            "./openpay-connect.server"
          );
          try {
            const bal = await fetchOAuthUserBalance(link.access_token);
            partnerBalance = Number(bal.balance);
          } catch {
            const me = await fetchOAuthUserMe(link.access_token);
            if (typeof me.balance === "number") partnerBalance = Number(me.balance);
            else throw new Error("Could not read OpenPay balance");
          }
        } else {
          const { openpayPro } = await import("./openpay-pro.server");
          const acct = await openpayPro.resolveAccount(link.identifier!);
          if (typeof acct.balance === "number") {
            partnerBalance = Number(acct.balance);
          } else {
            const bal = await openpayPro.balance();
            partnerBalance = Number(bal.balance ?? partnerBalance);
          }
        }
      } catch (e) {
        throw new Error((e as Error).message || "Failed to sync OpenPay balance");
      }
    } else {
      // Local link — balance already lives on this wallet
      return {
        balance: partnerBalance,
        synced: false,
        message: "Local OpenPay Pro account is already in sync",
      };
    }

    const cur = Number(wallet.ousd_balance ?? 0);
    const delta = partnerBalance - cur;
    if (Math.abs(delta) < 1e-9) {
      return { balance: cur, synced: true, message: "Already up to date" };
    }

    const { error: uErr } = await supabase
      .from("wallets")
      .update({ ousd_balance: partnerBalance })
      .eq("id", wallet.id);
    if (uErr) throw new Error(uErr.message);

    await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      type: delta > 0 ? "buy" : "send",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty: `openpay-sync:${link.openpayUserId ?? link.identifier}`,
      amount: Math.abs(delta),
      usd_value: Math.abs(delta),
      memo: "OpenPay balance sync",
    });

    return { balance: partnerBalance, synced: true, delta };
  });

/**
 * Build an OpenPay → Pro receive link.
 * OpenPay user pays partner tag; note routes credit to this Pro user.
 */
export const createOpenPayReceiveLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        amount: z.number().positive().max(50_000).optional(),
        origin: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { openpayPro } = await import("./openpay-pro.server");
    const { resolvePartnerRedirectOrigin } = await import("./openpay-connect.server");
    const { buildInboundNote } = await import("./openpay-inbound.server");
    const { supabase, userId } = context;
    const origin = resolvePartnerRedirectOrigin(data.origin);

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", userId)
      .maybeSingle();

    const { data: wallet } = await supabase
      .from("wallets")
      .select("address")
      .eq("user_id", userId)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Prefer Pro wallet address for OpenPay Send / inbound routing
    const handle = (
      wallet?.address ||
      profile?.username ||
      profile?.display_name ||
      `uid_${userId}`
    ).replace(/^@+/, "");
    const note = buildInboundNote(handle);
    const me = await openpayPro.me();
    const partnerUsername = me.username;
    if (!partnerUsername) {
      throw new Error("Partner OpenPay username unavailable");
    }

    const successParams = new URLSearchParams({ openpay_in: "1" });
    if (typeof data.amount === "number") {
      successParams.set("amount", data.amount.toFixed(2));
    }
    const params = new URLSearchParams({
      currency: "OUSD",
      note,
      success_url: `${origin}/receive?${successParams.toString()}`,
      cancel_url: `${origin}/receive?openpay_cancel=1`,
    });
    if (typeof data.amount === "number") {
      params.set("amount", data.amount.toFixed(2));
    }

    const pay_url = `https://openpy.space/pay/${encodeURIComponent(partnerUsername)}?${params.toString()}`;

    // Store pending inbound for settle-on-return
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("notifications")
      .eq("user_id", userId)
      .maybeSingle();
    const notifications: Record<string, unknown> = {
      ...((prefs?.notifications as Record<string, unknown>) ?? {}),
      openpay_pending_inbound: {
        note,
        handle,
        amount: data.amount ?? null,
        created_at: new Date().toISOString(),
        partner_username: partnerUsername,
      },
    };
    await supabase.from("user_preferences").upsert({
      user_id: userId,
      notifications: notifications as never,
      updated_at: new Date().toISOString(),
    });

    return {
      pay_url,
      note,
      handle,
      address: wallet?.address ?? null,
      username: profile?.username ?? null,
      partner_username: partnerUsername,
      amount: data.amount ?? null,
      inbound_api: `${origin}/api/public/openpay/inbound`,
    };
  });

/** After OpenPay thank-you return on /receive — credit this Pro user from pending note. */
export const settleOpenPayInboundReceive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        openpay_tx: z.string().min(4).max(200).optional(),
        note: z.string().min(8).max(200).optional(),
        amount: z.number().positive().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("notifications")
      .eq("user_id", userId)
      .maybeSingle();
    const n = (prefs?.notifications ?? {}) as Record<string, unknown>;
    const pending = n.openpay_pending_inbound as
      | { note?: string; handle?: string; amount?: number | null; created_at?: string }
      | undefined;

    const note = data.note || pending?.note;
    if (!note) throw new Error("No pending OpenPay inbound — create a receive link first");

    const { parseInboundNote, creditProUserFromOpenPay } = await import(
      "./openpay-inbound.server"
    );
    const parsed = parseInboundNote(note);
    if (!parsed) throw new Error("Invalid inbound note");

    const amount = Number(data.amount ?? pending?.amount ?? 0);
    if (!(amount > 0)) {
      throw new Error("Amount required to settle inbound transfer");
    }

    const txId =
      data.openpay_tx ||
      `ret_${userId.slice(0, 8)}_${parsed.ref}_${Math.round(amount * 100)}`;

    let admin;
    try {
      const mod = await import("@/integrations/supabase/client.server");
      admin = mod.supabaseAdmin;
    } catch {
      throw new Error("Server admin not configured (SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY)");
    }

    const result = await creditProUserFromOpenPay({
      admin,
      toHandle: parsed.handle.startsWith("uid_") ? parsed.handle : parsed.handle,
      amount,
      openpayTxId: txId,
      note,
    });

    // Ensure only the logged-in user is credited for return-settle
    if (result.userId && result.userId !== userId) {
      throw new Error("Inbound note does not belong to this account");
    }

    const next = { ...n };
    delete next.openpay_pending_inbound;
    await supabase.from("user_preferences").upsert({
      user_id: userId,
      notifications: next as never,
      updated_at: new Date().toISOString(),
    });

    return result;
  });

/**
 * Reconcile real OpenPay inbound payments for the signed-in Pro user.
 * Reads the partner account's credit transfers, matches `pro_xfer:` notes that
 * belong to this user, and credits the Pro wallet idempotently (by transfer id).
 * This is the reliable path when the payer is a different person than the
 * receiver (redirect-based settle never runs for them).
 */
export const claimOpenPayInbound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ note: z.string().min(8).max(200).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { openpayPro } = await import("./openpay-pro.server");
    const { parseInboundNote, creditProUserFromOpenPay } = await import(
      "./openpay-inbound.server"
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, pi_username")
      .eq("id", userId)
      .maybeSingle();
    const { data: wallets } = await supabase
      .from("wallets")
      .select("address")
      .eq("user_id", userId);

    const mine = new Set<string>();
    for (const w of wallets ?? []) if (w?.address) mine.add(String(w.address).toLowerCase());
    for (const v of [profile?.username, profile?.display_name, (profile as any)?.pi_username]) {
      if (v) mine.add(String(v).replace(/^@+/, "").toLowerCase());
    }
    mine.add(`uid_${userId}`.toLowerCase());
    mine.add(userId.toLowerCase());

    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("notifications")
      .eq("user_id", userId)
      .maybeSingle();
    const n = (prefs?.notifications ?? {}) as Record<string, unknown>;
    const pending = n.openpay_pending_inbound as { note?: string } | undefined;
    const wantedNote = (data.note || pending?.note || "").trim().toLowerCase();

    let rows: Awaited<ReturnType<typeof openpayPro.listTransfers>> = [];
    try {
      rows = await openpayPro.listTransfers({ limit: 100, direction: "credit" });
    } catch {
      rows = await openpayPro.listTransfers({ limit: 100 });
    }

    let admin;
    try {
      admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    } catch {
      throw new Error("Server admin not configured");
    }

    let creditedTotal = 0;
    let creditedCount = 0;
    let alreadyCount = 0;
    let matched = 0;
    const errors: string[] = [];

    for (const t of rows) {
      const note = (t.note || "").trim();
      if (!note) continue;
      if (t.direction && String(t.direction).toLowerCase() === "debit") continue;
      const parsed = parseInboundNote(note);
      if (!parsed) continue;
      const handle = parsed.handle.replace(/^@+/, "").toLowerCase();
      const isMine = mine.has(handle) || (wantedNote && note.toLowerCase() === wantedNote);
      if (!isMine) continue;
      const amount = Number(t.amount);
      if (!(amount > 0)) continue;
      matched += 1;
      const txId = String(t.transaction_id || t.id || `${parsed.ref}_${Math.round(amount * 100)}`);
      try {
        const r = await creditProUserFromOpenPay({
          admin,
          toHandle: parsed.handle,
          amount,
          openpayTxId: txId,
          note,
          fromLabel: t.counterparty_identifier,
        });
        if (r.userId && r.userId !== userId) continue;
        if (r.already) alreadyCount += 1;
        else {
          creditedCount += 1;
          creditedTotal += amount;
        }
      } catch (e) {
        errors.push((e as Error).message);
      }
    }

    if (creditedCount > 0) {
      const next = { ...n };
      delete next.openpay_pending_inbound;
      await supabase.from("user_preferences").upsert({
        user_id: userId,
        notifications: next as never,
        updated_at: new Date().toISOString(),
      });
    }

    return {
      scanned: rows.length,
      matched,
      credited: creditedCount,
      already: alreadyCount,
      amount: creditedTotal,
      errors: errors.slice(0, 3),
    };
  });
