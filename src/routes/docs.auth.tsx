import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsCode, DocsSection, DocsShell } from "@/components/docs/DocsShell";
import { Card } from "@/components/ui/card";
import { CONNECT_URL, DOCS_BASE, PARTNER_PORTAL } from "@/lib/docs-nav";

export const Route = createFileRoute("/docs/auth")({
  head: () => ({
    meta: [
      { title: "Authentication Reference — OpenPay Pro" },
      {
        name: "description",
        content:
          "Seven OpenPay Pro sign-in methods plus Connect OAuth for partners — OpenPay, Telegram, Solana, Pi, Phantom, WalletConnect, MetaMask.",
      },
      { property: "og:url", content: `${DOCS_BASE}/docs/auth` },
    ],
    links: [{ rel: "canonical", href: `${DOCS_BASE}/docs/auth` }],
  }),
  component: AuthDocsPage,
});

const SPEECH = `
Authentication reference. OpenPay Pro supports seven sign-in methods on authpi:
OpenPay OAuth, Telegram, Solana, Pi Network, Phantom, WalletConnect, and MetaMask Embedded.
Partners use Connect with OpenPay for third-party apps. All flows end in a Supabase session.
`.trim();

const AUTH_METHODS: { method: string; type: string; backend: string }[] = [
  { method: "OpenPay", type: "OAuth 2.0", backend: "/api/public/openpay-auth" },
  { method: "Telegram", type: "Login Widget · OIDC + PKCE", backend: "/api/public/telegram-auth" },
  { method: "Solana", type: "Sign In With Solana", backend: "/api/public/solana-auth" },
  { method: "Pi Network", type: "Pi SDK / Pi OAuth", backend: "/api/public/pi-auth" },
  { method: "Phantom", type: "Phantom Connect", backend: "/auth/callback" },
  { method: "WalletConnect", type: "EVM SIWE", backend: "/api/public/walletconnect-auth" },
  { method: "MetaMask", type: "Embedded / Web3Auth", backend: "/api/public/web3auth-auth" },
];

function AuthDocsPage() {
  const connectExample = `${CONNECT_URL}?client_id=...&redirect_uri=...&scope=profile%20balance&state=...`;

  return (
    <DocsShell
      title="Authentication"
      description="Seven Pro wallet sign-in methods on /authpi, plus Connect with OpenPay (OAuth) for third-party apps."
      pathname="/docs/auth"
      eyebrow="Reference"
      speechText={SPEECH}
    >
      <Card className="rounded-2xl border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
        Sign-in UI: <code className="text-foreground">{DOCS_BASE}/authpi</code>
        {" · "}
        Deep narrative + env samples:{" "}
        <a href="/docs/openpay#auth" className="font-semibold text-primary hover:underline">
          /docs/openpay#auth
        </a>
        {" · "}
        Raw:{" "}
        <a
          href="/api/public/docs/openpay-auth"
          className="font-semibold text-primary hover:underline"
        >
          /api/public/docs/openpay-auth
        </a>
      </Card>

      <DocsSection id="methods" eyebrow="01" title="Seven Pro sign-in methods">
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Method</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Backend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              {AUTH_METHODS.map((row) => (
                <tr key={row.method}>
                  <td className="px-3 py-2 font-medium text-foreground">{row.method}</td>
                  <td className="px-3 py-2">{row.type}</td>
                  <td className="px-3 py-2">
                    <code className="text-foreground">{row.backend}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          All successful flows end in a <strong className="text-foreground">Supabase</strong>{" "}
          session and redirect to <code className="text-foreground">/dashboard</code> (or your{" "}
          <code className="text-foreground">redirectTo</code>).
        </p>
      </DocsSection>

      <DocsSection id="connect" eyebrow="02" title="Connect with OpenPay (partners)">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Third-party apps do not embed every wallet method — they use{" "}
          <strong className="text-foreground">Connect with OpenPay</strong> so users link an
          openpy.space account.
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            Register an app at{" "}
            <a
              href={PARTNER_PORTAL}
              className="font-semibold text-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Partner portal
            </a>
            ; allowlist exact redirect URIs.
          </li>
          <li>
            Send users to <code className="text-foreground">{connectExample}</code>
          </li>
          <li>
            Exchange <code className="text-foreground">code</code> for{" "}
            <code className="text-foreground">opa_live_...</code> on your server (see{" "}
            <a href="/docs/api#oauth" className="font-semibold text-primary hover:underline">
              /docs/api#oauth
            </a>
            ).
          </li>
        </ol>
        <DocsCode>{`import { startOpenPaySignIn } from "@/lib/openpay-auth"
await startOpenPaySignIn({ redirectTo: "/dashboard" })`}</DocsCode>
      </DocsSection>

      <DocsSection id="env" eyebrow="03" title="Shared server env">
        <DocsCode>{`OPENPAY_AUTH_PASSWORD_SECRET="long-random-string"
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_PUBLISHABLE_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # server only — never VITE_

OPENPAY_OAUTH_AUTHORIZE_URL="https://openpy.space/connect"
OPENPAY_OAUTH_CLIENT_ID="your-client-uuid"
OPENPAY_PARTNER_API_KEY="opk_live_..."`}</DocsCode>
        <p className="text-sm text-muted-foreground">
          Method-specific secrets and Pi / Telegram / Web3Auth knobs are documented in{" "}
          <code className="text-foreground">docs/OPENPAY_PRO_AUTH.md</code>.
        </p>
      </DocsSection>

      <DocsSection id="security" eyebrow="04" title="Security rules">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            Keep <code className="text-foreground">opk_live_</code> and service-role keys on the
            server only.
          </li>
          <li>
            Validate OAuth <code className="text-foreground">state</code> / PKCE where used.
          </li>
          <li>Register exact redirect URIs — no open redirects.</li>
          <li>
            Partners accepting payments: poll charges — see{" "}
            <Link to="/docs/errors" className="font-semibold text-primary hover:underline">
              /docs/errors
            </Link>
            .
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="related" eyebrow="05" title="Related">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            <Link to="/docs/openpay" className="font-semibold text-primary hover:underline">
              Connect and payments (full)
            </Link>
          </li>
          <li>
            <Link to="/docs/mcp" className="font-semibold text-primary hover:underline">
              Agent Connect · MCP OAuth
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
