import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ExternalLink, KeyRound, ShieldCheck, Wallet } from "lucide-react";
import {
  DocsCallout,
  DocsCard,
  DocsCode,
  DocsSection,
  DocsShell,
} from "@/components/docs/DocsShell";
import { DOCS_BASE } from "@/lib/docs-nav";

export const Route = createFileRoute("/docs/integrations")({
  head: () => ({
    meta: [
      {
        title: "Pro Connect Integrations — OpenPay Pro Auth & Pay",
      },
      {
        name: "description",
        content:
          "Integrate OpenPay Pro Auth (OAuth) and Pro Pay charges: consent, token exchange, user profile/balance, checkout, polling, and developer app management.",
      },
      {
        property: "og:title",
        content: "Pro Connect Integrations — Auth & Pay",
      },
      {
        property: "og:description",
        content:
          "Third-party OAuth sign-in and OUSD checkout on OpenPay Pro — endpoints, scopes, and copy-paste flows.",
      },
      { property: "og:url", content: `${DOCS_BASE}/docs/integrations` },
    ],
    links: [{ rel: "canonical", href: `${DOCS_BASE}/docs/integrations` }],
  }),
  component: IntegrationsDocsPage,
});

const SPEECH = `
OpenPay Pro Connect integrations.
Third-party apps create a Connect app in the Partner API portal, then use OAuth authorization code for sign-in and Pro Pay charges for OUSD checkout.
Discovery at the public config endpoint, authorize users at pro authorize, exchange codes for oprat tokens, read profile and balance, create charges and poll until paid.
Keep client secrets on the server only. No charge webhooks — poll. Currency is OUSD.
`.trim();

const TOC = [
  ["#overview", "0. Overview"],
  ["#discovery", "1. Discovery"],
  ["#apps", "2. Create an app"],
  ["#auth", "3. OAuth Auth"],
  ["#user", "4. User APIs"],
  ["#charges", "5. Pro Pay charges"],
  ["#checkout", "6. Checkout UX"],
  ["#node", "7. Copy-paste Node"],
  ["#checklist", "8. Launch checklist"],
] as const;

