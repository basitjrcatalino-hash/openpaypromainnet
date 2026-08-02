import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Bot,
  ExternalLink,
  KeyRound,
  Layers,
  ScrollText,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DocsCode, DocsShell } from "@/components/docs/DocsShell";
import {
  DOCS_BASE,
  INBOUND_API,
  LEDGER_API_BASE,
  MCP_URL,
  PARTNER_API,
  PARTNER_PORTAL,
} from "@/lib/docs-nav";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Developer Portal — OpenPay Pro" },
      {
        name: "description",
        content:
          "Complete OpenPay Pro developer portal: payments, swap, deposit, withdraw, send, receive, tokens, Ledger API, and Agent Connect for exchanges, merchants, and apps.",
      },
      { property: "og:title", content: "Developer Portal — OpenPay Pro" },
      {
        property: "og:description",
        content:
          "Integrate OpenPay Pro into exchanges, merchant apps, and platforms — Connect, payments, money rails, tokens, Ledger, MCP.",
      },
      { property: "og:url", content: `${DOCS_BASE}/docs` },
    ],
    links: [{ rel: "canonical", href: `${DOCS_BASE}/docs` }],
  }),
  component: DocsPortalPage,
});

const SPEECH = `
OpenPay Pro Developer Portal.
Integrate OpenPay Pro into exchanges, merchant apps, wallets, and agent platforms.
Start at the Partner API portal, create an app, keep your opk live key on the server,
then wire Connect OAuth, PayButton charges, Partner transfers, Pro inbound credit,
Public Ledger reconciliation, and Agent Connect MCP tools.
Money rails cover send, receive, deposit, withdraw, and swap for OUSD and majors.
`.trim();

const PATHS = [
  {
    title: "Exchange / brokerage",
    body: "List OUSD as a network asset. Wire deposit (user → you), withdraw (you → user), and Ledger reconcile.",
    href: "/docs/exchange",
    icon: Layers,
  },
  {
    title: "Merchant / checkout",
    body: "Accept OpenPay Balance via PayButton charges. Poll charge status. Optional Connect for @username identity.",
    href: "/docs/openpay",
    icon: Wallet,
  },
  {
    title: "Fintech / wallet app",
    body: "Connect OAuth, Partner Transfer send/receive, Pro inbound to credit Pro wallets, deep-link swap & deposit.",
    href: "/docs/money",
    icon: Send,
  },
  {
    title: "AI agent / MCP",
    body: "Point ChatGPT, Claude, or any MCP client at OpenPay Pro tools for profile, wallets, txs, and ledger.",
    href: "/docs/mcp",
    icon: Bot,
  },
] as const;

const FEATURES = [
  {
    title: "Send & receive",
    desc: "Partner Transfer POST /transfers · Pro QR / @username · inbound pro_xfer",
    href: "/docs/money#send-receive",
    icon: Send,
  },
  {
    title: "Deposit",
    desc: "OpenPay Balance · multi-chain gateway · Pi · Solana Pay · Circle · Helio",
    href: "/docs/money#deposit",
    icon: ArrowDownToLine,
  },
  {
    title: "Withdraw",
    desc: "Partner Transfer out · Pro withdraw flows · destination @user / OP… / Pro wallet",
    href: "/docs/money#withdraw",
    icon: ArrowUpFromLine,
  },
  {
    title: "Swap",
    desc: "OpenDEX / majors vs OUSD · deep-link users into Pro · ledger type swap",
    href: "/docs/money#swap",
    icon: ArrowLeftRight,
  },
  {
    title: "Tokens",
    desc: "OUSD · BTC ETH SOL PI USDC USDT · OpenToken bonding curves · NFT",
    href: "/docs/tokens",
    icon: Layers,
  },
  {
    title: "Payments",
    desc: "PayButton charges · Connect OAuth · WalletConnect Pay · Solana Pay",
    href: "/docs/openpay",
    icon: KeyRound,
  },
  {
    title: "Ledger API",
    desc: "Append-only public entries for OpenLedger / accounting pipelines",
    href: "/docs/ledger",
    icon: ScrollText,
  },
  {
    title: "Security",
    desc: "Server-only opk_live keys · redirect allowlist · no partner webhooks yet — poll",
    href: "/docs/api#auth",
    icon: ShieldCheck,
  },
] as const;

const RAW_DOCS = [
  { label: "OpenPay integration + auth", href: "/api/public/docs/openpay" },
  { label: "OpenPay Pro auth only", href: "/api/public/docs/openpay-auth" },
  { label: "Exchange · OUSD", href: "/api/public/docs/exchange" },
  { label: "Partner Transfer API", href: "/api/public/docs/partner-transfer" },
  { label: "Public Ledger API", href: "/api/public/docs/ledger" },
  { label: "OpenPay → Pro inbound", href: "/api/public/docs/openpay-to-pro" },
  { label: "Tokens & assets", href: "/api/public/docs/tokens" },
  { label: "Agent Connect · MCP", href: "/api/public/docs/mcp" },
  { label: "Errors & retries", href: "/api/public/docs/errors" },
  { label: "Developer portal playbook", href: "/api/public/docs/portal" },
] as const;

