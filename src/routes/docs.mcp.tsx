import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsCode, DocsSection, DocsShell } from "@/components/docs/DocsShell";
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

function McpDocsPage() {
  return (
    <DocsShell
      title="Agent Connect · MCP"
      description="Plug AI agents into OpenPay Pro with Model Context Protocol — read-oriented wallet tools with OAuth-protected resources."
      pathname="/docs/mcp"
      eyebrow="APIs"
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

      <DocsSection id="tools" eyebrow="02" title="Available tools">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <code className="text-foreground">get_profile</code> — linked user profile
          </li>
          <li>
            <code className="text-foreground">list_wallets</code> — Pro wallets for the user
          </li>
          <li>
            <code className="text-foreground">list_transactions</code> — recent wallet activity
          </li>
          <li>
            <code className="text-foreground">list_ledger_entries</code> — public ledger rows
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Tools are <strong className="text-foreground">read-oriented</strong> — they help agents
          answer questions without silently moving funds. Money moves still go through Pro UI /
          Partner Transfer with user consent.
        </p>
      </DocsSection>

      <DocsSection id="clients" eyebrow="03" title="Client setup">
        <p className="text-sm text-muted-foreground">
          In ChatGPT / Claude / Cursor MCP settings, add a server pointing at{" "}
          <code className="text-foreground">{MCP_URL}</code> and complete OAuth when prompted.
        </p>
        <DocsCode>{`{
  "mcpServers": {
    "openpay-pro": {
      "url": "${MCP_URL}"
    }
  }
}`}</DocsCode>
      </DocsSection>

      <DocsSection id="related" eyebrow="04" title="Related">
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
