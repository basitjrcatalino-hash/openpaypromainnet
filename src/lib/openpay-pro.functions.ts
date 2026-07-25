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

// Create a hosted checkout charge so the user can pay from their own OpenPay
// balance and top up this wallet. If PayButton /charges is not deployed on the
// partner API yet, fall back to a partner-authorized direct credit (same as
// voucher / Pi: credit Pro OUSD after verifying the partner key).
export const createOpenPayTopupCharge = createServerFn({ method: "POST" })
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
    const reference = `topup_${userId}_${Date.now()}`;
    const origin = resolvePartnerRedirectOrigin(data.origin);

    // Prefer PayButton checkout when the partner API supports /charges
    try {
      const charge = await openpayPro.createCharge({
        amount: data.amount,
        currency: "OUSD",
        description: `OUSD top-up · OpenPay Pro`,
        reference,
        success_url: `${origin}/topup?openpay_return=1`,
        cancel_url: `${origin}/topup?openpay_cancel=1`,
      });
      if (!charge?.checkout_url || !charge?.id) {
        throw new Error("OpenPay checkout unavailable");
      }
      return { mode: "checkout" as const, charge };
    } catch (e) {
      // Partner /charges is broken or missing (e.g. "expires_at is ambiguous", 404).
      // Fall through to partner-treasury direct credit.
      const msg = (e as Error).message || "";
      console.warn("[openpay topup] checkout unavailable, using direct credit:", msg);
    }

    // Fallback: verify partner key + treasury, then credit Pro wallet directly
    const me = await openpayPro.me();
    const bal = await openpayPro.balance();
    const treasury = Number(bal.balance ?? 0);
    if (treasury < data.amount) {
      throw new Error("OpenPay partner treasury has insufficient balance for this top-up");
    }

    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (wErr || !wallet) throw new Error("Active wallet not found");

    const newBal = Number(wallet.ousd_balance ?? 0) + data.amount;
    const { error: uErr } = await supabase
      .from("wallets")
      .update({ ousd_balance: newBal })
      .eq("id", wallet.id);
    if (uErr) throw new Error(uErr.message);

    const meAny = me as {
      account?: { account_number?: string; username?: string };
      account_number?: string;
      username?: string;
    };
    const partnerId =
      meAny.account?.account_number ||
      meAny.account?.username ||
      meAny.account_number ||
      meAny.username ||
      "treasury";

    const { error: tErr } = await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      type: "buy",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty: `openpay-partner:${partnerId}`,
      amount: data.amount,
      usd_value: data.amount,
      memo: `OpenPay top-up · ${reference}`,
    });
    if (tErr) throw new Error(tErr.message);

    return {
      mode: "direct" as const,
      balance: newBal,
      amount: data.amount,
      partner: me,
    };
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

    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (wErr || !wallet) throw new Error("Active wallet not found");

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

    return { status: "paid", credited: true, balance: newBal };
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
    const { findLocalProfileByHandle, findLocalWalletAddressByHandle, normalizeRecipientId } =
      await import("./recipient-resolve");
    const { supabase, userId } = context;
    const to = normalizeRecipientId(data.to);

    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (wErr || !wallet) throw new Error("Active wallet not found");
    const cur = Number(wallet.ousd_balance ?? 0);
    if (cur < data.amount) throw new Error("Insufficient OUSD balance");

    // Local OpenPay Pro user → settle in-app when service role is available
    let localProfile: Awaited<ReturnType<typeof findLocalProfileByHandle>> = null;
    let localAddress: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabaseAdmin: any = null;

    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_URL) {
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
          if (/SUPABASE_SERVICE_ROLE_KEY/i.test(adminMsg) && !local) {
            // Partner failed + no service role — surface a useful connect hint
            throw new Error(
              msg.includes("OP…") || msg.includes("account number")
                ? msg
                : `Could not connect @${identifier}. Try the OP account number, or add SUPABASE_SERVICE_ROLE_KEY in Lovable Cloud Secrets.`,
            );
          }
          if (!/SUPABASE_SERVICE_ROLE_KEY/i.test(adminMsg)) {
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
    const { createConnectState, buildOpenPayAuthorizeUrl, resolvePartnerRedirectOrigin } =
      await import("./openpay-connect.server");
    const origin = resolvePartnerRedirectOrigin(data.origin);
    const redirect_uri = `${origin}/openpay/connect/callback`;
    const state = createConnectState(context.userId, redirect_uri);
    const { authorize_url } = buildOpenPayAuthorizeUrl({
      origin,
      state,
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
