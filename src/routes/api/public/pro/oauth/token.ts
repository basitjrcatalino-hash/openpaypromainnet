import { createFileRoute } from "@tanstack/react-router";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-id, x-client-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/** POST /api/public/pro/oauth/token — exchange an authorization code for an access token. */
export const Route = createFileRoute("/api/public/pro/oauth/token")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const raw = await request.text();
        let body: Record<string, unknown> = {};
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          body = Object.fromEntries(new URLSearchParams(raw));
        }

        const { readClientCredentials, authenticateApp, exchangeAuthorizationCode } = await import(
          "@/lib/pro-connect.server"
        );

        const grant = String(body.grant_type ?? "authorization_code");
        if (grant !== "authorization_code") {
          return json({ error: "unsupported_grant_type" }, 400);
        }
        const code = String(body.code ?? "").trim();
        if (!code) return json({ error: "invalid_request", message: "code is required" }, 400);

        const { clientId, clientSecret } = readClientCredentials(request, body);
        try {
          const app = await authenticateApp(clientId, clientSecret);
          const result = await exchangeAuthorizationCode({
            app,
            code,
            redirectUri: body.redirect_uri ? String(body.redirect_uri) : undefined,
          });
          return json({
            access_token: result.access_token,
            token_type: "Bearer",
            expires_in: result.expires_in,
            scope: result.scope,
            user_id: result.user_id,
          });
        } catch (e) {
          const msg = (e as Error).message || "invalid_grant";
          const status = msg === "invalid_client" ? 401 : 400;
          return json({ error: msg }, status);
        }
      },
    },
  },
});
