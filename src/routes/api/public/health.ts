import { createFileRoute } from "@tanstack/react-router";

/**
 * Public env readiness check for Vercel / Lovable deploys.
 * Returns booleans only — never secret values.
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const { getSupabasePublishableKey, getSupabaseUrl } = await import(
          "@/integrations/supabase/env"
        );
        const { hasSupabaseAdminEnv, getSupabaseServiceRoleKey } = await import(
          "@/integrations/supabase/env.server"
        );

        const url = Boolean(getSupabaseUrl());
        const publishable = Boolean(getSupabasePublishableKey());
        const serviceRole = Boolean(getSupabaseServiceRoleKey());
        const partner = Boolean(
          process.env.OPENPAY_PARTNER_API_KEY ||
            process.env.OPENPAY_API_KEY ||
            process.env.OPENPAY_TRANSFER_API_KEY,
        );
        const piClient = Boolean(
          process.env.VITE_PI_CLIENT_ID || process.env.PI_CLIENT_ID,
        );

        const missing: string[] = [];
        if (!url) missing.push("SUPABASE_URL");
        if (!publishable) missing.push("SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)");
        if (!serviceRole) missing.push("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)");

        return Response.json({
          ok: url && publishable && serviceRole,
          supabase: {
            url,
            publishable,
            serviceRole,
            adminReady: hasSupabaseAdminEnv(),
          },
          openpayPartnerKey: partner,
          piClientId: piClient,
          missing,
          hint:
            missing.length === 0
              ? null
              : "Add missing vars in Vercel → Settings → Environment Variables, then Redeploy. Vercel Supabase integration provides SUPABASE_SECRET_KEY.",
        });
      },
    },
  },
});
