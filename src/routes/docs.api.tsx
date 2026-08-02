import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsCode, DocsSection, DocsShell } from "@/components/docs/DocsShell";
import { Card } from "@/components/ui/card";
import { CONNECT_URL, DOCS_BASE, PARTNER_API, PARTNER_PORTAL } from "@/lib/docs-nav";

export const Route = createFileRoute("/docs/api")({
  head: () => ({
    meta: [
      { title: "Partner Transfer API Reference — OpenPay Pro" },
      {
        name: "description",
        content:
          "Full Partner Transfer API reference: me, balance, accounts, transfers, charges, OAuth token — for OpenPay Pro integrators.",
      },
      { property: "og:url", content: `${DOCS_BASE}/docs/api` },
    ],
    links: [{ rel: "canonical", href: `${DOCS_BASE}/docs/api` }],
  }),
  component: ApiDocsPage,
});

const SPEECH = `
Partner Transfer API. Authenticate with Bearer opk live keys. Resolve accounts, send transfers with idempotency keys, create PayButton charges and poll status. Connect OAuth exchanges codes for opa live user tokens. No partner webhooks — poll charges.
`.trim();

function ApiDocsPage() {
  return (
    <DocsShell
      title="Partner Transfer API"
      description="HTTP reference for transfers, PayButton charges, account resolve, and Connect OAuth — the backbone for exchanges, merchants, and apps."
      pathname="/docs/api"
      eyebrow="APIs"
      speechText={SPEECH}
    >
      <p className="text-sm text-muted-foreground">
        Portal:{" "}
        <a
          href={PARTNER_PORTAL}
          className="font-semibold text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {PARTNER_PORTAL}
        </a>
        {" · "}
        Raw markdown:{" "}
        <a
          href="/api/public/docs/partner-transfer"
          className="font-semibold text-primary hover:underline"
        >
          /api/public/docs/partner-transfer
        </a>
      </p>

      <DocsSection id="auth" eyebrow="01" title="Authentication">
        <DocsCode>{`Authorization: Bearer opk_live_YOUR_KEY

# Never expose opk_live_ in browsers or mobile apps.
# Register redirect URIs in the Partner portal (exact match).`}</DocsCode>
        <p className="text-sm text-muted-foreground">
          Base URL: <code className="break-all text-foreground">{PARTNER_API}</code>
        </p>
      </DocsSection>

      <DocsSection id="account" eyebrow="02" title="Account & balance">
        <DocsCode>{`GET /me
GET /balance
GET /accounts/:identifier   # @username | OP… | email`}</DocsCode>
        <DocsCode>{`curl -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  ${PARTNER_API}/me`}</DocsCode>
        <DocsCode>{`curl -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  ${PARTNER_API}/accounts/@satoshi`}</DocsCode>
      </DocsSection>

      <DocsSection id="transfers" eyebrow="03" title="Transfers (send)">
        <p className="text-sm text-muted-foreground">
          Debits the key owner’s OpenPay balance and credits the recipient. Use{" "}
          <code className="text-foreground">Idempotency-Key</code> (header or body) to safely retry.
        </p>
        <DocsCode>{`curl -X POST "${PARTNER_API}/transfers" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"to":"@username","amount":10.00,"note":"Payout"}'`}</DocsCode>
        <p className="text-sm text-muted-foreground">
          Body:{" "}
          <code className="text-foreground">
            {`{ "to", "amount", "note?", "idempotency_key?" }`}
          </code>
          . List: <code className="text-foreground">GET /transfers</code>
        </p>
      </DocsSection>

      <DocsSection id="charges" eyebrow="04" title="PayButton charges (accept payment)">
        <p className="text-sm text-muted-foreground">
          Create a charge → redirect to <code className="text-foreground">checkout_url</code> → poll
          status. <strong className="text-foreground">Partner webhooks are not available</strong> —
          poll <code className="text-foreground">GET /charges/:id</code>. Charges expire in{" "}
          <strong className="text-foreground">2 hours</strong>.
        </p>
        <DocsCode>{`curl -X POST "${PARTNER_API}/charges" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 19.99,
    "currency": "OUSD",
    "description": "Order #1234",
    "reference": "order_1234",
    "success_url": "https://yourapp.com/thanks",
    "cancel_url": "https://yourapp.com/cart"
  }'
# → { id, checkout_url, status, expires_at }

GET  /charges/:id          # created | paid | canceled | expired
GET  /charges?status=paid
POST /charges/:id/cancel`}</DocsCode>
        <DocsCode>{`<a href="https://openpy.space/paybutton/CHARGE_ID">
  Pay with OpenPay
</a>`}</DocsCode>
      </DocsSection>

      <DocsSection id="oauth" eyebrow="05" title="Connect with OpenPay (OAuth 2.0)">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Register exact redirect URIs in the Partner portal.</li>
          <li>
            Send users to{" "}
            <code className="text-foreground">
              {`${CONNECT_URL}?client_id=…&redirect_uri=…&scope=profile%20balance&state=…`}
            </code>
          </li>
          <li>
            Exchange <code className="text-foreground">code</code> for{" "}
            <code className="text-foreground">opa_live_…</code> on your backend (codes expire in 10
            minutes, single-use).
          </li>
          <li>
            Call <code className="text-foreground">GET /user/me</code> and{" "}
            <code className="text-foreground">GET /user/balance</code> with the user token (tokens
            last ~30 days).
          </li>
        </ol>
        <DocsCode>{`curl -X POST "${PARTNER_API}/oauth/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "authorization_code",
    "code": "opc_...",
    "redirect_uri": "https://yourapp.com/openpay/callback",
    "client_id": "YOUR_APP_ID",
    "client_secret": "opk_live_YOUR_KEY"
  }'
# → { access_token: "opa_live_...", token_type, expires_in, scope, user_id }`}</DocsCode>
        <p className="text-sm text-muted-foreground">
          Narrative guide:{" "}
          <Link to="/docs/openpay" className="font-semibold text-primary hover:underline">
            /docs/openpay
          </Link>
        </p>
      </DocsSection>

      <DocsSection id="errors" eyebrow="06" title="Error shapes">
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-88 text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr>
                <td className="px-3 py-2 font-medium text-foreground">401</td>
                <td className="px-3 py-2">Missing / invalid / revoked key</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-foreground">403</td>
                <td className="px-3 py-2">Origin not whitelisted</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-foreground">404</td>
                <td className="px-3 py-2">Recipient / charge not found</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-foreground">400</td>
                <td className="px-3 py-2">Validation (amount, insufficient balance, …)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          Expanded catalog:{" "}
          <Link to="/docs/errors" className="font-semibold text-primary hover:underline">
            /docs/errors
          </Link>
        </p>
      </DocsSection>

      <DocsSection id="limits" eyebrow="07" title="Limits & gaps">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>No partner payment webhooks yet — poll charges after return from checkout.</li>
          <li>No public partner OpenDEX swap HTTP API — deep-link to Pro swap.</li>
          <li>OUSD is ledger-API based — no public EVM/SPL contract address.</li>
        </ul>
        <Card className="mt-3 rounded-2xl border-border bg-muted/30 p-4 text-sm text-muted-foreground shadow-none">
          Full dump:{" "}
          <a
            href="/api/public/docs/partner-transfer"
            className="font-semibold text-primary hover:underline"
          >
            docs/PARTNER_TRANSFER_API.md
          </a>
        </Card>
      </DocsSection>
    </DocsShell>
  );
}
