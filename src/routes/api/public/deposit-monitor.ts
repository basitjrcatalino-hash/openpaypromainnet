import { createFileRoute } from "@tanstack/react-router";

/**
 * Deposit monitor — poll pending/confirming deposits and advance them.
 * Intended for pg_cron or an external scheduler:
 *   POST /api/public/deposit-monitor  with  x-monitor-secret: $DEPOSIT_MONITOR_SECRET
 */
export const Route = createFileRoute("/api/public/deposit-monitor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.DEPOSIT_MONITOR_SECRET?.trim();
        if (!secret) return Response.json({ error: "Monitor not configured" }, { status: 503 });
        const provided = request.headers.get("x-monitor-secret") || "";
        if (provided.length !== secret.length || provided !== secret) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncDeposit, logDepositEvent } = await import("@/lib/deposit-gateway.server");
        const db = supabaseAdmin as any;

        const { data: pending, error } = await db
          .from("deposits")
          .select("id")
          .in("status", ["pending", "confirmed"])
          .order("created_at", { ascending: true })
          .limit(50);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let processed = 0;
        const failures: string[] = [];
        for (const row of pending ?? []) {
          try {
            await syncDeposit(db, row.id);
            processed += 1;
          } catch (err) {
            failures.push(`${row.id}: ${(err as Error).message}`);
            await logDepositEvent(db, row.id, "deposit.monitor_error", {
              message: (err as Error).message,
            });
          }
        }

        return Response.json({ ok: true, scanned: pending?.length ?? 0, processed, failures });
      },
    },
  },
});
