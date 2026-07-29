import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

export const Route = createFileRoute("/api/public/pi-auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { accessToken } = (await request.json()) as { accessToken?: string };
          if (!accessToken || typeof accessToken !== "string") {
            return Response.json({ error: "Missing accessToken" }, { status: 400 });
          }

          // Validate token against Pi's /v2/me endpoint
          const meRes = await fetch("https://api.minepi.com/v2/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!meRes.ok) {
            const detail = await meRes.text().catch(() => "");
            console.error("[pi-auth] /v2/me failed", meRes.status, detail.slice(0, 200));
            return Response.json(
              { error: "Invalid Pi access token. Try signing in with Pi again." },
              { status: 401 },
            );
          }
          const me = (await meRes.json()) as { uid?: string; username?: string };
          if (!me?.uid || !me?.username) {
            return Response.json({ error: "Malformed Pi /me response" }, { status: 502 });
          }

          // Deterministic password derived from a server-only secret + uid.
          // Prefer the dedicated PI_AUTH_PASSWORD_SECRET so we don't depend on
          // SUPABASE_SERVICE_ROLE_KEY being readable as plain env on Lovable Cloud.
          const { getSupabaseServiceRoleKey, hasSupabaseAdminEnv } = await import(
            "@/integrations/supabase/env.server"
          );
          const { getSupabasePublishableKey } = await import("@/integrations/supabase/env");
          if (!hasSupabaseAdminEnv()) {
            return Response.json(
              {
                error:
                  "Pi sign-in is not configured (missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY).",
              },
              { status: 503 },
            );
          }
          const passSecret =
            process.env.PI_AUTH_PASSWORD_SECRET ||
            getSupabaseServiceRoleKey() ||
            getSupabasePublishableKey();
          if (!passSecret) {
            return Response.json(
              { error: "Pi sign-in is not configured (missing server secret)." },
              { status: 503 },
            );
          }

          const email = `pi-${me.uid}@pi.openpay.local`;
          const password = createHash("sha256")
            .update(`${passSecret}:pi:${me.uid}`)
            .digest("hex");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { provisionPasswordUser } = await import("@/lib/auth-provision.server");

          try {
            await provisionPasswordUser(supabaseAdmin, {
              email,
              password,
              metadata: {
                pi_uid: me.uid,
                pi_username: me.username,
                display_name: me.username,
                provider: "pi-network",
              },
            });
          } catch (err) {
            console.error("[pi-auth] provision failed", err);
            return Response.json(
              {
                error:
                  (err as Error).message ||
                  "Failed to provision Pi user. Check Supabase service role key.",
              },
              { status: 500 },
            );
          }

          return Response.json({ email, password, username: me.username, uid: me.uid });
        } catch (err) {
          console.error("[pi-auth]", err);
          return Response.json(
            { error: (err as Error).message || "Server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
