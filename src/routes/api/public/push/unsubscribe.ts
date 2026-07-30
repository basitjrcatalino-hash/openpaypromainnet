import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/push/unsubscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { endpoint?: string };
          if (!body.endpoint) {
            return Response.json({ error: "Missing endpoint" }, { status: 400 });
          }
          const { getCallerUserId } = await import("@/lib/pi-payments.server");
          const userId = await getCallerUserId(request);
          if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("user_id", userId)
            .eq("endpoint", body.endpoint);

          return Response.json({ ok: true });
        } catch (err) {
          console.error("[push unsubscribe]", err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
