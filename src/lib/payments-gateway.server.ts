import { createHash, createHmac, randomBytes } from "crypto";
import { verifyChainTransfer, type ChainConfig, type TokenConfig } from "./chain-verify.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function sha256hex(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

export function newApiKey() {
  const key = `opk_${randomBytes(24).toString("hex")}`;
  return { key, prefix: key.slice(0, 12), hash: sha256hex(key) };
}

export function newPublicToken() {
  return `inv_${randomBytes(12).toString("hex")}`;
}

export function newWebhookSecret() {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export async function logPaymentAudit(
  invoiceId: string | null,
  merchantId: string | null,
  action: string,
  detail: Record<string, unknown> = {},
  actorId: string | null = null,
) {
  const db = await admin();
  await db.from("payment_audit_logs").insert({
    invoice_id: invoiceId,
    merchant_id: merchantId,
    action,
    detail: detail as any,
    actor_id: actorId,
  } as any);
}

export async function merchantFromApiKey(apiKey: string | null) {
  if (!apiKey || !apiKey.startsWith("opk_")) return null;
  const db = await admin();
  const { data } = await db
    .from("payment_merchants")
    .select("*")
    .eq("api_key_hash", sha256hex(apiKey.trim()))
    .eq("is_active", true)
    .maybeSingle();
  return data as any;
}

/** Public (non-sensitive) invoice shape returned to customers and merchants' APIs. */
export function publicInvoice(inv: any, merchant?: { name: string; slug: string; logo_url?: string | null }) {
  return {
    id: inv.id,
    token: inv.public_token,
    reference: inv.reference,
    description: inv.description,
    amount_usd: Number(inv.amount_usd),
    chain: inv.chain_key,
    token_symbol: inv.token_symbol,
    token_amount: inv.token_amount === null ? null : Number(inv.token_amount),
    pay_to_address: inv.pay_to_address,
    status: inv.status,
    tx_hash: inv.tx_hash,
    confirmations: inv.confirmations,
    required_confirmations: inv.required_confirmations,
    expires_at: inv.expires_at,
    paid_at: inv.paid_at,
    created_at: inv.created_at,
    merchant: merchant ? { name: merchant.name, slug: merchant.slug, logo_url: merchant.logo_url ?? null } : undefined,
  };
}

export async function listGatewayCatalog() {
  const db = await admin();
  const [{ data: chains }, { data: tokens }, { data: addresses }] = await Promise.all([
    db.from("deposit_chains").select("*").eq("is_enabled", true).order("sort_order"),
    db.from("deposit_tokens").select("*").eq("status", "active").eq("deposit_enabled", true).order("sort_order"),
    db.from("deposit_addresses").select("*").eq("is_active", true),
  ]);
  return { chains: chains ?? [], tokens: tokens ?? [], addresses: addresses ?? [] };
}

export async function deliverInvoiceWebhook(invoiceId: string, event: string) {
  const db = await admin();
  const { data: inv } = await db.from("payment_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv) return;
  const { data: merchant } = await db
    .from("payment_merchants")
    .select("*")
    .eq("id", inv.merchant_id)
    .maybeSingle();
  if (!merchant?.webhook_url) return;

  const payload = { event, sent_at: new Date().toISOString(), data: publicInvoice(inv) };
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", merchant.webhook_secret ?? "").update(body).digest("hex");

  const { data: delivery } = await db
    .from("payment_webhook_deliveries")
    .insert({
      invoice_id: inv.id,
      merchant_id: merchant.id,
      url: merchant.webhook_url,
      event,
      payload: payload as any,
      attempts: 1,
      status: "sending",
    } as any)
    .select("id")
    .single();

  try {
    const res = await fetch(merchant.webhook_url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-openpay-event": event,
        "x-openpay-signature": signature,
      },
      body,
    });
    const text = (await res.text()).slice(0, 500);
    await db
      .from("payment_webhook_deliveries")
      .update({ status: res.ok ? "delivered" : "failed", response_code: res.status, response_body: text } as any)
      .eq("id", delivery!.id);
  } catch (err) {
    await db
      .from("payment_webhook_deliveries")
      .update({ status: "failed", response_body: String(err).slice(0, 500) } as any)
      .eq("id", delivery!.id);
  }
}

