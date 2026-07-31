import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/payments/status/$id
 * `$id` is the invoice id or the public checkout token.
 * Re-verifies on-chain state before returning.
 * Auth: "x-api-key: opk_..." (merchant key) OR the public checkout token.
 */
export const Route = createFileRoute("/api/public/payments/status/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { merchantFromApiKey, publicInvoice, syncInvoice } = await import(
          "@/lib/payments-gateway.server"
        );

        const id = params.id;
        const byToken = id.startsWith("inv_");
        const query = supabaseAdmin.from("payment_invoices").select("*");
        const { data: inv } = byToken
          ? await query.eq("public_token", id).maybeSingle()
          : await query.eq("id", id).maybeSingle();
        if (!inv) return Response.json({ error: "Payment not found" }, { status: 404 });

        if (!byToken) {
          const merchant = await merchantFromApiKey(request.headers.get("x-api-key"));
          if (!merchant || merchant.id !== inv.merchant_id) {
            return Response.json({ error: "Invalid API key" }, { status: 401 });
          }
        }

        try {
          await syncInvoice(inv.id);
        } catch {
          /* return last known state on RPC failure */
        }
        const { data: fresh } = await supabaseAdmin
          .from("payment_invoices")
          .select("*")
          .eq("id", inv.id)
          .maybeSingle();

        return Response.json(publicInvoice(fresh), {
          headers: { "access-control-allow-origin": "*", "cache-control": "no-store" },
        });
      },
    },
  },
});
