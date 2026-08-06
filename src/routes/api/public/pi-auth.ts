import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

function cleanWalletAddress(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (v.length < 8 || v.length > 120) return null;
  return v;
}

export const Route = createFileRoute("/api/public/pi-auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            accessToken?: string;
            walletAddress?: string;
          };
          const { accessToken } = body;
          const walletAddress = cleanWalletAddress(body.walletAddress);
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
          const { getSupabaseServiceRoleKey, hasSupabaseAdminEnv } =
            await import("@/integrations/supabase/env.server");
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
          const password = createHash("sha256").update(`${passSecret}:pi:${me.uid}`).digest("hex");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { provisionPasswordUser } = await import("@/lib/auth-provision.server");

          let userId: string;
          try {
            const user = await provisionPasswordUser(supabaseAdmin, {
              email,
              password,
              metadata: {
                pi_uid: me.uid,
                pi_username: me.username,
                display_name: me.username,
                provider: "pi-network",
                ...(walletAddress ? { pi_wallet_address: walletAddress } : {}),
              },
            });
            userId = user.id;
          } catch (err) {
            console.error("[pi-auth] provision failed", err);
            const { cleanAuthErrorMessage } = await import("@/lib/auth-error");
            return Response.json(
              {
                error: cleanAuthErrorMessage(
                  err,
                  "Failed to provision Pi user. Check Supabase service role key.",
                ),
              },
              { status: 500 },
            );
          }

          // Always sync Pi identity onto profiles (including wallet when Auth returns it)
          const profilePatch: Record<string, unknown> = {
            pi_uid: me.uid,
            pi_username: me.username,
            updated_at: new Date().toISOString(),
          };
          if (walletAddress) profilePatch.pi_wallet_address = walletAddress;

          const { error: profErr } = await supabaseAdmin
            .from("profiles")
            .upsert({ id: userId, ...profilePatch }, { onConflict: "id" });
          if (profErr) {
            console.warn("[pi-auth] profile sync", profErr.message);
          }

          return Response.json({
            email,
            password,
            username: me.username,
            uid: me.uid,
            walletAddress: walletAddress ?? null,
          });
        } catch (err) {
          console.error("[pi-auth]", err);
          const { cleanAuthErrorMessage } = await import("@/lib/auth-error");
          return Response.json(
            { error: cleanAuthErrorMessage(err, "Server error") },
            { status: 500 },
          );
        }
      },
    },
  },
});
