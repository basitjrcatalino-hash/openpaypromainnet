import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, Copy, ExternalLink, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DocsCode, DocsSection, DocsShell } from "@/components/docs/DocsShell";
import {
  DOCS_BASE,
  INBOUND_API,
  LEDGER_API_BASE,
  MCP_URL,
  PARTNER_API,
  PARTNER_PORTAL,
} from "@/lib/docs-nav";

export const Route = createFileRoute("/docs/ai")({
  head: () => ({
    meta: [
      { title: "AI Partner Integration — OpenPay + OpenPay Pro" },
      {
        name: "description",
        content:
          "Easy OpenPay partner API integration for Cursor, Lovable, Replit, and Claude — auth, payments, top-up, inbound, ledger, MCP.",
      },
      {
        property: "og:title",
        content: "AI Partner Integration — OpenPay + OpenPay Pro",
      },
      {
        property: "og:description",
        content:
          "Paste one URL into your AI tool and ship Connect, PayButton, payouts, and Pro inbound.",
      },
      { property: "og:url", content: `${DOCS_BASE}/docs/ai` },
    ],
    links: [{ rel: "canonical", href: `${DOCS_BASE}/docs/ai` }],
  }),
  component: AiPartnerDocsPage,
});

const SPEECH = `
AI Partner Integration Pack for OpenPay and OpenPay Pro.
Paste the raw markdown feed into Cursor, Lovable, Replit, or Claude.
Cover Connect OAuth, PayButton charges, transfers, Pro inbound top-up, Ledger, and MCP.
Keep opk live keys on the server. Poll charges — no partner webhooks yet.
`.trim();

const FEEDS = [
  {
    label: "AI guide (markdown)",
    href: "/api/public/docs/ai-partner",
    tip: "Best single paste for agents",
  },
  { label: "OpenAPI YAML", href: "/api/public/docs/openapi", tip: "Schemas for codegen" },
  { label: "llms.txt index", href: "/llms.txt", tip: "Discovery index" },
  { label: "llms-full.txt", href: "/llms-full.txt", tip: "Long-context dump" },
] as const;

const PROMPTS = [
  {
    tool: "Cursor / Claude Code",
    body: `Fetch https://openpaypro.space/api/public/docs/ai-partner and
https://openpaypro.space/api/public/docs/openapi
Then implement OpenPay Partner integration in this repo:
- Server-only opk_live_ key from env
- Connect OAuth (authorize → callback → /oauth/token → store opa_live_)
- PayButton charges + poll until paid
- Optional POST /transfers with Idempotency-Key
Do not invent webhooks for charges. Do not expose the partner key to the client.`,
  },
  {
    tool: "Lovable",
    body: `@https://openpaypro.space/llms-full.txt
Build a merchant checkout that:
1) Creates an OpenPay charge from a server function using OPENPAY_PARTNER_API_KEY
2) Redirects the buyer to checkout_url
3) On return, polls GET /charges/:id until paid|canceled|expired
Also add a "Connect with OpenPay" button using openpy.space/connect.`,
  },
  {
    tool: "Replit / Claude Projects",
    body: `Use OpenPay Partner Transfer API base
https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api
Implement auth (Connect), payments (charges), and payouts (transfers)
per https://openpaypro.space/api/public/docs/ai-partner
Secrets: OPENPAY_CLIENT_ID, OPENPAY_PARTNER_API_KEY, OPENPAY_REDIRECT_URI`,
  },
] as const;

