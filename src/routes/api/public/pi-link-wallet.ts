/**
 * Link Pi Network wallet address to the authenticated OpenPay Pro profile.
 * Verifies Pi access token via /v2/me, then stores wallet_address from Pi Auth.
 * Route: POST /api/public/pi-link-wallet
 */
import { createFileRoute } from "@tanstack/react-router";

function cleanWalletAddress(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (v.length < 8 || v.length > 120) return null;
  return v;
}

export const Route = createFileRoute("/api/public/pi-link-wallet")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization") || "";
          const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
          if (!jwt) {
            return Response.json({ error: "Sign in to OpenPay Pro first" }, { status: 401 });
          }

          const body = (await request.json()) as {
            accessToken?: string;
            walletAddress?: string;
          };
          if (!body.accessToken || typeof body.accessToken !== "string") {
            return Response.json({ error: "Missing Pi accessToken" }, { status: 400 });
          }
          const walletAddress = cleanWalletAddress(body.walletAddress);
          if (!walletAddress) {
            return Response.json(
              {
                error:
                  "Pi did not return a wallet address. Open this page in Pi Browser and allow the wallet_address permission.",
              },
              { status: 400 },
            );
          }

          const { hasSupabaseAdminEnv } = await import("@/integrations/supabase/env.server");
          if (!hasSupabaseAdminEnv()) {
            return Response.json({ error: "Server not configured for Pi linking" }, { status: 503 });
          }

          const { createClient } = await import("@supabase/supabase-js");
          const { getSupabaseUrl, getSupabasePublishableKey } = await import(
            "@/integrations/supabase/env"
          );
          const userClient = createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
            global: { headers: { Authorization: `Bearer ${jwt}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: userData, error: userErr } = await userClient.auth.getUser();
          if (userErr || !userData.user) {
            return Response.json({ error: "Invalid session" }, { status: 401 });
          }
          const userId = userData.user.id;

          const meRes = await fetch("https://api.minepi.com/v2/me", {
            headers: { Authorization: `Bearer ${body.accessToken}` },
          });
          if (!meRes.ok) {
            return Response.json({ error: "Invalid Pi access token" }, { status: 401 });
          }
          const me = (await meRes.json()) as { uid?: string; username?: string };
          if (!me?.uid || !me?.username) {
            return Response.json({ error: "Malformed Pi /me response" }, { status: 502 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Avoid stealing another account's Pi uid if already claimed
          const { data: clash } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("pi_uid", me.uid)
            .neq("id", userId)
            .maybeSingle();
          if (clash?.id) {
            return Response.json(
              { error: "This Pi account is already linked to another OpenPay Pro user" },
              { status: 409 },
            );
          }

          const { error: updErr } = await supabaseAdmin
            .from("profiles")
            .upsert(
              {
                id: userId,
                pi_uid: me.uid,
                pi_username: me.username,
                pi_wallet_address: walletAddress,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" },
            );
          if (updErr) {
            return Response.json({ error: updErr.message }, { status: 500 });
          }

          return Response.json({
            ok: true,
            pi_uid: me.uid,
            pi_username: me.username,
            pi_wallet_address: walletAddress,
          });
        } catch (err) {
          console.error("[pi-link-wallet]", err);
          return Response.json(
            { error: (err as Error).message || "Server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
