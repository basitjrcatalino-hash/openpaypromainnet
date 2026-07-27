import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendSchema = z
  .object({
    to: z.string().trim().min(2).max(120),
    amount: z.number().positive().max(1e15),
    asset: z.enum(["OUSD", "PI", "TOKEN"]),
    tokenId: z.string().uuid().optional().nullable(),
    memo: z.string().max(140).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.asset === "TOKEN" && !val.tokenId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tokenId is required for TOKEN sends",
        path: ["tokenId"],
      });
    }
  });

function isWalletAddress(to: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(to.trim());
}

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

async function trySupabaseAdmin() {
  const { hasSupabaseAdminEnv } = await import("@/integrations/supabase/env.server");
  if (!hasSupabaseAdminEnv()) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  } catch {
    return null;
  }
}

async function resolveRecipientAddress(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  toRaw: string,
): Promise<string> {
  const trimmed = toRaw.trim();
  if (isWalletAddress(trimmed)) return trimmed;

  const { findLocalWalletAddressByHandle } = await import("./recipient-resolve");

  try {
    const local = await findLocalWalletAddressByHandle(supabase, toRaw);
    if (local) return local;
  } catch {
    /* RLS may block cross-user profile reads */
  }

  const admin = await trySupabaseAdmin();
  if (admin) {
    const resolved = await findLocalWalletAddressByHandle(admin, toRaw);
    if (resolved) return resolved;
  }

  // Fall through: treat as raw counterparty (external / OP username string)
  return trimmed.replace(/^@+/, "");
}

export const sendAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { to: toInput, amount, asset, tokenId, memo } = data;
    const amt = round8(amount);

    const toAddress = await resolveRecipientAddress(supabase, toInput);

    const { fetchActiveWallet } = await import("./wallet-utils");
    const wallet = await fetchActiveWallet<{
      id: string;
      address: string;
      ousd_balance?: number | null;
      pi_balance?: number | null;
    }>(supabase, userId);
    if (!wallet) throw new Error("Active wallet not found");
    if (toAddress.toLowerCase() === wallet.address.toLowerCase()) {
      throw new Error("Cannot send to your own address");
    }

    if (asset === "TOKEN") {
      return sendOpenToken({
        supabase,
        admin: await trySupabaseAdmin(),
        wallet,
        toAddress,
        tokenId: tokenId!,
        amount: amt,
        memo: memo ?? null,
      });
    }

    const curO = Number(wallet.ousd_balance ?? 0);
    const curP = Number(wallet.pi_balance ?? 0);
    const cur = asset === "OUSD" ? curO : curP;
    if (cur + 1e-12 < amt) throw new Error(`Insufficient ${asset} balance`);

    const senderPatch =
      asset === "OUSD"
        ? { ousd_balance: round8(curO - amt) }
        : { pi_balance: round8(curP - amt) };
    const { error: updErr } = await supabase
      .from("wallets")
      .update(senderPatch)
      .eq("id", wallet.id);
    if (updErr) throw updErr;

    const usd = asset === "OUSD" ? amt : amt * 32.5;

    let credited = false;
    const admin = await trySupabaseAdmin();
    if (admin && isWalletAddress(toAddress)) {
      try {
        const { data: rcpt } = await admin
          .from("wallets")
          .select("*")
          .eq("address", toAddress)
          .maybeSingle();
        if (rcpt) {
          const rO = Number(rcpt.ousd_balance ?? 0);
          const rP = Number(rcpt.pi_balance ?? 0);
          const rcptPatch =
            asset === "OUSD"
              ? { ousd_balance: round8(rO + amt) }
              : { pi_balance: round8(rP + amt) };
          await admin.from("wallets").update(rcptPatch).eq("id", rcpt.id);
          await admin.from("transactions").insert({
            wallet_id: rcpt.id,
            type: "receive",
            status: "confirmed",
            token_symbol: asset,
            counterparty: wallet.address,
            amount: amt,
            usd_value: usd,
            memo: memo ?? null,
          });
          credited = true;
        }
      } catch (e) {
        console.error("recipient credit failed", e);
      }
    }

    const { error: txErr } = await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      type: "send",
      status: "confirmed",
      token_symbol: asset,
      counterparty: toAddress,
      amount: amt,
      usd_value: usd,
      memo: memo ?? null,
    });
    if (txErr) throw txErr;

    return { ok: true, credited, resolvedTo: toAddress, symbol: asset };
  });

