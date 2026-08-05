import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ExternalLink,
  Fingerprint,
  KeyRound,
  Link2,
  Rocket,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import {
  DocsCallout,
  DocsCard,
  DocsCode,
  DocsSection,
  DocsShell,
} from "@/components/docs/DocsShell";
import {
  CONNECT_URL,
  DOCS_BASE,
  INBOUND_API,
  LEDGER_API_BASE,
  PARTNER_API,
  PARTNER_PORTAL,
} from "@/lib/docs-nav";
import { TOPUP_METHOD_CATALOG } from "@/lib/topup-methods";

export const Route = createFileRoute("/docs/openpay")({
  head: () => ({
    meta: [
      { title: "OpenPay Integration Docs — Connect & Payments" },
      {
        name: "description",
        content:
          "Complete OpenPay Connect OAuth, PayButton charges, payouts, Pro auth methods, inbound top-up, Ledger, and Partner Transfer API for third-party apps.",
      },
      { property: "og:title", content: "OpenPay Integration Docs — Connect & Payments" },
      {
        property: "og:description",
        content: "Developer guide to OpenPay OAuth Connect, payments, payouts, and Pro inbound.",
      },
      { property: "og:url", content: `${DOCS_BASE}/docs/openpay` },
    ],
    links: [{ rel: "canonical", href: `${DOCS_BASE}/docs/openpay` }],
  }),
  component: OpenPayDocsPage,
});

const AUTH_DOCS = "https://openpy.space/openpay-auth";
const PAY_HOST = "https://openpy.space";

const DOCS_SPEECH = `
OpenPay Integration Docs. Connect auth, Pro sign-in methods, and payments.

Add Connect with OpenPay using OAuth 2.0, accept OpenPay balance payments with PayButton charges,
send payouts with Partner transfers, and credit OpenPay Pro wallets with inbound pro_xfer notes.

For merchants, use Pro Pay checkout and QR Pay method openpay_pro so earnings land on a Pro username or wallet.
Buyers who need Pi, Banxa, MoonPay, or wallet majors deep-link into Pro Top Up.

Start at the Partner API portal on openpy.space. Create an app, keep your opk live key on the server,
register exact redirect URIs, then ship Sign in, charges, and transfers.

No partner payment webhooks yet — poll GET charges by id until paid, canceled, or expired.
`.trim();

const TOC = [
  ["#partner-portal", "0. Partner API portal"],
  ["#ai-pack", "AI Partner Pack"],
  ["#pro-pay", "Pro Pay · Merchant"],
  ["#qr-pay", "QR Pay · openpay_pro"],
  ["#topup-methods", "Top Up methods"],
  ["#exchange", "Exchange · OUSD"],
  ["#setup", "1. Partner app setup"],
  ["#connect", "2. Connect (OAuth)"],
  ["#auth", "3. Pro auth methods"],
  ["#pay", "4. Accept payments"],
  ["#transfers", "5. Payouts / transfers"],
  ["#openpay-to-pro", "6. OpenPay → Pro inbound"],
  ["#node", "7. Minimal Node SDK"],
  ["#api", "8. API cheat sheet"],
  ["#ledger", "9. Ledger API"],
  ["#wc-pay", "10. WalletConnect Pay"],
  ["#charges", "11. Charges polling"],
  ["#nft", "12. NFT mint"],
  ["#errors", "13. Errors & checklist"],
  ["#faq", "14. FAQ"],
] as const;

const AUTH_METHODS = [
  {
    name: "OpenPay",
    desc: "OAuth 2.0 Connect — profile + balance scopes",
    endpoint: "GET/POST /api/public/openpay-auth",
    callback: "/auth/openpay/callback",
    env: "OPENPAY_OAUTH_CLIENT_ID · OPENPAY_PARTNER_API_KEY",
  },
  {
    name: "Telegram",
    desc: "Telegram Login OIDC + PKCE (oauth.telegram.org)",
    endpoint: "GET/POST /api/public/telegram-auth",
    callback: "/auth/telegram/callback",
    env: "TELEGRAM_CLIENT_ID · TELEGRAM_CLIENT_SECRET",
  },
  {
    name: "Solana",
    desc: "Sign In With Solana (Phantom / Wallet Standard)",
    endpoint: "GET/POST /api/public/solana-auth",
    callback: "—",
    env: "OPENPAY_AUTH_PASSWORD_SECRET (or SOLANA_…)",
  },
  {
    name: "Pi Network",
    desc: "Pi Browser SDK or Pi OAuth (external browser)",
    endpoint: "POST /api/public/pi-auth",
    callback: "/auth/pi/callback",
    env: "VITE_PI_CLIENT_ID",
  },
  {
    name: "Phantom",
    desc: "Extension · Google · Apple via Phantom Connect",
    endpoint: "Phantom SDK",
    callback: "/auth/callback",
    env: "VITE_PHANTOM_APP_ID (+ Portal allowlists)",
  },
  {
    name: "WalletConnect",
    desc: "EVM SIWE (personal_sign) → Supabase session",
    endpoint: "GET/POST /api/public/walletconnect-auth",
    callback: "—",
    env: "Auth secret · optional WCP Pay keys",
  },
  {
    name: "MetaMask",
    desc: "Embedded Wallets social OAuth (Web3Auth JWKS)",
    endpoint: "POST /api/public/web3auth-auth",
    callback: "Web3Auth modal / social chips",
    env: "VITE_WEB3AUTH_CLIENT_ID · WEB3AUTH_CLIENT_SECRET · JWKS",
  },
] as const;

