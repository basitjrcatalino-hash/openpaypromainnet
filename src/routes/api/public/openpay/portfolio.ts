import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, Accept",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function handle(request: Request, identifier: string) {
  const {
    authorizePartnerRead,
    getPartnerPortfolio,
    normalizePortfolioError,
  } = await import("@/lib/openpay-portfolio.server");

  const auth = await authorizePartnerRead(request);
  if ("error" in auth) return json({ ok: false, error: auth.error }, auth.status);

  if (!identifier) {
    return json({ ok: false, error: "missing_username_or_wallet" }, 400);
  }

  try {
    const payload = await getPartnerPortfolio({
      identifier,
      restrictToUserId: auth.restrictToUserId,
    });
    return json(payload);
  } catch (err) {
    const { code, status } = normalizePortfolioError(err);
    return json({ ok: false, error: code }, status);
  }
}

/**
 * OpenPay Pro → OpenPay partner portfolio read.
 *
 * GET  /api/public/openpay/portfolio?username=alice
 * POST /api/public/openpay/portfolio  { "username": "alice" }
 * Authorization: Bearer opk_live_…
 */
export const Route = createFileRoute("/api/public/openpay/portfolio")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id =
          url.searchParams.get("username") ||
          url.searchParams.get("wallet") ||
          url.searchParams.get("address") ||
          url.searchParams.get("uid") ||
          "";
        return handle(request, id);
      },
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          body = {};
        }
        const id = String(
          body["username"] || body["wallet"] || body["address"] || body["uid"] || "",
        );
        return handle(request, id);
      },
    },
  },
});
