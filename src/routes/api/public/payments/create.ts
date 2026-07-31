import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  amount_usd: z.number().positive().max(1_000_000),
  reference: z.string().trim().max(80).optional(),
  description: z.string().trim().max(200).optional(),
  customer_email: z.string().trim().email().max(200).optional(),
  expires_minutes: z.number().int().min(5).max(43200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/public/payments/create
 * Auth: "x-api-key: opk_..." (merchant API key).
 */
export const Route = createFileRoute("/api/public/payments/create")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "content-type, x-api-key",
            "access-control-allow-methods": "POST, OPTIONS",
          },
        }),
      POST: async ({ request }) => {
        const { merchantFromApiKey, newPublicToken, publicInvoice, logPaymentAudit } = await import(
          "@/lib/payments-gateway.server"
        );
        const merchant = await merchantFromApiKey(request.headers.get("x-api-key"));
        if (!merchant) return Response.json({ error: "Invalid API key" }, { status: 401 });

        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch (err) {
          return Response.json({ error: "Invalid request body", detail: String(err) }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("payment_invoices")
          .insert({
            merchant_id: merchant.id,
            public_token: newPublicToken(),
            amount_usd: parsed.amount_usd,
            reference: parsed.reference ?? null,
            description: parsed.description ?? null,
            customer_email: parsed.customer_email ?? null,
            metadata: (parsed.metadata ?? {}) as any,
            expires_at: new Date(Date.now() + (parsed.expires_minutes ?? 60) * 60_000).toISOString(),
            status: "pending",
          } as any)
          .select("*")
          .single();
        if (error) return Response.json({ error: error.message }, { status: 400 });

        await logPaymentAudit(data.id, merchant.id, "invoice_created_api", { amount: parsed.amount_usd });
        const origin = new URL(request.url).origin;
        return Response.json(
          {
            ...publicInvoice(data, merchant),
            checkout_url: `${origin}/pay/${data.public_token}`,
          },
          { status: 201, headers: { "access-control-allow-origin": "*" } },
        );
      },
    },
  },
});
