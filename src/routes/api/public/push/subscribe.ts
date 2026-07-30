import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/push/subscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            endpoint?: string;
            keys?: { p256dh?: string; auth?: string };
            userAgent?: string;
          };
          if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
            return Response.json({ error: "Missing subscription fields" }, { status: 400 });
          }

          const { getCallerUserId } = await import("@/lib/pi-payments.server");
          const userId = await getCallerUserId(request);
          if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
            {
              user_id: userId,
              endpoint: body.endpoint,
              p256dh: body.keys.p256dh,
              auth: body.keys.auth,
              user_agent: body.userAgent ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "endpoint" },
          );
          if (error) throw error;
          return Response.json({ ok: true });
        } catch (err) {
          console.error("[push subscribe]", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
