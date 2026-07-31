import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------- merchant -------------------------------- */

export const getMyMerchant = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("payment_merchants")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return { merchant: null };
    const { api_key_hash, webhook_secret, ...safe } = data as any;
    return { merchant: { ...safe, has_webhook_secret: Boolean(webhook_secret) } };
  });

export const saveMerchant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(60),
        slug: z
          .string()
          .trim()
          .min(3)
          .max(40)
          .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes"),
        website: z.string().trim().max(200).nullable().optional(),
        logo_url: z.string().trim().max(300).nullable().optional(),
        webhook_url: z.string().trim().max(300).nullable().optional(),
        settlement_symbol: z.string().trim().max(12).default("OUSD"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { newWebhookSecret, logPaymentAudit } = await import("./payments-gateway.server");

    const { data: existing } = await supabaseAdmin
      .from("payment_merchants")
      .select("id, webhook_secret")
      .eq("user_id", context.userId)
      .maybeSingle();

    const { data: slugOwner } = await supabaseAdmin
      .from("payment_merchants")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (slugOwner && slugOwner.id !== existing?.id) throw new Error("That store handle is already taken");

    const payload = {
      ...data,
      user_id: context.userId,
      webhook_secret: existing?.webhook_secret ?? newWebhookSecret(),
    };

    const { data: saved, error } = existing
      ? await supabaseAdmin.from("payment_merchants").update(payload as any).eq("id", existing.id).select("id").single()
      : await supabaseAdmin.from("payment_merchants").insert(payload as any).select("id").single();
    if (error) throw new Error(error.message);

    await logPaymentAudit(null, saved.id, existing ? "merchant_updated" : "merchant_created", {}, context.userId);
    return { id: saved.id };
  });

export const rotateMerchantCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ what: z.enum(["api_key", "webhook_secret"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { newApiKey, newWebhookSecret, logPaymentAudit } = await import("./payments-gateway.server");

    const { data: merchant } = await supabaseAdmin
      .from("payment_merchants")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!merchant) throw new Error("Create your merchant account first");

    if (data.what === "api_key") {
      const { key, prefix, hash } = newApiKey();
      await supabaseAdmin
        .from("payment_merchants")
        .update({ api_key_prefix: prefix, api_key_hash: hash } as any)
        .eq("id", merchant.id);
      await logPaymentAudit(null, merchant.id, "api_key_rotated", {}, context.userId);
      return { secret: key, kind: "api_key" as const };
    }

    const secret = newWebhookSecret();
    await supabaseAdmin.from("payment_merchants").update({ webhook_secret: secret } as any).eq("id", merchant.id);
    await logPaymentAudit(null, merchant.id, "webhook_secret_rotated", {}, context.userId);
    return { secret, kind: "webhook_secret" as const };
  });

/* -------------------------------- invoices -------------------------------- */

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: merchant } = await context.supabase
      .from("payment_merchants")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!merchant) return { invoices: [], deliveries: [] };

    const [{ data: invoices }, { data: deliveries }] = await Promise.all([
      context.supabase
        .from("payment_invoices")
        .select("*")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("payment_webhook_deliveries")
        .select("*")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    return { invoices: invoices ?? [], deliveries: deliveries ?? [] };
  });

export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        amount_usd: z.number().positive().max(1_000_000),
        description: z.string().trim().max(200).nullable().optional(),
        reference: z.string().trim().max(80).nullable().optional(),
        customer_email: z.string().trim().email().max(200).nullable().optional().or(z.literal("")),
        expires_minutes: z.number().int().min(5).max(43200).default(60),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { newPublicToken, logPaymentAudit } = await import("./payments-gateway.server");

    const { data: merchant } = await supabaseAdmin
      .from("payment_merchants")
      .select("id, is_active")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!merchant) throw new Error("Create your merchant account first");
    if (!merchant.is_active) throw new Error("This merchant account is disabled");

    const { data: created, error } = await supabaseAdmin
      .from("payment_invoices")
      .insert({
        merchant_id: merchant.id,
        public_token: newPublicToken(),
        amount_usd: data.amount_usd,
        description: data.description || null,
        reference: data.reference || null,
        customer_email: data.customer_email || null,
        expires_at: new Date(Date.now() + data.expires_minutes * 60_000).toISOString(),
        status: "pending",
      } as any)
      .select("id, public_token")
      .single();
    if (error) throw new Error(error.message);

    await logPaymentAudit(created.id, merchant.id, "invoice_created", { amount: data.amount_usd }, context.userId);
    return created;
  });