/** Settles a paid invoice into the merchant's OpenPay wallet + OpenLedger. */
async function settleInvoice(inv: any) {
  const db = await admin();
  const { data: merchant } = await db
    .from("payment_merchants")
    .select("*")
    .eq("id", inv.merchant_id)
    .maybeSingle();
  if (!merchant) return null;

  const { data: wallet } = await db
    .from("wallets")
    .select("id, ousd_balance")
    .eq("user_id", merchant.user_id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!wallet) return null;

  const net = Number(inv.amount_usd);
  const { data: tx } = await db
    .from("transactions")
    .insert({
      wallet_id: wallet.id,
      type: "receive",
      status: "confirmed",
      token_symbol: "OUSD",
      counterparty: inv.from_address ?? inv.chain_key ?? "gateway",
      amount: net,
      usd_value: net,
      tx_hash: inv.tx_hash,
      memo: `Payment ${inv.reference ?? inv.public_token} · ${inv.token_amount ?? ""} ${inv.token_symbol ?? ""} on ${inv.chain_key ?? ""}`,
    } as any)
    .select("id")
    .single();

  await db
    .from("wallets")
    .update({ ousd_balance: Number(wallet.ousd_balance ?? 0) + net })
    .eq("id", wallet.id);

  const { data: ledger } = tx
    ? await db.from("ledger_entries").select("id").eq("tx_id", tx.id).maybeSingle()
    : { data: null as any };

  await db.from("ot_notifications").insert({
    user_id: merchant.user_id,
    title: "Payment received",
    body: `${net.toFixed(2)} USD paid for ${inv.reference ?? inv.public_token}.`,
    href: "/pay",
  } as any);

  return ledger?.id ?? null;
}

/** Re-checks an invoice against the blockchain and advances its state. */
export async function syncInvoice(invoiceId: string) {
  const db = await admin();
  const { data: inv } = await db.from("payment_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "paid" || inv.status === "cancelled") return { status: inv.status };

  if (inv.expires_at && new Date(inv.expires_at) < new Date() && !inv.tx_hash) {
    await db.from("payment_invoices").update({ status: "expired" } as any).eq("id", invoiceId);
    await deliverInvoiceWebhook(invoiceId, "payment.expired");
    return { status: "expired" };
  }
  if (!inv.tx_hash || !inv.chain_id || !inv.token_id) return { status: inv.status };

  const { data: chain } = await db.from("deposit_chains").select("*").eq("id", inv.chain_id).maybeSingle();
  const { data: token } = await db.from("deposit_tokens").select("*").eq("id", inv.token_id).maybeSingle();
  if (!chain || !token) throw new Error("Network configuration missing");
  if (chain.maintenance_mode) return { status: inv.status, paused: true };

  const result = await verifyChainTransfer({
    chain: chain as unknown as ChainConfig,
    token: token as unknown as TokenConfig,
    txHash: inv.tx_hash,
    toAddress: inv.pay_to_address!,
  });

  if (!result.found) return { status: inv.status, confirmations: 0 };
  if (result.failed) {
    const reason = result.reason ?? "Verification failed";
    await db.from("payment_invoices").update({ status: "failed", error: reason } as any).eq("id", invoiceId);
    await logPaymentAudit(invoiceId, inv.merchant_id, "verification_failed", { reason });
    await deliverInvoiceWebhook(invoiceId, "payment.failed");
    return { status: "failed", error: reason };
  }

  const required = Number(chain.required_confirmations ?? 12);
  const expected = Number(inv.token_amount ?? 0);
  if (expected > 0 && result.amount + 1e-9 < expected * 0.99) {
    const reason = `Underpaid: received ${result.amount} ${token.symbol}, expected ${expected}`;
    await db
      .from("payment_invoices")
      .update({ status: "failed", error: reason, from_address: result.from, confirmations: result.confirmations } as any)
      .eq("id", invoiceId);
    await deliverInvoiceWebhook(invoiceId, "payment.failed");
    return { status: "failed", error: reason };
  }

  if (result.confirmations < required) {
    await db
      .from("payment_invoices")
      .update({
        status: "detected",
        from_address: result.from,
        block_number: result.blockNumber,
        confirmations: result.confirmations,
        required_confirmations: required,
        detected_at: inv.detected_at ?? new Date().toISOString(),
      } as any)
      .eq("id", invoiceId);
    if (inv.status !== "detected") await deliverInvoiceWebhook(invoiceId, "payment.detected");
    return { status: "detected", confirmations: result.confirmations, required };
  }

  const ledgerId = await settleInvoice({ ...inv, from_address: result.from });
  await db
    .from("payment_invoices")
    .update({
      status: "paid",
      from_address: result.from,
      block_number: result.blockNumber,
      confirmations: result.confirmations,
      required_confirmations: required,
      ledger_entry_id: ledgerId,
      paid_at: new Date().toISOString(),
    } as any)
    .eq("id", invoiceId);
  await logPaymentAudit(invoiceId, inv.merchant_id, "paid", { confirmations: result.confirmations });
  await deliverInvoiceWebhook(invoiceId, "payment.paid");
  return { status: "paid", confirmations: result.confirmations };
}
