import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fetchMajorUsdPrices,
  majorBalancePatch,
  majorIdFromAssetCode,
  readMajorBalance,
  walletMajorSelect,
  type LedgerMajorId,
} from "@/lib/ledger-majors";

const SendSchema = z
  .object({
    to: z.string().trim().min(2).max(120),
    amount: z.number().positive().max(1e15),
    asset: z.enum([
      "OUSD",
      "PI",
      "BTC",
      "ETH",
      "SOL",
      "USDC",
      "USDT",
      "PYUSD",
      "USDG",
      "USD1",
      "CASH",
      "EURC",
      "TOKEN",
    ]),
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
function round12(n: number) {
  return Math.round(n * 1e12) / 1e12;
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

  return trimmed.replace(/^@+/, "");
}

const WALLET_SELECT = walletMajorSelect("id, address, ousd_balance");

export const sendAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { to: toInput, amount, asset, tokenId, memo } = data;
    const amt = asset === "OUSD" || asset === "TOKEN" ? round8(amount) : round12(amount);

    const toAddress = await resolveRecipientAddress(supabase, toInput);

    const { fetchActiveWallet } = await import("./wallet-utils");
    const wallet = await fetchActiveWallet<Record<string, unknown> & { id: string; address: string }>(
      supabase,
      userId,
      WALLET_SELECT,
    );
    if (!wallet) throw new Error("Active wallet not found");
    if (toAddress.toLowerCase() === String(wallet.address).toLowerCase()) {
      throw new Error("Cannot send to your own address");
    }

    if (asset === "TOKEN") {
      return sendOpenToken({
        supabase,
        admin: await trySupabaseAdmin(),
        wallet: { id: wallet.id, address: String(wallet.address) },
        toAddress,
        tokenId: tokenId!,
        amount: amt,
        memo: memo ?? null,
      });
    }

    if (asset === "OUSD") {
      return sendLedgerNative({
        supabase,
        admin: await trySupabaseAdmin(),
        wallet,
        toAddress,
        asset: "OUSD",
        major: null,
        amount: amt,
        memo: memo ?? null,
        userId,
      });
    }

    const major = majorIdFromAssetCode(asset);
    if (!major) throw new Error("Unsupported asset");
    return sendLedgerNative({
      supabase,
      admin: await trySupabaseAdmin(),
      wallet,
      toAddress,
      asset,
      major,
      amount: amt,
      memo: memo ?? null,
      userId,
    });
  });

async function sendLedgerNative(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
  wallet: Record<string, unknown> & { id: string; address: string };
  toAddress: string;
  asset: string;
  major: LedgerMajorId | null;
  amount: number;
  memo: string | null;
  userId: string;
}) {
  const { supabase, admin, wallet, toAddress, asset, major, amount, memo, userId } = opts;
  const cur = major ? readMajorBalance(wallet, major) : Number(wallet.ousd_balance ?? 0);
  if (cur + 1e-12 < amount) throw new Error(`Insufficient ${asset} balance`);

  const next = major ? round12(cur - amount) : round8(cur - amount);
  const senderPatch = major ? majorBalancePatch(major, next) : { ousd_balance: next };
  const { error: updErr } = await supabase
    .from("wallets")
    .update(senderPatch)
    .eq("id", wallet.id)
    .eq("user_id", userId);
  if (updErr) throw updErr;

  let usd = amount;
  if (major) {
    const prices = await fetchMajorUsdPrices([major]);
    usd = round8(amount * (prices[major] || 0));
  }

  let credited = false;
  if (admin && isWalletAddress(toAddress)) {
    try {
      const { data: rcpt } = await admin
        .from("wallets")
        .select(WALLET_SELECT)
        .eq("address", toAddress)
        .maybeSingle();
      if (rcpt) {
        const rCur = major
          ? readMajorBalance(rcpt as Record<string, unknown>, major)
          : Number(rcpt.ousd_balance ?? 0);
        const rNext = major ? round12(rCur + amount) : round8(rCur + amount);
        const rcptPatch = major ? majorBalancePatch(major, rNext) : { ousd_balance: rNext };
        await admin.from("wallets").update(rcptPatch).eq("id", rcpt.id);
        const { data: rx } = await admin
          .from("transactions")
          .insert({
            wallet_id: rcpt.id,
            type: "receive",
            status: "confirmed",
            token_symbol: asset,
            counterparty: wallet.address,
            amount,
            usd_value: usd,
            memo,
          })
          .select("id, type, token_symbol, amount, memo, counterparty, status, created_at, wallet_id")
          .single();
        try {
          const { notifyWalletTransaction } = await import("./tx-alerts.server");
          await notifyWalletTransaction(admin as never, rcpt.id, rx ?? {
            type: "receive",
            token_symbol: asset,
            amount,
            memo,
            counterparty: wallet.address,
            status: "confirmed",
            wallet_id: rcpt.id,
          });
        } catch (e) {
          console.warn("[transfer] receive alert failed", e);
        }
        credited = true;
      }
    } catch (e) {
      console.error("recipient credit failed", e);
    }
  }

  const { data: sendTx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      wallet_id: wallet.id,
      type: "send",
      status: "confirmed",
      token_symbol: asset,
      counterparty: toAddress,
      amount,
      usd_value: usd,
      memo,
    })
    .select("id, type, token_symbol, amount, memo, counterparty, status, created_at, wallet_id")
    .single();
  if (txErr) throw txErr;

  try {
    const { notifyWalletTransaction } = await import("./tx-alerts.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await notifyWalletTransaction((admin ?? supabaseAdmin) as never, wallet.id, sendTx ?? {
      type: "send",
      token_symbol: asset,
      amount,
      memo,
      counterparty: toAddress,
      status: "confirmed",
      wallet_id: wallet.id,
    });
  } catch (e) {
    console.warn("[transfer] send alert failed", e);
  }

  return { ok: true, credited, resolvedTo: toAddress, symbol: asset };
}

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

  return { ok: true, credited: true, resolvedTo: toAddress, symbol };
}
