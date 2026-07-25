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
            return Response.json({ error: "Invalid Pi access token" }, { status: 401 });
          }
          const me = (await meRes.json()) as { uid?: string; username?: string };
          if (!me?.uid || !me?.username) {
            return Response.json({ error: "Malformed Pi /me response" }, { status: 502 });
          }

          // Deterministic password derived from a server-only secret + uid.
          // Prefer the dedicated PI_AUTH_PASSWORD_SECRET so we don't depend on
          // SUPABASE_SERVICE_ROLE_KEY being readable as plain env on Lovable Cloud.
          const { getSupabaseServiceRoleKey } = await import(
            "@/integrations/supabase/env.server"
          );
          const { getSupabasePublishableKey } = await import(
            "@/integrations/supabase/env"
          );
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

          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              pi_uid: me.uid,
              pi_username: me.username,
              display_name: me.username,
              provider: "pi-network",
            },
          });

          if (createErr && !/registered|exists|duplicate/i.test(createErr.message)) {
            return Response.json({ error: createErr.message }, { status: 500 });
          }

          if (!created?.user) {
            // Existing user: reset password to deterministic value so sign-in works.
            const { data: list } = await supabaseAdmin.auth.admin.listUsers();
            const existing = list?.users.find((u) => u.email === email);
            if (!existing) {
              return Response.json({ error: "Failed to provision Pi user" }, { status: 500 });
            }
            await supabaseAdmin.auth.admin.updateUserById(existing.id, {
              password,
              user_metadata: {
                ...existing.user_metadata,
                pi_uid: me.uid,
                pi_username: me.username,
                display_name: existing.user_metadata?.display_name ?? me.username,
                provider: "pi-network",
              },
            });
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
