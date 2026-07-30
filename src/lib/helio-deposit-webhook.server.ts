import { createHmac, timingSafeEqual } from "crypto";
import {
  parseUserIdFromHelioCustomerId,
  isKnownHelioDepositId,
} from "@/lib/helio-deposit.server";

/**
 * Verify Helio / MoonPay Commerce webhook `X-Signature` (HMAC-SHA256 of raw body).
 * Docs: https://docs.hel.io/docs/webhooks
 */
export function verifyHelioWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  sharedToken: string,
): boolean {
  if (!signatureHeader || !sharedToken) return false;
  const expected = createHmac("sha256", sharedToken)
    .update(rawBody, "utf8")
    .digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signatureHeader.trim(), "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function helioWebhookAuthOk(
  authorization: string | null,
  sharedToken: string,
): boolean {
  if (!sharedToken) return false;
  if (!authorization) return true; // some deliveries only sign; still verify X-Signature
  const m = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!m) return false;
  const got = m[1].trim();
  try {
    const a = Buffer.from(got);
    const b = Buffer.from(sharedToken);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type HelioDepositWebhookPayload = {
  event?: string;
  depositId?: string;
  customerId?: string;
  amount?: string | number;
  grossAmount?: string | number;
  originalAmountInUSD?: string | number;
  feesPaid?: string | number;
  currency?: {
    symbol?: string;
    decimals?: number;
  };
  webhookDeliveryIdempotencyKey?: string;
  txIdempotencyKey?: string;
  transactionObject?: {
    id?: string;
    meta?: {
      id?: string;
      transactionSignature?: string;
      amount?: string | number;
    };
  };
  additionalJSON?: string;
};

function parseUsdFromHelio(payload: HelioDepositWebhookPayload): number {
  const decimals = Number(payload.currency?.decimals ?? 6);
  const symbol = String(payload.currency?.symbol || "").toUpperCase();

  // Stablecoin destination → treat amount as 1:1 USD
  if (
    /^(USDC|USDT|USD|PYUSD|USDG|USD1|CASH|OUSD)$/.test(symbol) &&
    payload.amount != null
  ) {
    const raw = Number(payload.amount);
    if (Number.isFinite(raw) && decimals >= 0) {
      return Math.round((raw / 10 ** decimals) * 100) / 100;
    }
  }

  // originalAmountInUSD is in 1e6 micro-USD (Helio docs)
  if (payload.originalAmountInUSD != null) {
    const micro = Number(payload.originalAmountInUSD);
    if (Number.isFinite(micro) && micro > 0) {
      return Math.round((micro / 1_000_000) * 100) / 100;
    }
  }

  if (payload.amount != null && decimals >= 0) {
    const raw = Number(payload.amount);
    if (Number.isFinite(raw)) {
      return Math.round((raw / 10 ** decimals) * 100) / 100;
    }
  }

  return 0;
}

function parseUserIdFromAdditionalJson(raw?: string): string | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { openpay_user_id?: string };
    return typeof o.openpay_user_id === "string" ? o.openpay_user_id : null;
  } catch {
    return null;
  }
}

/**
 * Credit OUSD after DEPOSIT_TX_CONFIRMED (admin path). Idempotent on Helio tx key.
 */
export async function creditHelioDepositWebhookTopup(
  payload: HelioDepositWebhookPayload,
): Promise<{ ok: true; alreadyCredited: boolean; amount: number; userId: string }> {
  const event = String(payload.event || "");
  if (event !== "DEPOSIT_TX_CONFIRMED") {
    throw new Error(`Ignored Helio event: ${event || "(missing)"}`);
  }

  if (payload.depositId && !isKnownHelioDepositId(payload.depositId)) {
    // Still allow if customer maps to our user — depositId shapes vary
  }

  const userId =
    parseUserIdFromHelioCustomerId(String(payload.customerId || "")) ||
    parseUserIdFromAdditionalJson(payload.additionalJSON);

  if (!userId) {
    throw new Error(
      `Cannot map Helio customerId "${payload.customerId}" to an OpenPay user`,
    );
  }

  const amount = parseUsdFromHelio(payload);
  if (!(amount >= 0.01)) {
    throw new Error(`Invalid Helio deposit amount: ${amount}`);
  }

  const idem =
    payload.txIdempotencyKey ||
    payload.webhookDeliveryIdempotencyKey ||
    payload.transactionObject?.meta?.id ||
    payload.transactionObject?.id ||
    payload.transactionObject?.meta?.transactionSignature;

  if (!idem) throw new Error("Missing Helio idempotency key");

  const txHash = `helio:${idem}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("transactions")
    .select("id, amount")
    .eq("tx_hash", txHash)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      alreadyCredited: true,
      amount: Number(existing.amount),
      userId,
    };
  }

  const { fetchActiveWallet } = await import("./wallet-utils");
  const wallet = await fetchActiveWallet<{ id: string }>(supabaseAdmin, userId);
  if (!wallet) throw new Error("Active wallet not found for Helio deposit user");

  const { creditTopupWithFee } = await import("./topup-fee");
  try {
    const credited = await creditTopupWithFee({
      client: supabaseAdmin,
      admin: supabaseAdmin,
      userWalletId: wallet.id,
      grossAmount: amount,
      counterparty: `helio:${String(payload.customerId || "").slice(0, 16)}`,
      txHash,
      memo: `MoonPay Commerce deposit · ${idem}`,
    });
    return {
      ok: true,
      alreadyCredited: false,
      amount: credited.netAmount,
      userId,
    };
  } catch (txErr) {
    const msg = (txErr as Error).message ?? "";
    if (/duplicate|unique/i.test(msg)) {
      return { ok: true, alreadyCredited: true, amount, userId };
    }
    throw txErr;
  }
}
