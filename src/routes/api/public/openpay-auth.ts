import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

/**
 * Sign in with OpenPay (OAuth 2.0 Authorization Code).
 * Docs: https://openpy.space/openpay-auth
 *
 * GET  → { authorize_url, state, redirect_uri }
 * POST → { email, password, username, openpay_user_id } after code exchange
 */
export const Route = createFileRoute("/api/public/openpay-auth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const {
            createSignInState,
            buildOpenPaySignInAuthorizeUrl,
            resolvePartnerRedirectOrigin,
          } = await import("@/lib/openpay-connect.server");

          const url = new URL(request.url);
          const originHint =
            url.searchParams.get("origin") ||
            request.headers.get("origin") ||
            request.headers.get("referer") ||
            undefined;
          let origin = "";
          try {
            origin = originHint ? new URL(originHint).origin : "";
          } catch {
            origin = "";
          }

          const publicOrigin = resolvePartnerRedirectOrigin(origin || undefined);
          const redirectHint =
            (process.env.OPENPAY_REDIRECT_URI || "").trim() ||
            `${publicOrigin}/auth/openpay/callback`;
          const state = createSignInState(redirectHint);
          const built = buildOpenPaySignInAuthorizeUrl({
            origin: publicOrigin,
            state,
          });
          // Re-sign so state.redirect_uri matches the exact URI in the authorize URL
          const syncedState = createSignInState(built.redirect_uri);
          const synced = buildOpenPaySignInAuthorizeUrl({
            origin: publicOrigin,
            state: syncedState,
          });

          return Response.json({
            authorize_url: synced.authorize_url,
            state: syncedState,
            redirect_uri: synced.redirect_uri,
            expires_in: 600,
          });
        } catch (err) {
          console.error("[openpay-auth:start]", err);
          return Response.json(
            { error: (err as Error).message || "Failed to start OpenPay sign-in" },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            code?: string;
            state?: string;
          };
          const code = typeof body.code === "string" ? body.code.trim() : "";
          const oauthState = typeof body.state === "string" ? body.state.trim() : "";
          if (!code || !oauthState) {
            return Response.json({ error: "Missing code or state" }, { status: 400 });
          }

          const {
            verifyConnectState,
            exchangeOAuthCode,
            fetchOAuthUserMe,
          } = await import("@/lib/openpay-connect.server");

          const st = verifyConnectState(oauthState);
          if (st.purpose !== "signin" && st.uid !== "signin") {
            return Response.json(
              { error: "Invalid sign-in state — use Connect from Settings to link an account" },
              { status: 400 },
            );
          }

          const token = await exchangeOAuthCode({
            code,
            redirect_uri: st.redirect_uri,
          });
          const profile = await fetchOAuthUserMe(token.access_token);

          const openpayUserId =
            profile.user_id ||
            token.user_id ||
            profile.account_number ||
            profile.username;
          if (!openpayUserId) {
            return Response.json(
              { error: "OpenPay profile missing user_id" },
              { status: 502 },
            );
          }

          const { getSupabaseServiceRoleKey } = await import(
            "@/integrations/supabase/env.server"
          );
          const { getSupabasePublishableKey } = await import(
            "@/integrations/supabase/env"
          );
          const passSecret =
            process.env.OPENPAY_AUTH_PASSWORD_SECRET ||
            process.env.PI_AUTH_PASSWORD_SECRET ||
            getSupabaseServiceRoleKey() ||
            getSupabasePublishableKey();
          if (!passSecret) {
            return Response.json(
              { error: "OpenPay sign-in is not configured (missing server secret)." },
              { status: 503 },
            );
          }

          const email = `openpay-${openpayUserId}@openpay.auth.local`;
          const password = createHash("sha256")
            .update(`${passSecret}:openpay:${openpayUserId}`)
            .digest("hex");

          const username =
            (profile.username || "").replace(/^@/, "") ||
            profile.full_name ||
            openpayUserId;
          const displayName = profile.full_name || username;

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const metadata = {
            openpay_user_id: openpayUserId,
            openpay_username: profile.username?.replace(/^@/, "") || undefined,
            openpay_account_number: profile.account_number,
            openpay_avatar_url: profile.avatar_url,
            display_name: displayName,
            avatar_url: profile.avatar_url,
            provider: "openpay",
          };

          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: metadata,
          });

          if (createErr && !/registered|exists|duplicate/i.test(createErr.message)) {
            return Response.json({ error: createErr.message }, { status: 500 });
          }

          let userId = created?.user?.id;

          if (!userId) {
            const { data: list } = await supabaseAdmin.auth.admin.listUsers({
              page: 1,
              perPage: 1000,
            });
            const existing = list?.users.find((u) => u.email === email);
            if (!existing) {
              return Response.json({ error: "Failed to provision OpenPay user" }, { status: 500 });
            }
            userId = existing.id;
            await supabaseAdmin.auth.admin.updateUserById(existing.id, {
              password,
              user_metadata: {
                ...existing.user_metadata,
                ...metadata,
                display_name:
                  existing.user_metadata?.display_name ?? metadata.display_name,
              },
            });
          }

          const expiresAt =
            typeof token.expires_in === "number"
              ? new Date(Date.now() + token.expires_in * 1000).toISOString()
              : undefined;

          const { data: prefs } = await supabaseAdmin
            .from("user_preferences")
            .select("notifications")
            .eq("user_id", userId)
            .maybeSingle();
          const notifications: Record<string, unknown> = {
            ...((prefs?.notifications as Record<string, unknown>) ?? {}),
            openpay: {
              linked: true,
              openpayUserId:
                profile.account_number ||
                profile.username ||
                profile.user_id ||
                openpayUserId,
              username: profile.username?.replace(/^@/, ""),
              account_number: profile.account_number,
              name: profile.full_name,
              email: profile.email,
              identifier:
                profile.account_number || profile.username || profile.user_id,
              source: "partner",
              linkedAt: new Date().toISOString(),
              access_token: token.access_token,
              token_expires_at: expiresAt,
            },
          };
          await supabaseAdmin.from("user_preferences").upsert({
            user_id: userId,
            notifications: notifications as never,
            updated_at: new Date().toISOString(),
          });

          return Response.json({
            email,
            password,
            username,
            openpay_user_id: openpayUserId,
            avatar_url: profile.avatar_url,
          });
        } catch (err) {
          console.error("[openpay-auth:complete]", err);
          return Response.json(
            { error: (err as Error).message || "Server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
