import { createFileRoute } from "@tanstack/react-router";
import type { SolanaSignInInput } from "@solana/wallet-standard-features";

/**
 * Sign In With Solana (Phantom SIWS).
 * Spec: https://github.com/phantom/sign-in-with-solana
 *
 * GET  → SolanaSignInInput (server-issued nonce / requestId)
 * POST → verify SIWS → { email, password, address } for Supabase sign-in
 */
export const Route = createFileRoute("/api/public/solana-auth")({
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
            process.env.SOLANA_AUTH_PASSWORD_SECRET ||
            process.env.OPENPAY_AUTH_PASSWORD_SECRET ||
            process.env.PI_AUTH_PASSWORD_SECRET ||
            getSupabaseServiceRoleKey() ||
            getSupabasePublishableKey();
          if (!secret) {
            return Response.json(
              { error: "Solana sign-in is not configured (missing server secret)." },
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

          const { createSolanaSignInInput } = await import("@/lib/solana-auth.server");
          const input = createSolanaSignInInput(secret, { domain, uri });
          return Response.json(input);
        } catch (err) {
          console.error("[solana-auth:create]", err);
          return Response.json(
            { error: (err as Error).message || "Failed to create sign-in data" },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            input?: SolanaSignInInput;
            output?: unknown;
          };
          if (!body.input || !body.output) {
            return Response.json({ error: "Missing input or output" }, { status: 400 });
          }

          const { getSupabaseServiceRoleKey } = await import(
            "@/integrations/supabase/env.server"
          );
          const { getSupabasePublishableKey } = await import(
            "@/integrations/supabase/env"
          );
          const secret =
            process.env.SOLANA_AUTH_PASSWORD_SECRET ||
            process.env.OPENPAY_AUTH_PASSWORD_SECRET ||
            process.env.PI_AUTH_PASSWORD_SECRET ||
            getSupabaseServiceRoleKey() ||
            getSupabasePublishableKey();
          if (!secret) {
            return Response.json(
              { error: "Solana sign-in is not configured (missing server secret)." },
              { status: 503 },
            );
          }

          const originHeader = request.headers.get("origin") || "";
          let expectedDomain = body.input.domain || "";
          if (originHeader) {
            try {
              expectedDomain = new URL(originHeader).host;
            } catch {
              /* keep input domain */
            }
          }

          const {
            assertValidSignInInput,
            deserializeSignInOutput,
            verifySolanaSignIn,
            solanaAuthCredentials,
            shortenSolanaAddress,
          } = await import("@/lib/solana-auth.server");

          assertValidSignInInput(secret, body.input, expectedDomain);
          const output = deserializeSignInOutput(body.output);

          if (!verifySolanaSignIn(body.input, output)) {
            return Response.json({ error: "Sign In verification failed" }, { status: 401 });
          }

          const address = output.account.address;
          if (!address) {
            return Response.json({ error: "Missing wallet address" }, { status: 400 });
          }

          const { email, password } = solanaAuthCredentials(secret, address);
          const displayName = shortenSolanaAddress(address);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const metadata = {
            solana_address: address,
            display_name: displayName,
            provider: "solana",
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
              return Response.json({ error: "Failed to provision Solana user" }, { status: 500 });
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
          console.error("[solana-auth:verify]", err);
          return Response.json(
            { error: (err as Error).message || "Server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
