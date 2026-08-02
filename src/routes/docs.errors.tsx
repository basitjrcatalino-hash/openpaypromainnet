import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsCode, DocsSection, DocsShell } from "@/components/docs/DocsShell";
import { DOCS_BASE, PARTNER_API } from "@/lib/docs-nav";

export const Route = createFileRoute("/docs/errors")({
  head: () => ({
    meta: [
      { title: "Errors & Retries — OpenPay Pro Docs" },
      {
        name: "description",
        content:
          "Partner Transfer, Ledger, MCP, and Pro API error codes with retry guidance for OpenPay Pro integrators.",
      },
      { property: "og:url", content: `${DOCS_BASE}/docs/errors` },
    ],
    links: [{ rel: "canonical", href: `${DOCS_BASE}/docs/errors` }],
  }),
  component: ErrorsDocsPage,
});

const PARTNER_ERRORS: { status: string; meaning: string; action: string }[] = [
  {
    status: "401",
    meaning: "Missing / invalid / revoked key",
    action: "Rotate key in partner portal; never ship keys to clients",
  },
  {
    status: "403",
    meaning: "Origin not whitelisted",
    action: "Allowlist exact redirect / Origin in partner app settings",
  },
  {
    status: "404",
    meaning: "Recipient or charge not found",
    action: "Resolve /accounts/:id first; verify charge id",
  },
  {
    status: "400",
    meaning: "Validation / insufficient balance",
    action: "Fix amount, currency, or fund hot wallet — do not blind-retry",
  },
  {
    status: "409",
    meaning: "Idempotency conflict (if returned)",
    action: "Reuse same Idempotency-Key; treat as success if body matches",
  },
  {
    status: "429 / 5xx",
    meaning: "Rate limit or upstream",
    action: "Exponential backoff; keep Idempotency-Key on transfers",
  },
];

function ErrorsDocsPage() {
  return (
    <DocsShell
      title="Errors & retries"
      description="HTTP status meanings for Partner Transfer, common Pro/Ledger failures, and how to retry safely."
      pathname="/docs/errors"
      eyebrow="Reference"
      speechText="Errors and retries for OpenPay Pro partner APIs. Use idempotency keys on transfers. Poll charges instead of webhooks. Retry 5xx with backoff; fix 4xx before retrying."
    >
      <DocsSection id="partner" eyebrow="01" title="Partner Transfer API">
        <p className="text-sm text-muted-foreground">
          Base: <code className="break-all text-foreground">{PARTNER_API}</code>
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Meaning</th>
                <th className="px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              {PARTNER_ERRORS.map((row) => (
                <tr key={row.status}>
                  <td className="px-3 py-2 font-medium text-foreground">{row.status}</td>
                  <td className="px-3 py-2">{row.meaning}</td>
                  <td className="px-3 py-2">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DocsCode>{`# Safe transfer retry pattern
curl -X POST "${PARTNER_API}/transfers" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Idempotency-Key: order_1234_transfer" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"@alice","amount":10.00,"note":"Payout"}'`}</DocsCode>
      </DocsSection>

      <DocsSection id="charges" eyebrow="02" title="Charges (no webhooks)">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            Statuses: <code className="text-foreground">created</code>,{" "}
            <code className="text-foreground">paid</code>,{" "}
            <code className="text-foreground">canceled</code>,{" "}
            <code className="text-foreground">expired</code> (2h TTL).
          </li>
          <li>
            After checkout return, poll <code className="text-foreground">GET /charges/:id</code>{" "}
            until terminal — do not assume success from redirect alone.
          </li>
          <li>
            Cancel only while <code className="text-foreground">created</code>:{" "}
            <code className="text-foreground">POST /charges/:id/cancel</code>.
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="ledger" eyebrow="03" title="Public Ledger API">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">4xx</strong> — bad cursor / asset filter; fix query.
          </li>
          <li>
            <strong className="text-foreground">5xx / empty</strong> — retry with backoff; page is
            append-only so duplicates are safe to ignore by id.
          </li>
          <li>
            Full guide:{" "}
            <Link to="/docs/ledger" className="font-semibold text-primary hover:underline">
              /docs/ledger
            </Link>
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="mcp" eyebrow="04" title="MCP / Agent Connect">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Not authenticated</strong> — complete OAuth; retry
            tool.
          </li>
          <li>
            Tool handler errors return <code className="text-foreground">isError: true</code> with a
            text message — surface to the user; do not invent balances.
          </li>
          <li>
            See{" "}
            <a href="/docs/mcp#errors" className="font-semibold text-primary hover:underline">
              /docs/mcp#errors
            </a>
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="pro" eyebrow="05" title="Pro app / migrations">
        <p className="text-sm text-muted-foreground">
          UI toasts that mention missing tables (e.g.{" "}
          <code className="text-foreground">asset_chat_messages</code>,{" "}
          <code className="text-foreground">global_chat_messages</code>) mean a Supabase migration
          was not applied — run the matching file under{" "}
          <code className="text-foreground">supabase/migrations</code>. These are not Partner API
          errors.
        </p>
      </DocsSection>

      <DocsSection id="related" eyebrow="06" title="Related">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            <Link to="/docs/api" className="font-semibold text-primary hover:underline">
              Partner Transfer API
            </Link>
          </li>
          <li>
            <Link to="/docs/faq" className="font-semibold text-primary hover:underline">
              FAQ
            </Link>
          </li>
        </ul>
      </DocsSection>
    </DocsShell>
  );
}