function Pill({
  children,
  href,
  primary,
}: {
  children: ReactNode;
  href: string;
  primary?: boolean;
}) {
  const external = href.startsWith("http") || href.startsWith("/api/");
  const className = primary
    ? "inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 md:text-base"
    : "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary md:text-base";
  return (
    <a
      href={href}
      className={className}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

function IntegrationsDocsPage() {
  return (
    <DocsShell
      title="Pro Connect · Auth & Pay"
      description="Third-party integrations on OpenPay Pro: OAuth sign-in (opro_live_ / oprat_), OUSD checkout charges, and developer app management — all native to Pro."
      pathname="/docs/integrations"
      eyebrow="Core guides"
      speechText={SPEECH}
    >
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-muted px-3.5 py-1.5 text-sm font-semibold text-muted-foreground">
          OAuth 2.0
        </span>
        <span className="rounded-full bg-muted px-3.5 py-1.5 text-sm font-semibold text-muted-foreground">
          Pro Pay · OUSD
        </span>
        <span className="rounded-full bg-muted px-3.5 py-1.5 text-sm font-semibold text-muted-foreground">
          No webhooks · poll
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Pill href="/partner-api" primary>
          <KeyRound className="h-4 w-4" />
          Partner API portal
        </Pill>
        <Pill href="/api/public/pro/config">
          Discovery JSON
          <ExternalLink className="h-3.5 w-3.5" />
        </Pill>
        <Pill href="/api/public/docs/integrations">
          Raw markdown
          <ExternalLink className="h-3.5 w-3.5" />
        </Pill>
      </div>

      <nav className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          On this page
        </p>
        <ol className="grid gap-1 sm:grid-cols-2">
          {TOC.map(([href, label]) => (
            <li key={href}>
              <a href={href} className="text-sm font-semibold text-primary hover:underline">
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <DocsSection id="overview" eyebrow="0" title="What Pro Connect is">
        <p>
          <strong>OpenPay Pro Connect</strong> is the native integration layer for apps built on Pro
          — separate from the OpenPay Partner Transfer API on <code>openpy.space</code>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <DocsCard className="p-5!">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <p className="text-lg font-bold text-foreground">OpenPay Pro Auth</p>
            </div>
            <p className="mt-2 text-base text-muted-foreground">
              Authorization-code OAuth. Users approve scopes on /pro/authorize; you exchange the
              code for an oprat_ access token.
            </p>
          </DocsCard>
          <DocsCard className="p-5!">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <p className="text-lg font-bold text-foreground">OpenPay Pro Pay</p>
            </div>
            <p className="mt-2 text-base text-muted-foreground">
              Create a charge, redirect to /pro/checkout/{"{id}"}, user pays from OUSD balance. Poll
              until paid | canceled | expired.
            </p>
          </DocsCard>
        </div>
        <DocsCallout>
          <strong className="text-foreground">Keys stay on the server.</strong> Client secrets (
          <code className="text-foreground">oprs_live_…</code>) never ship in{" "}
          <code className="text-foreground">VITE_</code> env or browser bundles. User tokens are{" "}
          <code className="text-foreground">oprat_…</code> (Bearer).
        </DocsCallout>
      </DocsSection>

      <DocsSection id="discovery" eyebrow="1" title="Discovery">
        <p>Start from the public config document — endpoints, scopes, and checkout URL template:</p>
        <DocsCode>{`GET ${DOCS_BASE}/api/public/pro/config`}</DocsCode>
        <p className="text-sm text-muted-foreground">
          Returns <code>authorization_endpoint</code>, <code>token_endpoint</code>,{" "}
          <code>userinfo_endpoint</code>, <code>balance_endpoint</code>,{" "}
          <code>charges_endpoint</code>, and <code>scopes_supported</code>.
        </p>
      </DocsSection>

      <DocsSection id="apps" eyebrow="2" title="Create a Connect app">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Open{" "}
            <Link to="/partner-api" className="font-semibold text-primary hover:underline">
              Partner API portal
            </Link>{" "}
            (<code className="text-foreground">/partner-api</code>)
          </li>
          <li>Create an app with name, website, logo, and exact-match OAuth callback URIs</li>
          <li>
            Copy <code>opro_live_…</code> (client id) and <code>oprs_live_…</code> (secret) once
          </li>
        </ol>
        <p className="text-sm text-muted-foreground">
          Redirect URIs are compared after trimming trailing slashes — must match exactly. Same rule
          as OpenPay’s partner portal.
        </p>
      </DocsSection>

      <DocsSection id="auth" eyebrow="3" title="OAuth authorization code">
        <p>Send the user to the consent screen:</p>
        <DocsCode>{`${DOCS_BASE}/pro/authorize?client_id=opro_live_…
&redirect_uri=https://your.app/callback
&scope=profile%20balance
&state=RANDOM`}</DocsCode>
        <p>
          On Approve, Pro redirects to your <code>redirect_uri</code> with <code>code</code>,{" "}
          <code>scope</code>, and <code>state</code>. Exchange the code:
        </p>
        <DocsCode>{`curl -X POST "${DOCS_BASE}/api/public/pro/oauth/token" \\
  -H "Content-Type: application/json" \\
  -u "opro_live_…:oprs_live_…" \\
  -d '{
    "grant_type": "authorization_code",
    "code": "oprc_…",
    "redirect_uri": "https://your.app/callback"
  }'`}</DocsCode>
        <p>
          Response: <code>access_token</code> (<code>oprat_…</code>), <code>expires_in</code>,{" "}
          <code>scope</code>, <code>user_id</code>.
        </p>
        <p className="text-sm text-muted-foreground">
          Scopes: <code>profile</code> · <code>balance</code> · <code>payments</code>
        </p>
      </DocsSection>

      <DocsSection id="user" eyebrow="4" title="User profile & balance">
        <DocsCode>{`# Profile (any valid token)
curl "${DOCS_BASE}/api/public/pro/user/me" \\
  -H "Authorization: Bearer oprat_…"

# Balance (requires balance scope)
curl "${DOCS_BASE}/api/public/pro/user/balance" \\
  -H "Authorization: Bearer oprat_…"`}</DocsCode>
      </DocsSection>

      <DocsSection id="charges" eyebrow="5" title="Pro Pay charges">
        <p>
          Authenticate with <strong>client id + secret</strong> (Basic or JSON body). Currency is
          always <strong>OUSD</strong>. Default TTL is 30 minutes (max 2 hours).{" "}
          <strong>No webhooks</strong> — poll until terminal status.
        </p>
        <DocsCode>{`# Create
curl -X POST "${DOCS_BASE}/api/public/pro/charges" \\
  -u "opro_live_…:oprs_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 12.5,
    "description": "Premium plan",
    "reference": "ord_1001",
    "success_url": "https://your.app/paid",
    "cancel_url": "https://your.app/cancel"
  }'

# Poll
curl "${DOCS_BASE}/api/public/pro/charges/CHARGE_UUID" \\
  -u "opro_live_…:oprs_live_…"

# Cancel unpaid
curl -X POST "${DOCS_BASE}/api/public/pro/charges/CHARGE_UUID/cancel" \\
  -u "opro_live_…:oprs_live_…"

# List
curl "${DOCS_BASE}/api/public/pro/charges?status=paid" \\
  -u "opro_live_…:oprs_live_…"`}</DocsCode>
        <p>
          Create response includes <code>checkout_url</code> → redirect the payer there.
        </p>
      </DocsSection>

      <DocsSection id="checkout" eyebrow="6" title="Checkout UX">
        <p>
          Hosted page:{" "}
          <code>
            {DOCS_BASE}/pro/checkout/{"{charge_id}"}
          </code>
          . Signed-in users see amount, merchant branding, balance, and Pay. Insufficient balance
          links to Top Up. After pay, Pro debits the payer and credits the app owner’s OUSD wallet
          (double-pay safe).
        </p>
      </DocsSection>

      <DocsSection id="node" eyebrow="7" title="Copy-paste Node">
        <DocsCode>{`const BASE = "${DOCS_BASE}";
const CLIENT_ID = process.env.PRO_CLIENT_ID;
const CLIENT_SECRET = process.env.PRO_CLIENT_SECRET;

function basic() {
  return "Basic " + Buffer.from(\`\${CLIENT_ID}:\${CLIENT_SECRET}\`).toString("base64");
}

export async function createCharge({ amount, reference, success_url, cancel_url }) {
  const res = await fetch(\`\${BASE}/api/public/pro/charges\`, {
    method: "POST",
    headers: {
      Authorization: basic(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, reference, success_url, cancel_url }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { id, checkout_url, status, expires_at, … }
}

export async function pollCharge(id, { intervalMs = 2000, timeoutMs = 120000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(\`\${BASE}/api/public/pro/charges/\${id}\`, {
      headers: { Authorization: basic() },
    });
    const charge = await res.json();
    if (["paid", "canceled", "expired"].includes(charge.status)) return charge;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("charge_poll_timeout");
}`}</DocsCode>
      </DocsSection>

      <DocsSection id="checklist" eyebrow="8" title="Launch checklist">
        <ul className="list-disc space-y-2 pl-5">
          <li>Connect app created with production redirect URIs</li>
          <li>Client secret only on the server</li>
          <li>Authorize → token exchange → /user/me smoke test</li>
          <li>
            Charge create → checkout → poll to <code>paid</code>
          </li>
          <li>Cancel path tested for abandoned checkouts</li>
          <li>Users know they can revoke access under Developer → Connected apps</li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-2">
          <Pill href="/docs/pro-pay">Related: Pro Pay merchant</Pill>
          <Pill href="/docs/openpay">Related: OpenPay Partner API</Pill>
          <Pill href="/docs/errors">Errors & retries</Pill>
        </div>
      </DocsSection>
    </DocsShell>
  );
}