function copy(text: string, label = "Copied") {
  void copyText(text).then(
    () => toast.success(label),
    () => toast.error("Copy failed"),
  );
}

function Pill({
  children,
  href,
  onClick,
  primary,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  const className = primary
    ? "inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 md:text-base"
    : "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary md:text-base";
  if (href) {
    const external = href.startsWith("http") || href.startsWith("/api/");
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
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

function OpenPayDocsPage() {
  return (
    <DocsShell
      title="Connect, payments & Pro auth"
      description="Complete guide to Connect with OpenPay (OAuth 2.0), PayButton charges, partner payouts, OpenPay → Pro inbound top-up, and every OpenPay Pro wallet sign-in method."
      pathname="/docs/openpay"
      eyebrow="Core guides"
      speechText={DOCS_SPEECH}
    >
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          Third-party apps
        </span>
        <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          Auth · Pay · Top-up
        </span>
        <Pill href={PARTNER_PORTAL} primary>
          <Rocket className="h-3.5 w-3.5" />
          Open Partner API portal
        </Pill>
        <Pill href="#auth">
          <Fingerprint className="h-3.5 w-3.5" />
          Pro auth setup
        </Pill>
        <Pill href="/docs/ai">AI Partner Pack</Pill>
        <Pill href="/docs/pro-pay">Pro Pay · Merchant</Pill>
        <Pill href="/api/public/docs/openpay">Raw Markdown</Pill>
        <Pill onClick={() => copy(PARTNER_API, "API base copied")}>
          <KeyRound className="h-3.5 w-3.5" />
          Copy API base
        </Pill>
      </div>

      <DocsCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Developer portal
            </p>
            <h2 className="mt-1 text-lg font-bold text-foreground">
              Partner API · openpy.space
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an app, copy Client ID + API key, set your domain for redirects, then ship Sign
              in, transfers, or PayButton.
            </p>
          </div>
          <Pill href={AUTH_DOCS}>
            Auth docs
            <ExternalLink className="h-3.5 w-3.5" />
          </Pill>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl bg-muted px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Public site
            </div>
            <a
              href="https://openpy.space"
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block break-all text-sm font-semibold text-foreground underline-offset-2 hover:underline"
            >
              https://openpy.space
            </a>
          </div>
          <div className="rounded-2xl bg-muted px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              API endpoint
            </div>
            <button
              type="button"
              className="mt-0.5 block w-full break-all text-left text-sm font-semibold text-foreground"
              onClick={() => copy(PARTNER_API, "API endpoint copied")}
            >
              {PARTNER_API}
            </button>
          </div>
        </div>
        <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["Step 1", "Register app", "Client ID + opk_ key"],
            ["Step 2", "Add domain", "Auto-fill callbacks"],
            ["Step 3", "Sign in / pay", "Auth · PayButton"],
            ["Step 4", "Go live", "Secrets on server"],
          ].map(([step, title, sub]) => (
            <li
              key={step}
              className="rounded-2xl border border-border bg-background px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {step.replace("Step ", "")}
                </span>
                <div>
                  <div className="font-semibold text-foreground">{title}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </DocsCard>

      <nav className="grid gap-1.5 rounded-3xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
        {TOC.map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-xl px-3 py-2 font-medium text-foreground transition hover:bg-muted"
          >
            {label}
          </a>
        ))}
      </nav>

      <DocsSection id="partner-portal" eyebrow="Portal" title="OpenPay Partner API portal">
        <DocsCard className="space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground">
            Use the official portal to register apps, manage keys, and follow the setup tutorial
            (Auth, Transfers, PayButton, Copy-paste, Reference).
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Portal:{" "}
              <a
                href={PARTNER_PORTAL}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-foreground underline-offset-2 hover:underline"
              >
                {PARTNER_PORTAL}
              </a>
            </li>
            <li>
              Auth tutorial:{" "}
              <a
                href={AUTH_DOCS}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-foreground underline-offset-2 hover:underline"
              >
                {AUTH_DOCS}
              </a>
            </li>
            <li>
              Redirect auto-fill registers{" "}
              <code className="rounded bg-muted px-1 text-foreground">
                /auth/openpay/callback
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1 text-foreground">
                /openpay/connect/callback
              </code>
            </li>
            <li>
              Never put <code className="rounded bg-muted px-1 text-foreground">opk_</code>{" "}
              in the browser — exchange codes on your server only
            </li>
          </ul>
          <Pill href={PARTNER_PORTAL} primary>
            Create app on openpy.space
            <ExternalLink className="h-3.5 w-3.5" />
          </Pill>
        </DocsCard>
      </DocsSection>

      <DocsSection id="ai-pack" eyebrow="AI tools" title="AI Partner Pack">
        <DocsCallout>
          Building with{" "}
          <strong className="text-foreground">
            OpenAI, ChatGPT, Cursor, Lovable, Replit, or Claude
          </strong>
          ? Paste the raw AI guide and OpenAPI into your agent — covers auth, pay, top-up,
          inbound, and ledger.
        </DocsCallout>
        <div className="flex flex-wrap gap-2">
          <Pill href="/docs/ai" primary>
            Open /docs/ai
          </Pill>
          <Pill href="/api/public/docs/ai-partner">Raw AI markdown</Pill>
          <Pill href="/api/public/docs/openapi">OpenAPI YAML</Pill>
          <Pill href="/llms-full.txt">llms-full.txt</Pill>
        </div>
      </DocsSection>

      <DocsSection id="pro-pay" eyebrow="Merchants" title="Pro Pay · Merchant checkout">
        <DocsCallout>
          Third-party apps (and OpenPay) accept payment with OpenPay Pro methods. Charges settle to
          your <strong className="text-foreground">OpenPay partner wallet</strong>; call inbound with{" "}
          <code className="text-foreground">pro_xfer:</code> to credit a Pro{" "}
          <code className="text-foreground">@username</code> /{" "}
          <code className="text-foreground">0x</code>.
        </DocsCallout>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["A · Charges", "POST /charges → PayButton → poll paid"],
            ["B · Inbound", "Credit merchant Pro @user / 0x after paid"],
            ["C · Deep-link", "/topup then /pay/@merchant"],
          ].map(([t, d]) => (
            <DocsCard key={t} className="p-5!">
              <p className="text-lg font-bold text-foreground">{t}</p>
              <p className="mt-2 text-base text-muted-foreground">{d}</p>
            </DocsCard>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill href="/docs/pro-pay" primary>
            Full Pro Pay guide
          </Pill>
          <Pill href="/api/public/docs/pro-pay">Raw Markdown</Pill>
          <Pill href="/docs/pro-pay#methods">Payment methods table</Pill>
        </div>
      </DocsSection>

      <DocsSection id="qr-pay" eyebrow="OpenPay QR" title="QR Pay · method openpay_pro">
        <DocsCard className="space-y-4">
          <p className="text-muted-foreground">
            On OpenPay QR Pay / checkout, add method{" "}
            <code className="text-foreground">openpay_pro</code> so merchants show a QR that pays
            via OpenPay Balance and credits an OpenPay Pro receive wallet.
          </p>
          <DocsCode>{`Method id: openpay_pro
Label:     OpenPay Pro
Settle:    POST /charges → poll paid → POST inbound
Note:      pro_xfer:@shop:r_order_9001
Receive:   @username and/or 0x…`}</DocsCode>
          <div className="flex flex-wrap gap-2">
            <Pill href="/api/public/docs/qrpay-pro" primary>
              QR Pay paste pack
            </Pill>
            <Pill href="/docs/pro-pay#qr-pay">Pro Pay · QR section</Pill>
          </div>
        </DocsCard>
      </DocsSection>

      <DocsSection id="topup-methods" eyebrow="Top Up" title="OpenPay Pro payment methods">
        <DocsCallout>
          Same catalog as Pro <strong className="text-foreground">Top Up → Pay with</strong>. Partners
          deep-link buyers to <code className="text-foreground">/topup</code> — do not embed
          provider API keys in your app.
        </DocsCallout>
        <div className="overflow-x-auto rounded-3xl border border-border bg-card">
          <table className="w-full min-w-lg text-left text-base">
            <thead className="bg-muted text-sm uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {TOPUP_METHOD_CATALOG.map((m) => (
                <tr key={m.method_key}>
                  <td className="px-4 py-3 font-mono text-sm text-foreground">{m.method_key}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">{m.label}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DocsCode>{`# Buyer funds with full Pro methods, then pays merchant
https://openpaypro.space/topup
https://openpaypro.space/pay/@shop?amount=250&asset=OUSD&note=order_9001`}</DocsCode>
      </DocsSection>

      <DocsSection id="exchange" eyebrow="Exchanges" title="List OUSD on OpenPay Network">
        <DocsCard className="space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground">
            Exchanges integrate <strong>OUSD</strong> as a network asset: network id{" "}
            <code className="rounded bg-muted px-1">openpay</code>, Partner Transfer for
            deposit / withdraw, Pro inbound for Pro wallets, Ledger for audit. OUSD is a ledger
            dollar (no public ERC-20 mint).
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill href="/docs/exchange" primary>
              Exchange docs
            </Pill>
            <Pill href="/api/public/docs/exchange">Raw markdown</Pill>
          </div>
        </DocsCard>
      </DocsSection>

      <DocsSection id="setup" eyebrow="Step 1" title="Create a partner app">
        <DocsCard className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5 text-foreground">
            <li>
              Open{" "}
              <a
                href={PARTNER_PORTAL}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline-offset-2 hover:underline"
              >
                Apps &amp; keys
              </a>{" "}
              → Register app.
            </li>
            <li>
              Copy the <code className="rounded bg-muted px-1">opk_live_…</code> API key
              immediately (shown once). Save the Client ID (UUID).
            </li>
            <li>
              Enter only your domain (e.g.{" "}
              <code className="rounded bg-muted px-1">www.yourapp.com</code>) and click{" "}
              <strong>Auto-fill &amp; save</strong> for redirect URIs.
            </li>
            <li>
              Or register exact URIs manually, e.g.{" "}
              <code className="rounded bg-muted px-1">
                https://yourapp.com/openpay/callback
              </code>
            </li>
          </ol>
          <DocsCode>{`OPENPAY_CLIENT_ID="your-client-uuid"
OPENPAY_PARTNER_API_KEY="opk_live_..."
OPENPAY_PARTNER_API_BASE="${PARTNER_API}"
OPENPAY_REDIRECT_URI="https://yourapp.com/openpay/callback"`}</DocsCode>
          <p>Never expose the partner API key in the browser — backend only.</p>
        </DocsCard>
      </DocsSection>

      <DocsSection id="connect" eyebrow="Step 2" title="Connect with OpenPay">
        <DocsCallout>
          Authorization Code flow. Scopes: <code className="text-foreground">profile</code>,{" "}
          <code className="text-foreground">balance</code>. User lands on Authorize, signs
          in, Allow → your callback receives <code className="text-foreground">opc_…</code>.
        </DocsCallout>

        <p className="text-sm font-semibold text-foreground">Authorize URL</p>
        <DocsCode>{`${CONNECT_URL}
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/openpay/callback
  &scope=profile%20balance
  &state=RANDOM_CSRF_TOKEN`}</DocsCode>

        <p className="text-sm font-semibold text-foreground">Drop-in Connect button</p>
        <DocsCode>{`<a href="${CONNECT_URL}?client_id=YOUR_CLIENT_ID&redirect_uri=https://yourapp.com/openpay/callback&scope=profile%20balance&state=xyz"
   style="display:inline-flex;align-items:center;gap:8px;background:#1652f0;color:#fff;
   padding:12px 20px;border-radius:10px;font-weight:600;text-decoration:none;">
  Connect with OpenPay
</a>`}</DocsCode>

        <p className="text-sm font-semibold text-foreground">Callback</p>
        <DocsCode>{`# Success
https://yourapp.com/openpay/callback?code=opc_...&state=...

# Cancel
https://yourapp.com/openpay/callback?error=access_denied

# Verify state matches what you stored`}</DocsCode>

        <p className="text-sm font-semibold text-foreground">Exchange code (server)</p>
        <DocsCode>{`curl -X POST "${PARTNER_API}/oauth/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "authorization_code",
    "code": "opc_...",
    "redirect_uri": "https://yourapp.com/openpay/callback",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "opk_live_YOUR_KEY"
  }'`}</DocsCode>

        <p className="text-sm font-semibold text-foreground">User APIs (Bearer opa_live_…)</p>
        <DocsCode>{`curl -H "Authorization: Bearer opa_live_..." ${PARTNER_API}/user/me
curl -H "Authorization: Bearer opa_live_..." ${PARTNER_API}/user/balance`}</DocsCode>

        <DocsCode>{`# Typical /user/me response
{
  "user_id": "...",
  "account_number": "OP...",
  "full_name": "...",
  "username": "...",
  "avatar_url": "...",
  "balance": 12.34,
  "currency": "OUSD",
  "scope": "profile balance"
}`}</DocsCode>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
          Codes expire in 10 minutes (single-use) · access tokens last 30 days
        </div>
      </DocsSection>

      <DocsSection id="auth" eyebrow="Step 3" title="OpenPay Pro — all sign-in methods">
        <DocsCallout>
          Exact setup for every method on{" "}
          <Link to="/authpi" className="font-semibold text-foreground underline-offset-2 hover:underline">
            /authpi
          </Link>
          . Full Markdown:{" "}
          <a
            href="/api/public/docs/openpay-auth"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-foreground underline-offset-2 hover:underline"
          >
            /api/public/docs/openpay-auth
          </a>{" "}
          · live page{" "}
          <Link to="/docs/auth" className="font-semibold text-foreground underline-offset-2 hover:underline">
            /docs/auth
          </Link>
          .
        </DocsCallout>

        <div className="grid gap-3 sm:grid-cols-2">
          {AUTH_METHODS.map((m) => (
            <DocsCard key={m.name} className="space-y-2 !p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-foreground">{m.name}</h3>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  /authpi
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{m.desc}</p>
              <dl className="space-y-1 text-[11px]">
                <div>
                  <dt className="text-muted-foreground">API</dt>
                  <dd className="break-all font-mono text-foreground">{m.endpoint}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Callback</dt>
                  <dd className="font-mono text-foreground">{m.callback}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Env</dt>
                  <dd className="text-foreground">{m.env}</dd>
                </div>
              </dl>
            </DocsCard>
          ))}
        </div>

        <p className="text-sm font-semibold text-foreground">Shared server secrets</p>
        <DocsCode>{`OPENPAY_AUTH_PASSWORD_SECRET="long-random-string"
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_PUBLISHABLE_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # server only — admin.createUser`}</DocsCode>

        <p className="text-sm font-semibold text-foreground">MetaMask Embedded (Web3Auth)</p>
        <DocsCode>{`VITE_WEB3AUTH_CLIENT_ID="your-client-id"
WEB3AUTH_CLIENT_ID="your-client-id"
WEB3AUTH_CLIENT_SECRET="your-secret"   # never VITE_
WEB3AUTH_JWKS_URL="https://api-auth.web3auth.io/.well-known/jwks.json"`}</DocsCode>

        <p className="text-sm font-semibold text-foreground">Phantom Portal</p>
        <DocsCode>{`VITE_PHANTOM_APP_ID="your-app-id"
# Allowlist each origin + /auth/callback in Phantom Portal`}</DocsCode>

        <p className="text-sm font-semibold text-foreground">Client starters</p>
        <DocsCode>{`import { startOpenPaySignIn } from "@/lib/openpay-auth"
import { startSolanaSignIn } from "@/lib/solana-auth"
import { startWalletConnectSignIn } from "@/lib/walletconnect-auth"
import { signInWithPi } from "@/lib/pi-network"

await startOpenPaySignIn({ redirectTo: "/dashboard" })
await startSolanaSignIn({ redirectTo: "/dashboard" })
await startWalletConnectSignIn({ redirectTo: "/dashboard" })`}</DocsCode>

        <DocsCard className="space-y-2 text-sm">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Security
          </div>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              Never expose <code className="text-foreground">opk_</code>,{" "}
              <code className="text-foreground">wcp_</code>,{" "}
              <code className="text-foreground">WEB3AUTH_CLIENT_SECRET</code>, or service
              role in the browser
            </li>
            <li>
              Verify OAuth <code className="text-foreground">state</code> on every callback
            </li>
            <li>
              Web3Auth: always check JWT <code className="text-foreground">aud</code> = your
              Client ID
            </li>
            <li>Verify Solana / SIWE signatures server-side before issuing credentials</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Pill href="/authpi" primary>
              Open /authpi
            </Pill>
            <Pill href="/docs/auth">Auth reference</Pill>
            <Pill href="/api/public/docs/openpay-auth">Full auth Markdown</Pill>
          </div>
        </DocsCard>
      </DocsSection>

      <DocsSection id="pay" eyebrow="Step 4" title="Accept OpenPay balance payments">
        <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-4">
          <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            Buyer pays from their OpenPay wallet. Funds credit your partner-app owner. Prefer
            PayButton <code className="text-foreground">/charges</code>; use{" "}
            <code className="text-foreground">/pay/@username</code> for hosted tag payments.
          </p>
        </div>

        <p className="text-sm font-semibold text-foreground">A · PayButton charge</p>
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
# → { id, checkout_url, status, expires_at }  · TTL 2 hours
# → redirect buyer to checkout_url or ${PAY_HOST}/paybutton/CHARGE_ID`}</DocsCode>

        <p className="text-sm font-semibold text-foreground">Poll / cancel</p>
        <DocsCode>{`# Status: created | paid | canceled | expired
curl -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  ${PARTNER_API}/charges/CHARGE_ID

curl -X POST -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  ${PARTNER_API}/charges/CHARGE_ID/cancel

# List
curl -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  "${PARTNER_API}/charges?status=paid"`}</DocsCode>

        <p className="text-sm font-semibold text-foreground">B · Hosted pay tag</p>
        <DocsCode>{`${PAY_HOST}/pay/YOUR_USERNAME
  ?amount=25.00
  &currency=OUSD
  &note=order_1234
  &success_url=https://yourapp.com/thanks
  &cancel_url=https://yourapp.com/cart

# Success return: ?openpay_return=1&openpay_ref=order_1234&openpay_tx=...
# Cancel return:  ?openpay_cancel=1`}</DocsCode>

        <DocsCard className="text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Pay flow</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Open pay link → amount + note</li>
            <li>Pay → balance check → debit OUSD → thank-you</li>
            <li>
              Redirect to your <code className="text-foreground">success_url</code>
            </li>
            <li>Backend verifies <code className="text-foreground">paid</code>, then fulfills</li>
          </ol>
        </DocsCard>
      </DocsSection>

      <DocsSection id="transfers" eyebrow="Step 5" title="Payouts — Partner transfers">
        <DocsCallout>
          Debits the key owner’s OpenPay balance and credits the recipient. Always send{" "}
          <code className="text-foreground">Idempotency-Key</code>. Prefer{" "}
          <code className="text-foreground">OP…</code> account numbers over{" "}
          <code className="text-foreground">@username</code>.
        </DocsCallout>
        <DocsCode>{`# Resolve account
curl -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  ${PARTNER_API}/accounts/@satoshi

# Send payout
curl -X POST "${PARTNER_API}/transfers" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"to":"OP...","amount":10.00,"note":"Payout"}'

# Partner treasury
curl -H "Authorization: Bearer opk_live_YOUR_KEY" ${PARTNER_API}/me
curl -H "Authorization: Bearer opk_live_YOUR_KEY" ${PARTNER_API}/balance`}</DocsCode>
      </DocsSection>

      <DocsSection id="openpay-to-pro" eyebrow="Step 6" title="OpenPay → OpenPay Pro (inbound / top-up)">
        <DocsCard className="space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground">
            Credit a Pro wallet after an OpenPay payment using note routing + inbound API.
          </p>
          <p>
            Note:{" "}
            <code className="rounded bg-muted px-1 text-foreground">
              pro_xfer:@alice:r_ref
            </code>{" "}
            or{" "}
            <code className="rounded bg-muted px-1 text-foreground">
              pro_xfer:0x…:r_ref
            </code>
          </p>
          <DocsCode>{`curl -X POST "${INBOUND_API}" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "@alice",
    "amount": 25,
    "openpay_tx_id": "UNIQUE_TX_ID",
    "note": "pro_xfer:@alice:r_1",
    "from_username": "bob"
  }'`}</DocsCode>
          <p>
            Idempotent on <code className="text-foreground">openpay_tx_id</code>. Pro users
            can also <strong className="text-foreground">Receive → Create OpenPay receive link</strong>.
            Product deep-link:{" "}
            <Link to="/topup" className="font-semibold text-foreground underline-offset-2 hover:underline">
              /topup
            </Link>
            .
          </p>
          <Pill href="/api/public/docs/openpay-to-pro">Inbound markdown</Pill>
        </DocsCard>
      </DocsSection>

      <DocsSection id="node" eyebrow="Step 7" title="Minimal Node example">
        <DocsCode>{`const API = process.env.OPENPAY_PARTNER_API_BASE || "${PARTNER_API}";
const KEY = process.env.OPENPAY_PARTNER_API_KEY; // opk_live_…
const CLIENT_ID = process.env.OPENPAY_CLIENT_ID;
const REDIRECT = process.env.OPENPAY_REDIRECT_URI;

export function connectUrl(state) {
  const u = new URL("${CONNECT_URL}");
  u.searchParams.set("client_id", CLIENT_ID);
  u.searchParams.set("redirect_uri", REDIRECT);
  u.searchParams.set("scope", "profile balance");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeCode(code) {
  const res = await fetch(\`\${API}/oauth/token\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      client_id: CLIENT_ID,
      client_secret: KEY,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { access_token: "opa_live_...", ... }
}

export async function createCharge({ amount, reference, success_url, cancel_url }) {
  const res = await fetch(\`\${API}/charges\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "OUSD",
      description: reference,
      reference,
      success_url,
      cancel_url,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { id, checkout_url, ... }
}

export async function transfer({ to, amount, note, idempotencyKey }) {
  const res = await fetch(\`\${API}/transfers\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${KEY}\`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ to, amount, note }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}`}</DocsCode>
      </DocsSection>

      <DocsSection id="api" eyebrow="Step 8" title="API cheat sheet">
        <div className="overflow-x-auto rounded-3xl border border-border bg-card">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Path</th>
                <th className="px-4 py-3">Auth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["GET", "/me", "opk_"],
                ["GET", "/balance", "opk_"],
                ["GET", "/accounts/:id", "opk_"],
                ["POST", "/transfers", "opk_ + Idempotency-Key"],
                ["GET", "/transfers", "opk_"],
                ["POST", "/charges", "opk_"],
                ["GET", "/charges/:id", "opk_"],
                ["GET", "/charges?status=", "opk_"],
                ["POST", "/charges/:id/cancel", "opk_"],
                ["POST", "/oauth/token", "body client_secret"],
                ["GET", "/user/me", "opa_"],
                ["GET", "/user/balance", "opa_"],
                ["POST", "/api/public/openpay/inbound", "opk_ / opdk_ (Pro)"],
              ].map(([m, p, a]) => (
                <tr key={String(p)}>
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground">{m}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground">{p}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Base: <code className="break-all text-foreground">{PARTNER_API}</code>
          <br />
          Full reference:{" "}
          <Link to="/docs/api" className="font-semibold text-foreground underline-offset-2 hover:underline">
            /docs/api
          </Link>{" "}
          · OpenAPI:{" "}
          <a
            href="/api/public/docs/openapi"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-foreground underline-offset-2 hover:underline"
          >
            /api/public/docs/openapi
          </a>
        </p>
      </DocsSection>

      <DocsSection id="ledger" eyebrow="Step 9" title="Public Ledger API">
        <DocsCard className="space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground">
            Append-only public ledger of OpenPay Pro transactions. Auth with{" "}
            <code className="rounded bg-muted px-1 text-foreground">x-api-key</code>{" "}
            or <code className="rounded bg-muted px-1 text-foreground">Authorization: Bearer</code>.
          </p>
          <DocsCode>{`GET ${LEDGER_API_BASE}/entries?limit=50&asset=OUSD&type=buy
x-api-key: YOUR_LEDGER_KEY`}</DocsCode>
          <p>
            Types: send · receive · buy · sell · swap · mint · reward. Docs:{" "}
            <Link to="/docs/ledger" className="font-semibold text-foreground underline-offset-2 hover:underline">
              /docs/ledger
            </Link>
            .
          </p>
        </DocsCard>
      </DocsSection>

      <DocsSection id="wc-pay" eyebrow="Step 10" title="WalletConnect Pay">
        <DocsCard className="space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground">
            Pro can pay WalletConnect Pay merchant links from the in-app scanner (
            <code className="rounded bg-muted px-1">/scan</code> →{" "}
            <code className="rounded bg-muted px-1">/wc-pay</code>).
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Merchant creates a WC Pay link via WalletConnect Pay Merchant API</li>
            <li>User scans QR or opens the link in Pro</li>
            <li>
              Requires server env{" "}
              <code className="rounded bg-muted px-1 text-foreground">
                WALLETCONNECT_PAY_API_KEY
              </code>
            </li>
          </ul>
          <p>
            This is a <strong className="text-foreground">payer</strong> integration inside
            Pro — not a partner webhook.
          </p>
        </DocsCard>
      </DocsSection>

      <DocsSection id="charges" eyebrow="Step 11" title="Charges polling (no partner webhooks)">
        <DocsCard className="space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground">
            Confirm payments by <strong>polling</strong>{" "}
            <code className="rounded bg-muted px-1">GET /charges/:id</code>. There is no
            partner-facing payment webhook today.
          </p>
          <DocsCode>{`GET ${PARTNER_API}/charges/CHARGE_ID
Authorization: Bearer opk_live_YOUR_KEY

# Fulfill only when status === "paid"`}</DocsCode>
          <p>
            Internal webhooks (MoonPay, KYC, Circle) power Pro itself and are{" "}
            <strong className="text-foreground">not</strong> exposed to third-party apps.
          </p>
        </DocsCard>
      </DocsSection>

      <DocsSection id="nft" eyebrow="Step 12" title="OpenNFT mint (high level)">
        <DocsCard className="space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground">
            Pro users mint collectibles on OpenPay OpenNFT via a connected OpenPay account (Settings
            → Connect OpenPay). Marketplace:{" "}
            <a
              href="https://openpy.space/web3/nft"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-foreground underline-offset-2 hover:underline"
            >
              openpy.space/web3/nft
            </a>
            .
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>User must link OpenPay OAuth in Pro first</li>
            <li>Mint calls OpenPay partner NFT APIs server-side</li>
            <li>
              Ledger type <code className="rounded bg-muted px-1 text-foreground">mint</code>{" "}
              is recorded on the Pro Ledger API
            </li>
          </ul>
        </DocsCard>
      </DocsSection>

      <DocsSection id="errors" eyebrow="Step 13" title="Errors & launch checklist">
        <DocsCard className="space-y-2 text-sm">
          <p>
            <strong className="text-foreground">401 / invalid_client</strong> — bad or
            quoted <code className="rounded bg-muted px-1">opk_live_…</code> / wrong
            client_id
          </p>
          <p>
            <strong className="text-foreground">redirect_uri not registered</strong> — must
            match allowlist exactly
          </p>
          <p>
            <strong className="text-foreground">403</strong> — origin not whitelisted
          </p>
          <p>
            <strong className="text-foreground">400</strong> — validation, insufficient
            balance
          </p>
          <p>
            <strong className="text-foreground">Scopes</strong> — Connect uses{" "}
            <code className="rounded bg-muted px-1">profile</code> and{" "}
            <code className="rounded bg-muted px-1">balance</code>
          </p>
        </DocsCard>
        <ul className="space-y-2 text-sm">
          {[
            "Partner app + secrets on server only (openpy.space/partner-api)",
            "Redirect URIs registered (exact match)",
            "Connect → token → store opa_live_ server-side",
            "Charges or /pay/@tag with success/cancel URLs",
            "Poll until paid; transfers use Idempotency-Key",
            "Inbound (if used) unique openpay_tx_id + pro_xfer note",
          ].map((item) => (
            <li key={item} className="flex gap-2 text-foreground">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
        <Pill href="/docs/errors">Errors & retries reference</Pill>
      </DocsSection>

      <DocsSection id="faq" eyebrow="FAQ" title="OpenPay Pro FAQ">
        <DocsCard className="space-y-4 text-sm">
          <div>
            <p className="font-semibold text-foreground">How do I connect OpenPay to Pro?</p>
            <p className="mt-1 text-muted-foreground">
              Settings → Connected → Connect OpenPay (OAuth). You can then send/receive via OpenPay
              balance and mint OpenNFTs.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Where do trade fees go?</p>
            <p className="mt-1 text-muted-foreground">
              Platform fees credit the admin fee wallet — typically{" "}
              <code className="rounded bg-muted px-1">@openpay</code>.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Where do merchants receive Pro earnings?</p>
            <p className="mt-1 text-muted-foreground">
              Use{" "}
              <a
                href="/docs/pro-pay"
                className="font-semibold text-foreground underline-offset-2 hover:underline"
              >
                /docs/pro-pay
              </a>{" "}
              — charges → inbound with <code className="rounded bg-muted px-1">pro_xfer:</code> to{" "}
              <code className="rounded bg-muted px-1">@username</code> /{" "}
              <code className="rounded bg-muted px-1">0x</code>. QR Pay method:{" "}
              <code className="rounded bg-muted px-1">openpay_pro</code>.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Is there a partner webhook?</p>
            <p className="mt-1 text-muted-foreground">
              Not yet — poll <code className="rounded bg-muted px-1">GET /charges/:id</code>{" "}
              after payment return.
            </p>
          </div>
          <Pill href="/docs/faq">Full FAQ</Pill>
        </DocsCard>
      </DocsSection>

      <footer className="border-t border-border pt-6 text-xs text-muted-foreground">
        <p>
          Integration: <code className="text-foreground">docs/OPENPAY_INTEGRATION.md</code>{" "}
          · Auth: <code className="text-foreground">docs/OPENPAY_PRO_AUTH.md</code> · Merchants:{" "}
          <a
            href="/docs/pro-pay"
            className="font-semibold text-foreground underline-offset-2 hover:underline"
          >
            /docs/pro-pay
          </a>{" "}
          · AI pack:{" "}
          <Link to="/docs/ai" className="font-semibold text-foreground underline-offset-2 hover:underline">
            /docs/ai
          </Link>{" "}
          · Partner portal:{" "}
          <a
            href={PARTNER_PORTAL}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-foreground underline-offset-2 hover:underline"
          >
            openpy.space/partner-api
          </a>
          .
        </p>
      </footer>
    </DocsShell>
  );
}
