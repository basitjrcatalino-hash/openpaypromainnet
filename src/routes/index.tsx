import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * App landing = dashboard. Marketing site lives at `/website`.
 * Guests without a session are sent to sign-in.
 */
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      throw redirect({ to: "/dashboard" });
    }
    // Use getUser (same as /_authenticated) so a stale local session
    // does not send guests into a dashboard ↔ authpi blink loop.
    const { data, error } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
    if (error) {
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed.data.user) throw redirect({ to: "/dashboard" });
        await supabase.auth.signOut({ scope: "local" });
      }
    }
    throw redirect({ to: "/authpi" });
  },
});
