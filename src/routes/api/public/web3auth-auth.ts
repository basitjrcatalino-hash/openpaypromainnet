import { createFileRoute } from "@tanstack/react-router";

/**
 * MetaMask Embedded Wallets (Web3Auth) identity-token → Supabase session.
 * JWKS: https://api-auth.web3auth.io/.well-known/jwks.json
 * OAuth docs: https://docs.metamask.io/embedded-wallets/authentication/social-logins/oauth/
 */
export const Route = createFileRoute("/api/public/web3auth-auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { idToken?: string };
          if (!body.idToken) {
            return Response.json({ error: "Missing idToken" }, { status: 400 });
          }

          const { getSupabaseServiceRoleKey } = await import(
            "@/integrations/supabase/env.server"
          );
          const { getSupabasePublishableKey } = await import(
            "@/integrations/supabase/env"
          );
          const secret =
            process.env.WEB3AUTH_AUTH_PASSWORD_SECRET ||
            process.env.OPENPAY_AUTH_PASSWORD_SECRET ||
            process.env.WALLETCONNECT_AUTH_PASSWORD_SECRET ||
            process.env.SOLANA_AUTH_PASSWORD_SECRET ||
            getSupabaseServiceRoleKey() ||
            getSupabasePublishableKey();
          if (!secret) {
            return Response.json(
              { error: "MetaMask Embedded sign-in is not configured (missing server secret)." },
              { status: 503 },
            );
          }

          const {
            verifyWeb3AuthIdToken,
            web3AuthCredentials,
            web3AuthSubject,
            getWeb3AuthClientSecret,
          } = await import("@/lib/web3auth-auth.server");

          // Client secret is required in env for production deployments (dashboard credential).
          if (!getWeb3AuthClientSecret()) {
            console.warn(
              "[web3auth-auth] WEB3AUTH_CLIENT_SECRET is unset — JWKS verify still runs with client ID audience.",
            );
          }

          const payload = await verifyWeb3AuthIdToken(body.idToken);
          const subject = web3AuthSubject(payload);
          if (!subject) {
            return Response.json(
              { error: "Identity token missing user subject" },
              { status: 400 },
            );
          }

          const { email, password } = web3AuthCredentials(secret, subject);
          const displayName =
            payload.name ||
            payload.email ||
            (subject.includes("@") ? subject.split("@")[0] : `${subject.slice(0, 8)}…`);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const metadata = {
            provider: "metamask_embedded",
            web3auth_user_id: payload.userId ?? subject,
            web3auth_email: payload.email ?? null,
            web3auth_auth_connection: payload.authConnection ?? null,
            display_name: displayName,
            avatar_url: payload.profileImage ?? null,
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

          if (!created?.user) {
            const { data: list } = await supabaseAdmin.auth.admin.listUsers({
              page: 1,
              perPage: 1000,
            });
            const existing = list?.users.find((u) => u.email === email);
            if (!existing) {
              return Response.json(
                { error: "Failed to provision MetaMask Embedded user" },
                { status: 500 },
              );
            }
            await supabaseAdmin.auth.admin.updateUserById(existing.id, {
              password,
              user_metadata: {
                ...existing.user_metadata,
                ...metadata,
                display_name: existing.user_metadata?.display_name ?? metadata.display_name,
              },
            });
          }

          return Response.json({
            email,
            password,
            userId: payload.userId ?? subject,
            username: displayName,
            profileImage: payload.profileImage ?? null,
          });
        } catch (err) {
          console.error("[web3auth-auth]", err);
          return Response.json(
            { error: (err as Error).message || "Verification failed" },
            { status: 401 },
          );
        }
      },
    },
  },
});