function AiPartnerDocsPage() {
  return (
    <DocsShell
      title="AI Partner Integration"
      description="One pack for third-party partners and AI coding tools — Connect, payments, top-up, inbound, ledger, MCP. Paste a feed URL and ship."
      pathname="/docs/ai"
      eyebrow="Start here"
      speechText={SPEECH}
    >
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full">
          Cursor · Lovable · Replit · Claude
        </Badge>
        <Badge variant="secondary" className="rounded-full">
          Auth · Pay · Top-up
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Poll charges — no webhooks
        </Badge>
      </div>

      <Card className="rounded-3xl border-border/60 bg-card/80 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Fastest path
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">
              Give your AI one URL
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Paste{" "}
              <code className="text-foreground">/api/public/docs/ai-partner</code> into Cursor,
              Lovable, Replit, or Claude. Keys come from the Partner portal — never from the
              browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-full">
              <a href="/api/public/docs/ai-partner" target="_blank" rel="noreferrer">
                Open AI guide
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <a href={PARTNER_PORTAL} target="_blank" rel="noreferrer">
                Get API keys
              </a>
            </Button>
          </div>
        </div>
      </Card>

      <DocsSection id="feeds" eyebrow="01" title="Machine-readable feeds">
        <ul className="grid gap-2 sm:grid-cols-2">
          {FEEDS.map((f) => (
            <li key={f.href}>
              <a
                href={f.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-start justify-between gap-2 rounded-xl border border-border/50 bg-card/60 px-3.5 py-2.5 hover:bg-card"
              >
                <span>
                  <span className="block text-sm font-semibold">{f.label}</span>
                  <span className="block text-xs text-muted-foreground">{f.tip}</span>
                </span>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-40" />
              </a>
            </li>
          ))}
        </ul>
      </DocsSection>

      <DocsSection id="prompts" eyebrow="02" title="Copy-paste prompts">
        <div className="space-y-4">
          {PROMPTS.map((p) => (
            <Card key={p.tool} className="rounded-2xl border-border/60 bg-muted/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                <Bot className="h-4 w-4 text-primary" />
                {p.tool}
              </div>
              <DocsCode>{p.body}</DocsCode>
            </Card>
          ))}
        </div>
      </DocsSection>

      <DocsSection id="features" eyebrow="03" title="What partners can integrate">
        <DocsCode>{`Auth / Connect     → openpy.space/connect → POST /oauth/token → opa_live_
Payments           → POST /charges → checkout_url → poll GET /charges/:id
Payouts            → POST /transfers + Idempotency-Key
Account resolve    → GET /accounts/@user|OP…|email
OpenPay → Pro      → note pro_xfer:@user:ref → POST ${INBOUND_API}
Top-up (product)   → ${DOCS_BASE}/topup (Pi, MoonPay, Helio, Solana Pay, Banxa, Circle…)
Reconcile          → ${LEDGER_API_BASE}/entries
Agents (read-only) → ${MCP_URL}

Partner API base
${PARTNER_API}`}</DocsCode>
        <p className="text-sm text-muted-foreground">
          Full narrative + Node examples:{" "}
          <Link to="/docs/openpay" className="font-semibold text-primary hover:underline">
            /docs/openpay
          </Link>
          {" · "}
          <Link to="/docs/api" className="font-semibold text-primary hover:underline">
            /docs/api
          </Link>
          {" · "}
          <Link to="/docs/money" className="font-semibold text-primary hover:underline">
            /docs/money
          </Link>
        </p>
      </DocsSection>

      <DocsSection id="rules" eyebrow="04" title="Security rules for agents">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Keep <code className="text-foreground">opk_live_…</code> on the server only — never{" "}
            <code className="text-foreground">VITE_</code> / client env.
          </li>
          <li>Exact-match OAuth redirect URIs in the Partner portal.</li>
          <li>Idempotency on every payout and Pro inbound credit.</li>
          <li>No partner charge webhooks — poll until paid / canceled / expired.</li>
          <li>OUSD is a ledger/network asset, not a public EVM/SPL contract.</li>
        </ol>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Copy className="h-3.5 w-3.5" />
          Repo skill for Cursor agents:{" "}
          <code className="text-foreground">.agents/skills/openpay-partner-api/</code>
        </p>
      </DocsSection>
    </DocsShell>
  );
}