function DocsPortalPage() {
  return (
    <DocsShell
      title="Build on OpenPay Pro"
      description="Complete developer portal for third-party platforms — exchanges, merchants, wallets, and agents. Integrate payments, send/receive, deposit, withdraw, swap, tokens, Ledger, and MCP."
      speechText={SPEECH}
      pathname="/docs"
      eyebrow="Developer Portal"
    >
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full">
          Partner Transfer API
        </Badge>
        <Badge variant="secondary" className="rounded-full">
          Connect OAuth
        </Badge>
        <Badge variant="secondary" className="rounded-full">
          Ledger · MCP
        </Badge>
        <Badge variant="outline" className="rounded-full">
          No partner webhooks — poll charges
        </Badge>
      </div>

      <Card className="rounded-3xl border-border/60 bg-card/80 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Step 0
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">Get credentials</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Create an app at the Partner API portal. Copy{" "}
              <code className="text-foreground">client_id</code> and{" "}
              <code className="text-foreground">opk_live_…</code>. Keep the key on your server only.
            </p>
          </div>
          <Button asChild className="rounded-full">
            <a href={PARTNER_PORTAL} target="_blank" rel="noreferrer">
              Open partner portal
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </Card>

      <section id="quickstart" className="scroll-mt-28 space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">Quickstart</h2>
        <ol className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">1. Register</strong> — Partner portal → app → domain
            allowlist for OAuth redirects.
          </li>
          <li>
            <strong className="text-foreground">2. Authenticate</strong> —{" "}
            <code className="text-foreground">Authorization: Bearer opk_live_…</code> on Partner
            Transfer calls.
          </li>
          <li>
            <strong className="text-foreground">3. Pick a flow</strong> — Charges (checkout),
            Transfers (payouts), Connect (user OAuth), or Pro inbound (credit Pro wallets).
          </li>
          <li>
            <strong className="text-foreground">4. Reconcile</strong> — Poll{" "}
            <code className="text-foreground">GET /charges/:id</code> and/or Public Ledger API.
          </li>
        </ol>
        <DocsCode>{`# Who am I (partner key)
curl -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  ${PARTNER_API}/me

# Create a PayButton charge
curl -X POST "${PARTNER_API}/charges" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 19.99,
    "currency": "OUSD",
    "description": "Order #1234",
    "reference": "order_1234",
    "success_url": "https://yourapp.com/thanks",
    "cancel_url": "https://yourapp.com/cart"
  }'`}</DocsCode>
      </section>

      <section id="paths" className="scroll-mt-28 space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">Choose your path</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PATHS.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.href}
                to={p.href}
                className="rounded-2xl border border-border/60 bg-card/70 p-4 transition hover:border-primary/30 hover:bg-card"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-base font-bold tracking-tight">{p.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="features" className="scroll-mt-28 space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">
          All features you can integrate
        </h2>
        <p className="text-sm text-muted-foreground">
          Every major OpenPay Pro surface partners ask about — mapped to docs and APIs.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <a
                key={f.href}
                href={f.href}
                className="flex gap-3 rounded-2xl border border-border/50 bg-muted/20 px-3.5 py-3 transition hover:bg-muted/40"
              >
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-background text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-bold">{f.title}</span>
                  <span className="block text-xs text-muted-foreground">{f.desc}</span>
                </span>
              </a>
            );
          })}
        </div>
      </section>

      <section id="bases" className="scroll-mt-28 space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">Base URLs</h2>
        <DocsCode>{`Partner Transfer API
${PARTNER_API}

Partner portal (keys)
${PARTNER_PORTAL}

OpenPay Pro (this app)
${DOCS_BASE}

Pro inbound credit
POST ${INBOUND_API}

Public Ledger API
${LEDGER_API_BASE}

Agent Connect (MCP)
${MCP_URL}`}</DocsCode>
      </section>

      <section id="raw" className="scroll-mt-28 space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">Raw markdown feeds</h2>
        <p className="text-sm text-muted-foreground">
          Machine-readable docs for LLMs, internal wikis, and offline mirrors. CORS{" "}
          <code className="text-foreground">*</code> enabled.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {RAW_DOCS.map((d) => (
            <li key={d.href}>
              <a
                href={d.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-card/60 px-3.5 py-2.5 text-sm font-semibold hover:bg-card"
              >
                {d.label}
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-40" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <Card className="rounded-3xl border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-bold">Need the deep dive?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with{" "}
              <Link to="/docs/openpay" className="font-semibold text-primary hover:underline">
                Connect & payments
              </Link>{" "}
              or{" "}
              <Link to="/docs/exchange" className="font-semibold text-primary hover:underline">
                Exchange · OUSD
              </Link>
              , then wire{" "}
              <Link to="/docs/api" className="font-semibold text-primary hover:underline">
                Partner Transfer API
              </Link>{" "}
              and{" "}
              <Link to="/docs/ledger" className="font-semibold text-primary hover:underline">
                Ledger
              </Link>
              .
            </p>
          </div>
        </div>
      </Card>
    </DocsShell>
  );
}
