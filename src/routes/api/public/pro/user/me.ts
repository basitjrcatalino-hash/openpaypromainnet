import { createFileRoute } from "@tanstack/react-router";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** GET /api/public/pro/user/me — profile of the user who authorized the app. */
export const Route = createFileRoute("/api/public/pro/user/me")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const { resolveAccessToken, getProfileSummary } = await import(
          "@/lib/pro-connect.server"
        );
        try {
          const ctx = await resolveAccessToken(request);
          const me = await getProfileSummary(ctx.userId);
          return Response.json({ ...me, scope: ctx.scope, app: ctx.app.name }, { headers: CORS });
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
