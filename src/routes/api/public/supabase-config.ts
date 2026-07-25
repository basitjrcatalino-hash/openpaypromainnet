import { createFileRoute } from "@tanstack/react-router";

/**
 * Public anon/publishable Supabase config for browser bootstrap.
 * Never includes the service role / secret key.
 */
export const Route = createFileRoute("/api/public/supabase-config")({
  server: {
    handlers: {
      GET: async () => {
        const { getPublicSupabaseConfig } = await import(
          "@/integrations/supabase/public-config.server"
        );
        const { url, publishableKey } = getPublicSupabaseConfig();
        return Response.json(
          { url, publishableKey },
          {
            headers: {
              "Cache-Control": "public, max-age=60",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      },
    },
  },
});
