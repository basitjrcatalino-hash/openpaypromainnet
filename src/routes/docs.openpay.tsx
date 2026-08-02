import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  BookOpen,
  Copy,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Link2,
  Moon,
  Rocket,
  ShieldCheck,
  Sun,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageListenButton } from "@/components/page-listen-button";
import { useTheme } from "@/components/theme-provider";

export const Route = createFileRoute("/docs/openpay")({
  head: () => ({
    meta: [
      { title: "OpenPay Integration Docs — Connect & Payments" },
      {
        name: "description",
        content:
          "Add Connect with OpenPay (OAuth) and OpenPay Balance payments to any third-party app. Partner API portal: openpy.space/partner-api.",
      },
      { property: "og:title", content: "OpenPay Integration Docs — Connect & Payments" },
      {
        property: "og:description",
        content: "Developer guide to OpenPay OAuth Connect and OpenPay Balance payments.",
      },
      { property: "og:url", content: "https://openpaypro.space/docs/openpay" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/docs/openpay" }],
  }),
  component: OpenPayDocsPage,
});

const API = "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api";
const CONNECT = "https://openpy.space/connect";
const PAY_HOST = "https://openpy.space";
const PARTNER_PORTAL = "https://openpy.space/partner-api";
const AUTH_DOCS = "https://openpy.space/openpay-auth";

const DOCS_SPEECH = `
OpenPay Integration Docs. Connect auth, Pro sign-in methods, and payments.

This guide helps third-party apps add Connect with OpenPay using OAuth 2.0, integrate every OpenPay Pro wallet auth method — Solana, Phantom, Pi, WalletConnect, and MetaMask Embedded — and accept OpenPay balance payments.

Start at the Partner API portal on openpy.space slash partner-api. Create an app, copy your Client ID and API key, set your domain for redirects, then ship Sign in, transfers, or PayButton.

Connect with OpenPay is the OAuth flow that links a user’s openpy.space account so your app can act with their consent.

OpenPay Pro also supports wallet-native sign-in: Solana and Phantom, Pi Network, WalletConnect, and MetaMask Embedded — so users can open a Pro wallet without only relying on OpenPay OAuth.

Payments: create a charge through the Partner Transfer API, send the user to OpenPay checkout, then poll charge status after they return. Webhooks for partners are not available yet — poll GET charges by id.

OpenPay to Pro inbound transfers use a pro_xfer note so funds credit the correct Pro wallet.

Security: keep API keys server-side, validate redirects against your registered domain, and never expose secrets in the browser.

For full code samples, auth setup, Ledger API notes, NFT minting, and WalletConnect Pay, read the sections on this page or the raw Markdown docs linked from the header.
`.trim();

function copy(text: string, label = "Copied") {
  void copyText(text).then(
    () => toast.success(label),
    () => toast.error("Copy failed"),
  );
}

function Code({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-2xl border border-border bg-muted/50 p-4 text-[11px] leading-relaxed text-foreground md:text-xs">
        <code>{children.trim()}</code>
      </pre>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="absolute right-2 top-2 h-7 rounded-full border-border bg-background/80 text-[10px] backdrop-blur"
        onClick={() => copy(children.trim())}
      >
        <Copy className="mr-1 h-3 w-3" />
        Copy
      </Button>
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground md:text-2xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function OpenPayDocsPage() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <BookOpen className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <Link to="/docs" className="block truncate text-[11px] font-semibold text-primary hover:underline">
                Developer Portal
              </Link>
              <span className="truncate text-sm font-semibold">OpenPay Integration Docs</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <PageListenButton
              id="page:docs-openpay"
              text={DOCS_SPEECH}
              label="Listen"
              stopLabel="Stop"
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden rounded-full sm:inline-flex"
            >
              <a href={PARTNER_PORTAL} target="_blank" rel="noreferrer">
                Partner API
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/settings">Open Pro</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-12 px-4 py-10">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full">
              Third-party apps
            </Badge>
            <Badge variant="outline" className="rounded-full border-border">
              Theme follows dashboard
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Connect auth, Pro sign-in methods &amp; payments
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Add <strong className="text-foreground">Connect with OpenPay</strong> (OAuth 2.0),
            integrate every{" "}
            <strong className="text-foreground">OpenPay Pro wallet auth method</strong> (Solana,
            Phantom, Pi, WalletConnect, MetaMask Embedded), and accept{" "}
            <strong className="text-foreground">OpenPay balance</strong> payments. Live developer
            portal:{" "}
            <a
              href={PARTNER_PORTAL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              openpy.space/partner-api
            </a>
            .
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <PageListenButton
              id="page:docs-openpay"
              text={DOCS_SPEECH}
              label="Listen to docs"
              stopLabel="Stop"
              variant="primary"
              size="sm"
              className="sm:hidden"
            />
            <Button asChild size="sm" className="rounded-full">
              <a href={PARTNER_PORTAL} target="_blank" rel="noreferrer">
                <Rocket className="mr-1.5 h-3.5 w-3.5" />
                Open Partner API portal
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <a href="#auth">
                <Fingerprint className="mr-1.5 h-3.5 w-3.5" />
                Pro auth setup
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <a href="/api/public/docs/openpay" target="_blank" rel="noreferrer">
                Raw Markdown
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <a href="/api/public/docs/openpay-auth" target="_blank" rel="noreferrer">
                Auth Markdown
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => copy(API, "API base copied")}
            >
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              Copy API base
            </Button>
          </div>
        </div>

        <Card className="space-y-4 rounded-3xl border-border bg-card p-5 shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Developer portal
              </p>
              <h2 className="mt-1 text-lg font-bold">Partner API · openpy.space</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an app, copy Client ID + API key, set your domain for redirects, then ship
                Sign in, transfers, or PayButton.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-full shrink-0">
              <a href={AUTH_DOCS} target="_blank" rel="noreferrer">
                Auth docs
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl bg-muted/60 px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Public site
              </div>
              <a
                href="https://openpy.space"
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 block break-all text-sm font-medium text-primary"
              >
                https://openpy.space
              </a>
            </div>
            <div className="rounded-2xl bg-muted/60 px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                API endpoint
              </div>
              <button
                type="button"
                className="mt-0.5 block w-full break-all text-left text-sm font-medium text-primary press"
                onClick={() => copy(API, "API endpoint copied")}
              >
                {API}
              </button>
            </div>
          </div>
          <ol className="grid gap-2 text-sm sm:grid-cols-2">
            {[
              ["Step 1", "Register app", "Client ID + opk_ key"],
              ["Step 2", "Add domain", "Auto-fill callbacks"],
              ["Step 3", "Sign in / pay", "Auth · PayButton"],
              ["Step 4", "Go live", "Secrets on server"],
            ].map(([step, title, sub]) => (
              <li
                key={step}
                className="rounded-2xl border border-border bg-background/60 px-3 py-2.5"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {step}
                </div>
                <div className="font-semibold text-foreground">{title}</div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </li>
            ))}
          </ol>
        </Card>

        <nav className="grid gap-2 rounded-3xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
          {[
            ["#partner-portal", "0. Partner API portal"],
            ["#exchange", "Exchange · OUSD network"],
            ["#setup", "1. Partner app setup"],
            ["#connect", "2. Connect (OAuth)"],
            ["#auth", "3. Pro auth methods (full)"],
            ["#pay", "4. Accept payments"],
            ["#openpay-to-pro", "5. OpenPay → Pro"],
            ["#api", "6. API cheat sheet"],
            ["#ledger", "7. Ledger API"],
            ["#wc-pay", "8. WalletConnect Pay"],
            ["#charges", "9. Charges & webhooks"],
            ["#nft", "10. NFT mint"],
            ["#errors", "11. Errors & checklist"],
            ["#faq", "12. FAQ"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-xl px-3 py-2 text-foreground hover:bg-muted"
            >
              {label}
            </a>
          ))}
        </nav>

        <Section id="partner-portal" eyebrow="Portal" title="OpenPay Partner API portal">
          <Card className="space-y-3 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <p className="text-foreground">
              Use the official portal to register apps, manage keys, and follow the smooth setup
              tutorial (Auth, Transfers, PayButton, Copy-paste, Reference).
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Portal:{" "}
                <a
                  href={PARTNER_PORTAL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline-offset-2 hover:underline"
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
                  className="font-medium text-primary underline-offset-2 hover:underline"
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
                Never put <code className="rounded bg-muted px-1 text-foreground">opk_</code> in the
                browser — exchange codes on your server only
              </li>
            </ul>
            <Button asChild className="rounded-full">
              <a href={PARTNER_PORTAL} target="_blank" rel="noreferrer">
                Create app on openpy.space
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          </Card>
        </Section>

        <Section id="exchange" eyebrow="Exchanges" title="List OUSD on OpenPay Network">
          <Card className="space-y-3 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <p className="text-foreground">
              Exchanges and wallets integrate <strong>OUSD</strong> like another network asset:
              network id <code className="rounded bg-muted px-1">openpay</code>, Partner Transfer
              for deposit / withdraw, Pro inbound for Pro wallets, Ledger for audit. OUSD is a
              ledger dollar (no public ERC-20 mint).
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Live guide:{" "}
                <Link
                  to="/docs/exchange"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  /docs/exchange
                </Link>
              </li>
              <li>
                Raw markdown:{" "}
                <a
                  href="/api/public/docs/exchange"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  /api/public/docs/exchange
                </a>
              </li>
              <li>
                Wiki:{" "}
                <Link
                  to="/wiki/$slug"
                  params={{ slug: "ousd-exchange-integration" }}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Integrate OUSD on OpenPay Network
                </Link>
              </li>
            </ul>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/docs/exchange">Open exchange integration docs</Link>
            </Button>
          </Card>
        </Section>

        <Section id="setup" eyebrow="Step 1" title="Create a partner app">
          <Card className="space-y-3 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <ol className="list-decimal space-y-2 pl-5 text-foreground">
              <li>
                Open{" "}
                <a
                  href={PARTNER_PORTAL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
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
                <code className="rounded bg-muted px-1">https://yourapp.com/openpay/callback</code>
              </li>
            </ol>
            <p>Never expose the partner API key in the browser — backend only.</p>
          </Card>
        </Section>

        <Section id="connect" eyebrow="Step 2" title="Connect with OpenPay">
          <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              Authorization Code flow. Scopes: <code className="text-foreground">profile</code>,{" "}
              <code className="text-foreground">balance</code>. User lands on the Authorize screen,
              signs in, Allow → your callback receives{" "}
              <code className="text-foreground">opc_…</code>.
            </p>
          </div>

          <p className="text-sm font-medium text-foreground">Authorize URL</p>
          <Code>{`${CONNECT}
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/openpay/callback
  &scope=profile%20balance
  &state=RANDOM_CSRF_TOKEN`}</Code>

          <p className="text-sm font-medium text-foreground">Exchange code (server)</p>
          <Code>{`curl -X POST "${API}/oauth/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "authorization_code",
    "code": "opc_...",
    "redirect_uri": "https://yourapp.com/openpay/callback",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "opk_live_YOUR_KEY"
  }'`}</Code>

          <p className="text-sm font-medium text-foreground">User APIs (Bearer opa_live_…)</p>
          <Code>{`curl -H "Authorization: Bearer opa_live_..." ${API}/user/me
curl -H "Authorization: Bearer opa_live_..." ${API}/user/balance`}</Code>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" />
            Codes expire in 10 minutes · access tokens last 30 days
          </div>
        </Section>

        <Section id="auth" eyebrow="Step 3" title="OpenPay Pro — all sign-in methods">
          <Card className="space-y-3 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <div className="flex items-start gap-3">
              <Fingerprint className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-foreground">
                  Exact setup for every method on{" "}
                  <Link
                    to="/authpi"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    /authpi
                  </Link>
                  . Full Markdown:{" "}
                  <a
                    href="/api/public/docs/openpay-auth"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    /api/public/docs/openpay-auth
                  </a>{" "}
                  · source <code className="text-foreground">docs/OPENPAY_PRO_AUTH.md</code>.
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
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
            ].map((m) => (
              <Card
                key={m.name}
                className="space-y-2 rounded-3xl border-border bg-card p-4 shadow-none"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{m.name}</h3>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    /authpi
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
                <dl className="space-y-1 text-[11px]">
                  <div>
                    <dt className="text-muted-foreground">API</dt>
                    <dd className="font-mono text-foreground break-all">{m.endpoint}</dd>
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
              </Card>
            ))}
          </div>

          <p className="text-sm font-medium text-foreground">Shared server secrets</p>
          <Code>{`OPENPAY_AUTH_PASSWORD_SECRET="long-random-string"
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_PUBLISHABLE_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # server only — admin.createUser`}</Code>

          <p className="text-sm font-medium text-foreground">MetaMask Embedded (Web3Auth)</p>
          <Code>{`VITE_WEB3AUTH_CLIENT_ID="your-client-id"
WEB3AUTH_CLIENT_ID="your-client-id"
WEB3AUTH_CLIENT_SECRET="your-secret"   # never VITE_
WEB3AUTH_JWKS_URL="https://api-auth.web3auth.io/.well-known/jwks.json"
# Enable Google / X / Apple / GitHub / Discord / Facebook in developer.metamask.io`}</Code>

          <p className="text-sm font-medium text-foreground">Phantom Portal</p>
          <Code>{`VITE_PHANTOM_APP_ID="your-app-id"
# Allowlist each origin + /auth/callback in Phantom Portal
# https://your.domain
# https://your.domain/auth/callback
# http://localhost:PORT (+ /auth/callback)`}</Code>

          <p className="text-sm font-medium text-foreground">Client starters</p>
          <Code>{`import { startOpenPaySignIn } from "@/lib/openpay-auth"
import { startSolanaSignIn } from "@/lib/solana-auth"
import { startWalletConnectSignIn } from "@/lib/walletconnect-auth"
import { signInWithPi } from "@/lib/pi-network"

await startOpenPaySignIn({ redirectTo: "/dashboard" })
await startSolanaSignIn({ redirectTo: "/dashboard" })
await startWalletConnectSignIn({ redirectTo: "/dashboard" })
// MetaMask: use MetaMaskEmbeddedAuthPanel + Web3AuthProvider on /authpi
// Phantom: PhantomContinueButton / Google·Apple via @phantom/react-sdk`}</Code>

          <Card className="space-y-2 rounded-3xl border-border bg-card p-5 text-sm shadow-none">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Security
            </div>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                Never expose <code className="text-foreground">opk_</code>,{" "}
                <code className="text-foreground">wcp_</code>,{" "}
                <code className="text-foreground">WEB3AUTH_CLIENT_SECRET</code>, or service role in
                the browser
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
              <Button asChild size="sm" className="rounded-full">
                <Link to="/authpi">Open /authpi</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <a href="/api/public/docs/openpay-auth" target="_blank" rel="noreferrer">
                  Full auth Markdown
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </Card>
        </Section>

        <Section id="pay" eyebrow="Step 4" title="Accept OpenPay balance payments">
          <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-4">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              Buyer pays from their OpenPay wallet. Funds credit your partner-app owner. Prefer
              PayButton <code className="text-foreground">/charges</code>; use{" "}
              <code className="text-foreground">/pay/@username</code> for hosted tag payments (Pro
              top-up style).
            </p>
          </div>

          <p className="text-sm font-medium text-foreground">A · PayButton charge</p>
          <Code>{`curl -X POST "${API}/charges" \\
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
# → redirect buyer to checkout_url or ${PAY_HOST}/paybutton/CHARGE_ID`}</Code>

          <p className="text-sm font-medium text-foreground">B · Hosted pay tag</p>
          <Code>{`${PAY_HOST}/pay/YOUR_USERNAME
  ?amount=25.00
  &currency=OUSD
  &note=order_1234
  &success_url=https://yourapp.com/thanks
  &cancel_url=https://yourapp.com/cart

# Success return: ?openpay_return=1&openpay_ref=order_1234&openpay_tx=...
# Cancel return:  ?openpay_cancel=1`}</Code>

          <Card className="rounded-3xl border-border bg-card p-4 text-sm text-muted-foreground shadow-none">
            <p className="font-medium text-foreground">Pay flow</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Open pay link → amount + note</li>
              <li>Pay → balance check → debit OUSD → thank-you</li>
              <li>
                Redirect to your <code className="text-foreground">success_url</code>
              </li>
              <li>Your backend verifies, then fulfills; on cancel mark order canceled</li>
            </ol>
          </Card>
        </Section>

        <Section id="openpay-to-pro" eyebrow="Step 5" title="OpenPay → OpenPay Pro transfers">
          <Card className="space-y-3 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <p className="text-foreground">
              Send OUSD from OpenPay into a Pro wallet using note routing + inbound API (mirror of
              Pro → OpenPay send).
            </p>
            <p>
              Note:{" "}
              <code className="rounded bg-muted px-1 text-foreground">pro_xfer:@alice:r_ref</code>{" "}
              or <code className="rounded bg-muted px-1 text-foreground">pro_xfer:0x…:r_ref</code>{" "}
              (Pro wallet address)
            </p>
            <Code>{`# By @username
curl -X POST "https://openpaypromainnet.lovable.app/api/public/openpay/inbound" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"@alice","amount":25,"openpay_tx_id":"TX1","note":"pro_xfer:@alice:r_1"}'

# By Pro wallet address (0x…)
curl -X POST "https://openpaypromainnet.lovable.app/api/public/openpay/inbound" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"0x7bf2…851a","amount":25,"openpay_tx_id":"TX2","note":"pro_xfer:0x7bf2…851a:r_2"}'`}</Code>
            <p>
              Pro users:{" "}
              <strong className="text-foreground">Receive → Create OpenPay receive link</strong>.
              OpenPay product prompt:{" "}
              <code className="text-foreground">docs/OPENPAY_SEND_TO_PRO_PROMPT.md</code>.
            </p>
          </Card>
        </Section>

        <Section id="api" eyebrow="Step 6" title="API cheat sheet">
          <div className="overflow-x-auto rounded-3xl border border-border">
            <table className="w-full min-w-130 text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
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
                  ["POST", "/transfers", "opk_"],
                  ["POST", "/charges", "opk_"],
                  ["GET", "/charges/:id", "opk_"],
                  ["POST", "/oauth/token", "body secret"],
                  ["GET", "/user/me", "opa_"],
                  ["GET", "/user/balance", "opa_"],
                ].map(([m, p, a]) => (
                  <tr key={p} className="bg-card/40">
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">{m}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">{p}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Base: <code className="break-all text-foreground">{API}</code>
            <br />
            Portal:{" "}
            <a
              href={PARTNER_PORTAL}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {PARTNER_PORTAL}
            </a>
            <br />
            Full Partner Transfer notes:{" "}
            <code className="text-foreground">docs/PARTNER_TRANSFER_API.md</code>
          </p>
        </Section>

        <Section id="ledger" eyebrow="Step 7" title="Public Ledger API">
          <Card className="space-y-3 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <p className="text-foreground">
              Append-only public ledger of OpenPay Pro transactions for analytics / OpenLedger
              pipelines. Authenticate with{" "}
              <code className="rounded bg-muted px-1 text-foreground">x-api-key</code> or{" "}
              <code className="rounded bg-muted px-1 text-foreground">Authorization: Bearer</code>.
            </p>
            <Code>{`GET https://openpaypromainnet.lovable.app/api/public/ledger/entries?limit=50
x-api-key: YOUR_LEDGER_KEY`}</Code>
            <p>
              Covered types: <code className="text-foreground">send</code>,{" "}
              <code className="text-foreground">receive</code>,{" "}
              <code className="text-foreground">buy</code>,{" "}
              <code className="text-foreground">sell</code>,{" "}
              <code className="text-foreground">swap</code>,{" "}
              <code className="text-foreground">mint</code>,{" "}
              <code className="text-foreground">reward</code>. Full reference:{" "}
              <code className="text-foreground">docs/LEDGER_API.md</code> · in-app{" "}
              <Link to="/ledger" className="font-medium text-primary underline-offset-2 hover:underline">
                /ledger
              </Link>
              .
            </p>
          </Card>
        </Section>

        <Section id="wc-pay" eyebrow="Step 8" title="WalletConnect Pay">
          <Card className="space-y-3 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <p className="text-foreground">
              OpenPay Pro can pay WalletConnect Pay merchant links from the in-app scanner (
              <code className="rounded bg-muted px-1">/scan</code> →{" "}
              <code className="rounded bg-muted px-1">/wc-pay</code>).
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Merchant creates a WC Pay link via WalletConnect Pay Merchant API</li>
              <li>User scans QR or opens the link in Pro</li>
              <li>User selects a payment option and confirms in their EVM wallet</li>
              <li>
                Requires server env{" "}
                <code className="rounded bg-muted px-1 text-foreground">WALLETCONNECT_PAY_API_KEY</code>
              </li>
            </ul>
            <p>
              This is a <strong className="text-foreground">payer</strong> integration inside Pro —
              not a partner webhook. Merchants should use WalletConnect Pay docs for link creation.
            </p>
          </Card>
        </Section>

        <Section id="charges" eyebrow="Step 9" title="Charges polling (no partner webhooks)">
          <Card className="space-y-3 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <p className="text-foreground">
              Partner payments are confirmed by <strong>polling</strong>{" "}
              <code className="rounded bg-muted px-1">GET /charges/:id</code> (or success URL
              return). There is no partner-facing payment webhook today.
            </p>
            <Code>{`# After creating a charge
GET ${API}/charges/CHARGE_ID
Authorization: Bearer opk_live_YOUR_KEY

# Fulfill only when status is paid / confirmed`}</Code>
            <p>
              Internal webhooks (MoonPay, KYC, Circle) power Pro itself and are{" "}
              <strong className="text-foreground">not</strong> exposed to third-party apps.
            </p>
          </Card>
        </Section>

        <Section id="nft" eyebrow="Step 10" title="OpenNFT mint (high level)">
          <Card className="space-y-3 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <p className="text-foreground">
              Pro users mint collectibles on OpenPay OpenNFT via a connected OpenPay account (
              Settings → Connect OpenPay). Marketplace:{" "}
              <a
                href="https://openpy.space/web3/nft"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                openpy.space/web3/nft
              </a>
              .
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>User must link OpenPay OAuth in Pro first</li>
              <li>Mint calls OpenPay partner NFT APIs server-side</li>
              <li>
                Ledger type <code className="rounded bg-muted px-1 text-foreground">mint</code> is
                recorded on the Pro Ledger API
              </li>
            </ul>
          </Card>
        </Section>

        <Section id="errors" eyebrow="Step 11" title="Errors & launch checklist">
          <Card className="space-y-2 rounded-3xl border-border bg-card p-5 text-sm shadow-none">
            <p>
              <strong>401 / invalid_client</strong> — bad or quoted{" "}
              <code className="rounded bg-muted px-1">opk_live_…</code> / wrong client_id
            </p>
            <p>
              <strong>redirect_uri not registered</strong> — must match allowlist exactly
            </p>
            <p>
              <strong>400</strong> — validation, insufficient balance, or temporary API SQL bugs
            </p>
            <p>
              <strong>Scopes</strong> — Connect uses <code className="rounded bg-muted px-1">profile</code>{" "}
              and <code className="rounded bg-muted px-1">balance</code>
            </p>
          </Card>
          <ul className="space-y-2 text-sm">
            {[
              "Partner app + secrets on server only (openpy.space/partner-api)",
              "Redirect URIs registered",
              "Connect → token → store opa_live_ server-side",
              "Charges or /pay/@tag with success/cancel URLs",
              "Fulfill only after verified paid / confirmed return",
            ].map((item) => (
              <li key={item} className="flex gap-2 text-foreground">
                <span className="text-primary">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section id="faq" eyebrow="FAQ" title="OpenPay Pro FAQ">
          <Card className="space-y-4 rounded-3xl border-border bg-card p-5 text-sm shadow-none">
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
                Platform fees (0.30% on OpenToken buys/sells, OpenDEX swaps, and major buys) credit
                the admin fee wallet — typically{" "}
                <code className="rounded bg-muted px-1">@openpay</code> or the 0x address set under
                Admin → Top-up fee.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Is there a partner webhook?</p>
              <p className="mt-1 text-muted-foreground">
                Not yet — poll <code className="rounded bg-muted px-1">GET /charges/:id</code> after
                payment return.
              </p>
            </div>
            <p className="text-muted-foreground">
              Full FAQ:{" "}
              <Link to="/docs/faq" className="font-medium text-primary underline-offset-2 hover:underline">
                /docs/faq
              </Link>
            </p>
          </Card>
        </Section>

        <footer className="border-t border-border pt-6 text-xs text-muted-foreground">
          <p>
            Integration markdown:{" "}
            <code className="text-foreground">docs/OPENPAY_INTEGRATION.md</code> · Auth methods:{" "}
            <code className="text-foreground">docs/OPENPAY_PRO_AUTH.md</code> · Partner portal:{" "}
            <a
              href={PARTNER_PORTAL}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              openpy.space/partner-api
            </a>{" "}
            · Also see <code className="text-foreground">docs/PARTNER_TRANSFER_API.md</code> and{" "}
            <code className="text-foreground">docs/LEDGER_API.md</code> ·{" "}
            <Link to="/docs/faq" className="text-primary underline-offset-2 hover:underline">
              FAQ
            </Link>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}