export const cancelInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("payment_invoices")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .in("status", ["pending", "detected"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const refreshInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: inv } = await context.supabase
      .from("payment_invoices")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    const { syncInvoice } = await import("./payments-gateway.server");
    const res = await syncInvoice(data.id);
    return { status: String(res.status ?? "pending") };
  });

/* ------------------------- public checkout (no auth) ----------------------- */

export const getCheckoutInvoice = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ token: z.string().trim().min(8).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { publicInvoice, listGatewayCatalog } = await import("./payments-gateway.server");

    const { data: inv } = await supabaseAdmin
      .from("payment_invoices")
      .select("*")
      .eq("public_token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Payment not found");

    const { data: merchant } = await supabaseAdmin
      .from("payment_merchants")
      .select("name, slug, logo_url")
      .eq("id", inv.merchant_id)
      .maybeSingle();

    const catalog = await listGatewayCatalog();
    return { invoice: publicInvoice(inv, merchant as any), ...catalog };
  });

export const selectCheckoutNetwork = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().trim().min(8).max(80),
        chainId: z.string().uuid(),
        tokenId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { publicInvoice } = await import("./payments-gateway.server");

    const { data: inv } = await supabaseAdmin
      .from("payment_invoices")
      .select("*")
      .eq("public_token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Payment not found");
    if (inv.status !== "pending") throw new Error("This payment can no longer be changed");

    const { data: chain } = await supabaseAdmin.from("deposit_chains").select("*").eq("id", data.chainId).maybeSingle();
    const { data: tok } = await supabaseAdmin.from("deposit_tokens").select("*").eq("id", data.tokenId).maybeSingle();
    if (!chain?.is_enabled || chain.maintenance_mode) throw new Error("This network is unavailable");
    if (!tok || tok.chain_id !== chain.id || !tok.deposit_enabled) throw new Error("This token is unavailable");

    const { data: address } = await supabaseAdmin
      .from("deposit_addresses")
      .select("address")
      .eq("chain_id", chain.id)
      .eq("is_active", true)
      .order("token_id", { nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (!address) throw new Error("No receiving address configured for this network");

    const rate = Number(tok.usd_rate ?? 0) || 1;
    const tokenAmount = Number((Number(inv.amount_usd) / rate).toFixed(8));

    const { data: updated, error } = await supabaseAdmin
      .from("payment_invoices")
      .update({
        chain_id: chain.id,
        token_id: tok.id,
        chain_key: chain.key,
        token_symbol: tok.symbol,
        token_amount: tokenAmount,
        pay_to_address: address.address,
        required_confirmations: chain.required_confirmations,
      } as any)
      .eq("id", inv.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { invoice: publicInvoice(updated) };
  });

export const submitCheckoutPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().trim().min(8).max(80),
        txHash: z.string().trim().min(16).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncInvoice, logPaymentAudit, publicInvoice } = await import("./payments-gateway.server");

    const { data: inv } = await supabaseAdmin
      .from("payment_invoices")
      .select("*")
      .eq("public_token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Payment not found");
    if (!inv.chain_id || !inv.pay_to_address) throw new Error("Choose a network and token first");
    if (inv.status === "paid") return { invoice: publicInvoice(inv), status: "paid" };

    const { data: dup } = await supabaseAdmin
      .from("payment_invoices")
      .select("id")
      .eq("chain_key", inv.chain_key!)
      .ilike("tx_hash", data.txHash)
      .neq("id", inv.id)
      .maybeSingle();
    if (dup) throw new Error("This transaction has already been used for another payment");

    await supabaseAdmin
      .from("payment_invoices")
      .update({ tx_hash: data.txHash, status: "detected", detected_at: new Date().toISOString() } as any)
      .eq("id", inv.id);
    await logPaymentAudit(inv.id, inv.merchant_id, "tx_submitted", { txHash: data.txHash });

    const res = await syncInvoice(inv.id);
    const { data: fresh } = await supabaseAdmin.from("payment_invoices").select("*").eq("id", inv.id).maybeSingle();
    return { invoice: publicInvoice(fresh), status: String(res.status ?? "detected") };
  });
