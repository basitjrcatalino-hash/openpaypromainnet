import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsCode, DocsSection, DocsShell } from "@/components/docs/DocsShell";
import { DOCS_BASE, LEDGER_API_BASE } from "@/lib/docs-nav";

export const Route = createFileRoute("/docs/ledger")({
  head: () => ({
    meta: [
      { title: "Public Ledger API — OpenPay Pro" },
      {
        name: "description",
        content:
          "Public Ledger API for OpenPay Pro — append-only transaction mirror for OpenLedger, exchanges, and accounting pipelines.",
      },
      { property: "og:url", content: `${DOCS_BASE}/docs/ledger` },
    ],
    links: [{ rel: "canonical", href: `${DOCS_BASE}/docs/ledger` }],
  }),
  component: LedgerDocsPage,
});

function LedgerDocsPage() {
  return (
    <DocsShell
      title="Public Ledger API"
      description="Append-only public ledger of OpenPay Pro transactions — built for OpenLedger and external accounting / analytics."
      pathname="/docs/ledger"
      eyebrow="APIs"
    >
      <p className="text-sm text-muted-foreground">
        Raw markdown:{" "}
        <a href="/api/public/docs/ledger" className="font-semibold text-primary hover:underline">
          /api/public/docs/ledger
        </a>
        {" · "}
        In-app explorer: <code className="text-foreground">/ledger</code>
      </p>

      <DocsSection id="overview" eyebrow="01" title="What it mirrors">
        <p className="text-sm text-muted-foreground">
          Every row in <code className="text-foreground">transactions</code> is mirrored into{" "}
          <code className="text-foreground">ledger_entries</code> (immutable, ordered by{" "}
          <code className="text-foreground">sequence</code>).
        </p>
        <DocsCode>{`Types: send | receive | buy | sell | swap | mint | reward`}</DocsCode>
      </DocsSection>

      <DocsSection id="auth" eyebrow="02" title="Authentication">
        <DocsCode>{`Base: ${LEDGER_API_BASE}

x-api-key: <YOUR_KEY>
# or
Authorization: Bearer <YOUR_KEY>`}</DocsCode>
        <p className="text-sm text-muted-foreground">
          Keys: master <code className="text-foreground">LEDGER_MASTER_API_KEY</code> or issued keys
          from the in-app Ledger / Developer console.
        </p>
      </DocsSection>

      <DocsSection id="entries" eyebrow="03" title="List entries">
        <DocsCode>{`GET /entries?limit=100&cursor=1042&asset=OUSD&type=send&address=0x…&since=2026-01-01T00:00:00Z

curl -H "x-api-key: YOUR_KEY" \\
  "${LEDGER_API_BASE}/entries?limit=50&type=buy"`}</DocsCode>
        <p className="text-sm text-muted-foreground">
          Response includes <code className="text-foreground">count</code>,{" "}
          <code className="text-foreground">next_cursor</code>, and{" "}
          <code className="text-foreground">data[]</code> with sequence, amounts, addresses, memos.
        </p>
      </DocsSection>

      <DocsSection id="single" eyebrow="04" title="Single entry & stats">
        <DocsCode>{`GET /entries/:id
GET /stats`}</DocsCode>
      </DocsSection>

      <DocsSection id="reconcile" eyebrow="05" title="Exchange reconciliation tip">
        <p className="text-sm text-muted-foreground">
          After Partner Transfer deposits/withdrawals, cross-check Ledger entries by address, time
          window, and type. See{" "}
          <Link to="/docs/exchange" className="font-semibold text-primary hover:underline">
            Exchange docs
          </Link>
          .
        </p>
      </DocsSection>
    </DocsShell>
  );
}
