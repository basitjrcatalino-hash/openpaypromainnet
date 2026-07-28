import { createFileRoute } from "@tanstack/react-router";

/**
 * WalletConnect / EVM SIWE sign-in.
 * Merchant Pay API key stays server-only:
 * https://docs.walletconnect.com/api-reference/authentication
 *
 * GET  → SIWE challenge
 * POST → verify signature → { email, password, address } for Supabase
 */
export const Route = createFileRoute("/api/public/walletconnect-auth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { getSupabaseServiceRoleKey } = await import(
            "@/integrations/supabase/env.server"
          );
          const { getSupabasePublishableKey } = await import(
            "@/integrations/supabase/env"
          );
          const secret =
            process.env.WALLETCONNECT_AUTH_PASSWORD_SECRET ||
            process.env.OPENPAY_AUTH_PASSWORD_SECRET ||
            process.env.SOLANA_AUTH_PASSWORD_SECRET ||
            process.env.PI_AUTH_PASSWORD_SECRET ||
            getSupabaseServiceRoleKey() ||
            getSupabasePublishableKey();
          if (!secret) {
            return Response.json(
              { error: "WalletConnect sign-in is not configured (missing server secret)." },
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
          if (!origin) {
            return Response.json({ error: "Missing origin" }, { status: 400 });
          }

          const domain = new URL(origin).host;
          const uri = `${origin}/authpi`;

          const { createWalletConnectSignInChallenge } = await import(
            "@/lib/walletconnect-auth.server"
          );
          const challenge = createWalletConnectSignInChallenge(secret, {
            domain,
            uri,
            chainId: 1,
          });
          return Response.json(challenge);
        } catch (err) {
          console.error("[walletconnect-auth:create]", err);
          return Response.json(
            { error: (err as Error).message || "Failed to create sign-in challenge" },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            challenge?: import("@/lib/walletconnect-auth").WcSignInChallenge;
            address?: string;
            signature?: string;
          };
          if (!body.challenge || !body.address || !body.signature) {
            return Response.json(
              { error: "Missing challenge, address, or signature" },
              { status: 400 },
            );
          }

          const { getSupabaseServiceRoleKey } = await import(
            "@/integrations/supabase/env.server"
          );
          const { getSupabasePublishableKey } = await import(
            "@/integrations/supabase/env"
          );
          const secret =
            process.env.WALLETCONNECT_AUTH_PASSWORD_SECRET ||
            process.env.OPENPAY_AUTH_PASSWORD_SECRET ||
            process.env.SOLANA_AUTH_PASSWORD_SECRET ||
            process.env.PI_AUTH_PASSWORD_SECRET ||
            getSupabaseServiceRoleKey() ||
            getSupabasePublishableKey();
          if (!secret) {
            return Response.json(
              { error: "WalletConnect sign-in is not configured (missing server secret)." },
              { status: 503 },
            );
          }

          const originHeader = request.headers.get("origin") || "";
          let expectedDomain = body.challenge.domain || "";
          if (originHeader) {
            try {
              expectedDomain = new URL(originHeader).host;
            } catch {
              /* keep challenge domain */
            }
          }

          const {
            assertValidWcChallenge,
            verifyWalletConnectSignIn,
            walletConnectAuthCredentials,
            shortenEvmAddress,
          } = await import("@/lib/walletconnect-auth.server");

          assertValidWcChallenge(secret, body.challenge, expectedDomain);

          const ok = await verifyWalletConnectSignIn({
            challenge: body.challenge,
            address: body.address,
            signature: body.signature,
          });
          if (!ok) {
            return Response.json({ error: "Sign-in verification failed" }, { status: 401 });
          }

          const { getAddress } = await import("viem");
          const address = getAddress(body.address);
          const { email, password } = walletConnectAuthCredentials(secret, address);
          const displayName = shortenEvmAddress(address);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const metadata = {
            evm_address: address,
            walletconnect_address: address,
            display_name: displayName,
            provider: "walletconnect",
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
                { error: "Failed to provision WalletConnect user" },
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
            address,
            username: displayName,
          });
        } catch (err) {
          console.error("[walletconnect-auth:verify]", err);
          return Response.json(
            { error: (err as Error).message || "Server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
