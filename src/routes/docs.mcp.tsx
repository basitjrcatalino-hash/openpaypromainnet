import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsCode, DocsSection, DocsShell } from "@/components/docs/DocsShell";
import { Card } from "@/components/ui/card";
import { DOCS_BASE, MCP_URL } from "@/lib/docs-nav";

export const Route = createFileRoute("/docs/mcp")({
  head: () => ({
    meta: [
      { title: "Agent Connect · MCP — OpenPay Pro" },
      {
        name: "description",
        content:
          "Connect ChatGPT, Claude, or any MCP client to OpenPay Pro wallet tools — profile, wallets, transactions, ledger.",
      },
      { property: "og:url", content: `${DOCS_BASE}/docs/mcp` },
    ],
    links: [{ rel: "canonical", href: `${DOCS_BASE}/docs/mcp` }],
  }),
  component: McpDocsPage,
});

const SPEECH = `
Agent Connect MCP. OpenPay Pro exposes a Model Context Protocol server with read-oriented wallet tools.
Authenticate with OAuth, then call get profile, list wallets, list transactions, and list ledger entries.
Money moves still require Pro UI or Partner Transfer with user consent.
`.trim();

function McpDocsPage() {
  return (
    <DocsShell
      title="Agent Connect · MCP"
      description="Plug AI agents into OpenPay Pro with Model Context Protocol — read-oriented wallet tools with OAuth-protected resources."
      pathname="/docs/mcp"
      eyebrow="APIs"
      speechText={SPEECH}
    >
      <DocsSection id="endpoint" eyebrow="01" title="MCP endpoint">
        <DocsCode>{`MCP server URL
${MCP_URL}

REST helpers
${DOCS_BASE}/.mcp/list-tools
${DOCS_BASE}/.mcp/invoke-tool/$tool

OAuth protected resource metadata
${DOCS_BASE}/.well-known/oauth-protected-resource`}</DocsCode>
        <p className="text-sm text-muted-foreground">
          In-app setup UI: sign in → <code className="text-foreground">/connect</code>
        </p>
      </DocsSection>

      <DocsSection id="auth" eyebrow="02" title="Authentication & permissions">
        <p className="text-sm leading-relaxed text-muted-foreground">
          The MCP server uses Supabase Auth OAuth (issuer JWT, audience{" "}
          <code className="text-foreground">authenticated</code>). Clients complete OAuth when
          prompted. Tools act as the <strong className="text-foreground">signed-in user</strong>.
        </p>
        <Card className="rounded-2xl border-border bg-card p-4 text-sm text-muted-foreground shadow-none">
          All tools are <strong className="text-foreground">read-only</strong> (
          <code className="text-foreground">readOnlyHint</code>). Agents can answer questions about
          balances and history — they <strong className="text-foreground">cannot</strong> silently
          transfer funds. Money moves go through Pro UI or{" "}
          <Link to="/docs/api" className="font-semibold text-primary hover:underline">
            Partner Transfer
          </Link>{" "}
          with explicit user consent.
        </Card>
      </DocsSection>

      <DocsSection id="tools" eyebrow="03" title="Available tools">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border p-4">
            <p className="font-semibold text-foreground">
              <code>get_profile</code>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Signed-in profile: display name, username, KYC status, account details. No input
              params.
            </p>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className="font-semibold text-foreground">
              <code>list_wallets</code>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pro wallets with addresses and per-asset balances (OUSD, PI, SOL, USDC, …). No input
              params.
            </p>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className="font-semibold text-foreground">
              <code>list_transactions</code>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent wallet activity, newest first. Optional{" "}
              <code className="text-foreground">limit</code> (1–100, default 20).
            </p>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className="font-semibold text-foreground">
              <code>list_ledger_entries</code>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Public ledger rows, newest first. Optional{" "}
              <code className="text-foreground">limit</code> (1–100) and{" "}
              <code className="text-foreground">asset</code> filter (e.g.{" "}
              <code className="text-foreground">OUSD</code>,{" "}
              <code className="text-foreground">PI</code>
              ).
            </p>
          </div>
        </div>
      </DocsSection>

      <DocsSection id="invoke" eyebrow="04" title="List & invoke (REST helpers)">
        <DocsCode>{`# Discover tools
curl ${DOCS_BASE}/.mcp/list-tools

# Invoke (auth required — use your MCP client OAuth session)
POST ${DOCS_BASE}/.mcp/invoke-tool/list_ledger_entries
Content-Type: application/json

{ "limit": 10, "asset": "OUSD" }`}</DocsCode>
        <p className="text-sm text-muted-foreground">
          Prefer the MCP transport at <code className="text-foreground">{MCP_URL}</code> from
          ChatGPT / Claude / Cursor rather than calling REST helpers by hand.
        </p>
      </DocsSection>

      <DocsSection id="clients" eyebrow="05" title="Client setup">
        <p className="text-sm font-semibold text-foreground">Cursor / Claude Desktop style</p>
        <DocsCode>{`{
  "mcpServers": {
    "openpay-pro": {
      "url": "${MCP_URL}"
    }
  }
}`}</DocsCode>
        <p className="mt-3 text-sm font-semibold text-foreground">ChatGPT / Claude connectors</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Add a custom MCP / connector pointing at the server URL above.</li>
          <li>Complete OAuth when the client prompts (OpenPay Pro / Supabase Auth).</li>
          <li>
            Ask the agent to list wallets or ledger entries — confirm tools appear after auth.
          </li>
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">
          Product UI walkthrough: <code className="text-foreground">{DOCS_BASE}/connect</code>
        </p>
      </DocsSection>

      <DocsSection id="errors" eyebrow="06" title="Errors & troubleshooting">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Not authenticated</strong> — finish OAuth; retry
            tool call.
          </li>
          <li>
            <strong className="text-foreground">Empty wallets / transactions</strong> — user has no
            Pro wallet yet; open <code className="text-foreground">/authpi</code> once.
          </li>
          <li>
            <strong className="text-foreground">Tool missing</strong> — hit{" "}
            <code className="text-foreground">/.mcp/list-tools</code> and refresh the client.
          </li>
          <li>
            <strong className="text-foreground">CORS / host</strong> — use production host{" "}
            <code className="text-foreground">openpaypro.space</code>; trust forwarded host is
            enabled for MCP handlers.
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="related" eyebrow="07" title="Related">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            Wiki:{" "}
            <a
              href="/wiki/agent-connect-mcp"
              className="font-semibold text-primary hover:underline"
            >
              Agent Connect guide
            </a>
          </li>
          <li>
            Payments for humans:{" "}
            <Link to="/docs/openpay" className="font-semibold text-primary hover:underline">
              Connect & payments
            </Link>
          </li>
          <li>
            Ledger HTTP:{" "}
            <Link to="/docs/ledger" className="font-semibold text-primary hover:underline">
              /docs/ledger
            </Link>
          </li>
        </ul>
      </DocsSection>
    </DocsShell>
  );
}
