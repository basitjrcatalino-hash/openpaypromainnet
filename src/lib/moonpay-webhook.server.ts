import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify MoonPay `Moonpay-Signature-V2` header.
 * Docs: https://dev.moonpay.com/api-reference/widget/webhooks/signature
 *
 * Header format: `t=<unix>,s=<hex>`
 * Payload: `${timestamp}.${rawBody}` HMAC-SHA256 with webhook key (`wk_…`).
 */
export function verifyMoonPayWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header || !secret) return false;

  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  ) as { t?: string; s?: string };

  if (!parts.t || !parts.s) return false;

  const ageSec = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!Number.isFinite(ageSec) || ageSec > 60 * 10) return false;

  const expected = createHmac("sha256", secret)
    .update(`${parts.t}.${rawBody}`)
    .digest("hex");

  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(parts.s, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type MoonPayWebhookEvent = {
  type?: string;
  data?: {
    id?: string;
    status?: string;
    baseCurrencyAmount?: number;
    externalCustomerId?: string;
    externalTransactionId?: string;
    walletAddress?: string;
  };
};

/**
 * Credit OUSD for a completed MoonPay buy (admin client, webhook path).
 * Idempotent on `tx_hash` = `moonpay:{id}`.
 */
export async function creditMoonPayWebhookTopup(opts: {
  transactionId: string;
  amount: number;
  userId: string;
  externalTransactionId?: string;
}): Promise<{ ok: true; alreadyCredited: boolean; amount: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const amount = Math.round(opts.amount * 100) / 100;
  if (!(amount >= 1)) throw new Error("Invalid MoonPay amount");

  const txHash = `moonpay:${opts.transactionId}`;

  const { data: existing } = await supabaseAdmin
    .from("transactions")
    .select("id, amount")
    .eq("tx_hash", txHash)
    .maybeSingle();

  if (existing) {
    return { ok: true, alreadyCredited: true, amount: Number(existing.amount) };
  }

  // Prefer wallet encoded in externalTransactionId: ousd_<walletId>_<ts>
  let walletId: string | null = null;
  const m = opts.externalTransactionId?.match(/^ousd_([0-9a-f-]{36})_/i);
  if (m?.[1]) walletId = m[1];

  let wallet: { id: string; ousd_balance?: number | null } | null = null;
  if (walletId) {
    const { data: w } = await supabaseAdmin
      .from("wallets")
      .select("id, ousd_balance")
      .eq("id", walletId)
      .eq("user_id", opts.userId)
      .maybeSingle();
    wallet = w;
  }
  if (!wallet) {
    const { data: w } = await supabaseAdmin
      .from("wallets")
      .select("id, ousd_balance")
      .eq("user_id", opts.userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    wallet = w;
  }
  if (!wallet) {
    const { data: w } = await supabaseAdmin
      .from("wallets")
      .select("id, ousd_balance")
      .eq("user_id", opts.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    wallet = w;
  }
  if (!wallet) throw new Error("Wallet not found for MoonPay customer");

  const { creditTopupWithFee } = await import("./topup-fee");
  try {
    const credited = await creditTopupWithFee({
      client: supabaseAdmin,
      admin: supabaseAdmin,
      userWalletId: wallet.id,
      grossAmount: amount,
      counterparty: `moonpay:${opts.transactionId.slice(0, 12)}`,
      txHash,
      memo: `MoonPay webhook top-up · ${opts.transactionId}`,
    });
    return { ok: true, alreadyCredited: false, amount: credited.netAmount };
  } catch (txErr) {
    const msg = (txErr as Error).message ?? "";
    if (/duplicate|unique/i.test(msg)) {
      return { ok: true, alreadyCredited: true, amount };
    }
    throw txErr;
  }
}
