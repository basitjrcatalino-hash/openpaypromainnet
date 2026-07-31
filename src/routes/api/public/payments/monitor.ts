import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/payments/monitor
 * Blockchain listener tick: advances pending payments and deposits.
 * Auth: Supabase anon/publishable key in the `apikey` header (used by pg_cron).
 */
export const Route = createFileRoute("/api/public/payments/monitor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getSupabasePublishableKey } = await import("@/integrations/supabase/env");
        const expected = getSupabasePublishableKey() || process.env.SUPABASE_ANON_KEY;
        const provided = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        if (!expected) return Response.json({ error: "Not configured" }, { status: 503 });
        if (provided !== expected) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncInvoice } = await import("@/lib/payments-gateway.server");
        const { syncDeposit } = await import("@/lib/deposit-gateway.server");

        const [{ data: invoices }, { data: deposits }] = await Promise.all([
          supabaseAdmin
            .from("payment_invoices")
            .select("id")
            .in("status", ["pending", "detected"])
            .order("created_at", { ascending: true })
            .limit(25),
          supabaseAdmin
            .from("deposits")
            .select("id")
            .in("status", ["pending", "confirming", "confirmed"])
            .order("created_at", { ascending: true })
            .limit(25),
        ]);

        const results: Record<string, unknown>[] = [];
        for (const row of invoices ?? []) {
          try {
            const r = await syncInvoice(row.id);
            results.push({ kind: "payment", id: row.id, ...r });
          } catch (err) {
            results.push({ kind: "payment", id: row.id, error: String(err) });
          }
        }
        for (const row of deposits ?? []) {
          try {
            const r = await syncDeposit(row.id);
            results.push({ kind: "deposit", id: row.id, ...r });
          } catch (err) {
            results.push({ kind: "deposit", id: row.id, error: String(err) });
          }
        }

        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});
