import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";

/**
 * Sign a MoonPay widget URL (HMAC-SHA256 of the query string, including leading `?`).
 * Docs: https://dev.moonpay.com/widget/on-ramp/customization/url-signing
 *
 * React SDK calls this via `onUrlSignatureRequested` — return the raw base64
 * signature (not URL-encoded); the SDK appends it.
 *
 * Requires MOONPAY_SECRET_KEY (sk_test_… / sk_live_…). Without it, returns
 * { configured: false } so the client can surface a clear error.
 */
function moonPaySecretKey(): string {
  return (
    process.env.MOONPAY_SECRET_KEY?.trim() ||
    process.env.MOONPAY_SECRET_API_KEY?.trim() ||
    // Legacy fallback — prefer MOONPAY_SECRET_KEY (never rely on VITE_ for secrets)
    process.env.VITE_MOONPAY_SECRET_KEY?.trim() ||
    ""
  );
}

export const Route = createFileRoute("/api/public/moonpay-sign")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const secret = moonPaySecretKey();
          if (!secret) {
            return Response.json({ configured: false, signature: null });
          }

          const urlParam = new URL(request.url).searchParams.get("url");
          if (!urlParam) {
            return Response.json({ error: "Missing url" }, { status: 400 });
          }

          let parsed: URL;
          try {
            parsed = new URL(urlParam);
          } catch {
            return Response.json({ error: "Invalid url" }, { status: 400 });
          }

          const host = parsed.hostname.toLowerCase();
          if (
            host !== "buy.moonpay.com" &&
            host !== "buy-sandbox.moonpay.com" &&
            !host.endsWith(".moonpay.com")
          ) {
            return Response.json(
              { error: "URL host not allowed" },
              { status: 400 },
            );
          }

          // Sign only the query string, including leading "?"
          // (MoonPay rejects signatures that omit the "?")
          const signature = createHmac("sha256", secret)
            .update(parsed.search)
            .digest("base64");

          return Response.json({ configured: true, signature });
        } catch (err) {
          console.error("[moonpay-sign]", err);
          return Response.json(
            { error: (err as Error).message || "Signing failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
