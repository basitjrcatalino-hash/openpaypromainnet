import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

/**
 * Sign in with Telegram (OpenID Connect + PKCE).
 * Docs: https://core.telegram.org/bots/telegram-login
 *
 * GET  → { authorize_url, state, redirect_uri }
 * POST → { email, password, username, telegram_user_id } after code exchange
 */
export const Route = createFileRoute("/api/public/telegram-auth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const {
            getTelegramClientId,
            getTelegramClientSecret,
            createPkceVerifier,
            pkceChallenge,
            createTelegramAuthState,
            resolveTelegramRedirectUri,
            buildTelegramAuthorizeUrl,
          } = await import("@/lib/telegram-auth.server");

          const clientId = getTelegramClientId();
          const clientSecret = getTelegramClientSecret();
          if (!clientId || !clientSecret) {
            return Response.json(
              {
                error:
                  "Telegram Login is not configured. Set TELEGRAM_CLIENT_ID and TELEGRAM_CLIENT_SECRET.",
              },
              { status: 503 },
            );
          }

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

          const redirectUri = resolveTelegramRedirectUri(origin || undefined);
          const codeVerifier = createPkceVerifier();
          const state = createTelegramAuthState({
            redirectUri,
            codeVerifier,
            returnTo: "/dashboard",
          });
          const authorize_url = buildTelegramAuthorizeUrl({
            clientId,
            redirectUri,
            state,
            codeChallenge: pkceChallenge(codeVerifier),
            scope: "openid profile",
          });

          return Response.json({
            authorize_url,
            state,
            redirect_uri: redirectUri,
            expires_in: 600,
          });
        } catch (err) {
          console.error("[telegram-auth:start]", err);
          return Response.json(
            { error: (err as Error).message || "Failed to start Telegram sign-in" },
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
            verifyTelegramAuthState,
            exchangeTelegramCode,
            verifyTelegramIdToken,
            telegramSubject,
            telegramCredentials,
          } = await import("@/lib/telegram-auth.server");

          const st = verifyTelegramAuthState(oauthState);
          const tokens = await exchangeTelegramCode({
            code,
            redirectUri: st.redirect_uri,
            codeVerifier: st.code_verifier,
          });
          const claims = await verifyTelegramIdToken(tokens.id_token);
          const subject = telegramSubject(claims);
          if (!subject) {
            return Response.json(
              { error: "Telegram ID token missing subject" },
              { status: 502 },
            );
          }

          const { getSupabaseServiceRoleKey } = await import(
            "@/integrations/supabase/env.server"
          );
          const { getSupabasePublishableKey } = await import("@/integrations/supabase/env");
          const passSecret =
            process.env.TELEGRAM_AUTH_PASSWORD_SECRET ||
            process.env.OPENPAY_AUTH_PASSWORD_SECRET ||
            getSupabaseServiceRoleKey() ||
            getSupabasePublishableKey();
          if (!passSecret) {
            return Response.json(
              { error: "Telegram sign-in is not configured (missing server secret)." },
              { status: 503 },
            );
          }

          const { email, password } = telegramCredentials(passSecret, subject);
          const username =
            (claims.preferred_username || "").replace(/^@/, "") ||
            claims.name ||
            `tg_${createHash("sha256").update(subject).digest("hex").slice(0, 8)}`;
          const displayName = claims.name || username;

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const metadata = {
            telegram_user_id: subject,
            telegram_username: claims.preferred_username?.replace(/^@/, ""),
            telegram_picture: claims.picture,
            telegram_phone: claims.phone_number,
            display_name: displayName,
            avatar_url: claims.picture,
            provider: "telegram",
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
              return Response.json({ error: "Failed to provision Telegram user" }, { status: 500 });
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

          // Best-effort profile upsert
          try {
            await supabaseAdmin.from("profiles").upsert({
              id: userId,
              display_name: displayName,
              username: claims.preferred_username?.replace(/^@/, "") || null,
              avatar_url: claims.picture || null,
              updated_at: new Date().toISOString(),
            } as any);
          } catch {
            /* ignore profile conflicts */
          }

          return Response.json({
            email,
            password,
            username,
            telegram_user_id: subject,
            avatar_url: claims.picture,
          });
        } catch (err) {
          console.error("[telegram-auth:complete]", err);
          return Response.json(
            { error: (err as Error).message || "Server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
