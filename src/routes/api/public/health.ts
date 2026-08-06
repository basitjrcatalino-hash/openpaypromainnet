import { createFileRoute } from "@tanstack/react-router";

/**
 * Public env readiness check for Vercel / Lovable deploys.
 * Returns booleans only — never secret values.
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const { getSupabasePublishableKey, getSupabaseUrl } =
          await import("@/integrations/supabase/env");
        const { hasSupabaseAdminEnv, getSupabaseServiceRoleKey } =
          await import("@/integrations/supabase/env.server");

        const supabaseUrl = getSupabaseUrl();
        const url = Boolean(supabaseUrl);
        const publishable = Boolean(getSupabasePublishableKey());
        const serviceRole = Boolean(getSupabaseServiceRoleKey());
        const partner = Boolean(
          process.env.OPENPAY_PARTNER_API_KEY ||
          process.env.OPENPAY_API_KEY ||
          process.env.OPENPAY_TRANSFER_API_KEY,
        );
        const piClient = Boolean(process.env.VITE_PI_CLIENT_ID || process.env.PI_CLIENT_ID);

        let supabaseReachable: boolean | null = null;
        let supabaseHost: string | null = null;
        if (supabaseUrl) {
          try {
            supabaseHost = new URL(supabaseUrl).hostname;
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 4000);
            const probe = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/health`, {
              signal: ctrl.signal,
              headers: { apikey: getSupabasePublishableKey() || "" },
            }).catch(() => null);
            clearTimeout(t);
            supabaseReachable = Boolean(probe && (probe.ok || probe.status < 500));
          } catch {
            supabaseReachable = false;
          }
        }

        const missing: string[] = [];
        if (!url) missing.push("SUPABASE_URL");
        if (!publishable) missing.push("SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)");
        if (!serviceRole) missing.push("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)");

        const deadHost = url && supabaseReachable === false;
        if (deadHost) {
          missing.push(
            `SUPABASE_URL host unreachable (${supabaseHost}) — restore project or update URL`,
          );
        }

        return Response.json({
          ok: url && publishable && serviceRole && supabaseReachable !== false,
          supabase: {
            url,
            host: supabaseHost,
            reachable: supabaseReachable,
            publishable,
            serviceRole,
            adminReady: hasSupabaseAdminEnv(),
          },
          openpayPartnerKey: partner,
          piClientId: piClient,
          missing,
          hint: deadHost
            ? `DNS/HTTP failed for ${supabaseHost}. Unpause or recreate the Supabase project, then set VITE_SUPABASE_URL + keys in Lovable secrets and redeploy.`
            : missing.length === 0
              ? null
              : "Add missing vars in Vercel/Lovable → Environment Variables, then Redeploy.",
        });
      },
    },
  },
});
