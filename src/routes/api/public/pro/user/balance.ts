import { createFileRoute } from "@tanstack/react-router";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** GET /api/public/pro/user/balance — OUSD balance of the authorizing user. */
export const Route = createFileRoute("/api/public/pro/user/balance")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const { resolveAccessToken, hasScope, getActiveWallet } = await import(
          "@/lib/pro-connect.server"
        );
        try {
          const ctx = await resolveAccessToken(request);
          if (!hasScope(ctx.scope, "balance")) {
            return new Response(JSON.stringify({ error: "insufficient_scope" }), {
              status: 403,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }
          const wallet = await getActiveWallet(ctx.userId);
          return Response.json(
            {
              currency: "OUSD",
              balance: wallet?.ousd_balance ?? 0,
              wallet_address: wallet?.address ?? null,
              scope: ctx.scope,
            },
            { headers: CORS },
          );
        } catch (e) {
          return new Response(JSON.stringify({ error: (e as Error).message }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      },
    },
  },
});