async function sendOpenToken(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
  wallet: { id: string; address: string };
  toAddress: string;
  tokenId: string;
  amount: number;
  memo: string | null;
}) {
  const { supabase, admin, wallet, toAddress, tokenId, amount, memo } = opts;

  if (!isWalletAddress(toAddress)) {
    throw new Error("OpenToken sends require an OpenPay Pro wallet address or @username");
  }
  if (!admin) {
    throw new Error("Token transfers require server admin configuration");
  }

  const { data: token, error: tokErr } = await supabase
    .from("tokens")
    .select("id, symbol, name, price_usd")
    .eq("id", tokenId)
    .maybeSingle();
  if (tokErr) throw new Error(tokErr.message);
  if (!token) throw new Error("Token not found");

  const symbol = String(token.symbol ?? "TOKEN");
  const price = Number(token.price_usd ?? 0);
  const usd = round8(amount * (price > 0 ? price : 0));

  const { data: hold, error: holdErr } = await supabase
    .from("token_holdings")
    .select("id, balance")
    .eq("wallet_id", wallet.id)
    .eq("token_id", tokenId)
    .maybeSingle();
  if (holdErr) throw new Error(holdErr.message);
  const bal = Number(hold?.balance ?? 0);
  if (!hold || bal + 1e-12 < amount) {
    throw new Error(`Insufficient ${symbol} balance`);
  }

  const nextSender = round8(bal - amount);
  const { error: debitErr } = await supabase
    .from("token_holdings")
    .update({ balance: Math.max(0, nextSender), updated_at: new Date().toISOString() })
    .eq("id", hold.id);
  if (debitErr) throw new Error(debitErr.message);

  const { data: rcpt, error: rcptErr } = await admin
    .from("wallets")
    .select("id, address")
    .eq("address", toAddress)
    .maybeSingle();
  if (rcptErr) throw new Error(rcptErr.message);
  if (!rcpt) {
    // Roll back sender debit — recipient must be on-app for token transfers
    await supabase
      .from("token_holdings")
      .update({ balance: bal, updated_at: new Date().toISOString() })
      .eq("id", hold.id);
    throw new Error("Recipient must have an OpenPay Pro wallet to receive tokens");
  }

  const { data: rcptHold } = await admin
    .from("token_holdings")
    .select("id, balance")
    .eq("wallet_id", rcpt.id)
    .eq("token_id", tokenId)
    .maybeSingle();

  if (rcptHold) {
    const { error } = await admin
      .from("token_holdings")
      .update({
        balance: round8(Number(rcptHold.balance) + amount),
        updated_at: new Date().toISOString(),
      })
      .eq("id", rcptHold.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from("token_holdings").insert({
      wallet_id: rcpt.id,
      token_id: tokenId,
      balance: amount,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  await admin.from("transactions").insert({
    wallet_id: rcpt.id,
    type: "receive",
    status: "confirmed",
    token_id: tokenId,
    token_symbol: symbol,
    counterparty: wallet.address,
    amount,
    usd_value: usd,
    memo,
  });

  const { error: txErr } = await supabase.from("transactions").insert({
    wallet_id: wallet.id,
    type: "send",
    status: "confirmed",
    token_id: tokenId,
    token_symbol: symbol,
    counterparty: toAddress,
    amount,
    usd_value: usd,
    memo,
  });
  if (txErr) throw new Error(txErr.message);

  return { ok: true as const, credited: true, resolvedTo: toAddress, symbol };
}

const TopUpSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  method: z.enum(["openpay", "card", "bank"]),
  reference: z.string().max(80).optional().nullable(),
});

export const topUpOUSD = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TopUpSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { amount, method, reference } = data;

    const { fetchActiveWallet } = await import("./wallet-utils");
    const wallet = await fetchActiveWallet<{ id: string; ousd_balance?: number | null }>(
      supabase,
      userId,
    );
    if (!wallet) throw new Error("Active wallet not found");

    const nb = Number(wallet.ousd_balance ?? 0) + amount;
    const { error: uErr } = await supabase
      .from("wallets")
      .update({ ousd_balance: nb })
      .eq("id", wallet.id);
    if (uErr) throw uErr;

    await supabase.from("transactions").insert({
      wallet_id: wallet.id,
      type: "buy",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty: `${method}:${reference ?? "openpay"}`,
      amount,
      usd_value: amount,
      memo: `Top-up via ${method}`,
    });

    return { ok: true, balance: nb };
  });
