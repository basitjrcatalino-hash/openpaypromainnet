import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Keep SSR enabled so `/` redirects instead of rendering the 404 shell.
    if (typeof window === "undefined") {
      throw redirect({ to: "/authpi" });
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/authpi" });
  },
  component: () => null,
});
