import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  BookOpen,
  Copy,
  ExternalLink,
  KeyRound,
  Link2,
  Moon,
  Rocket,
  ShieldCheck,
  Sun,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";

export const Route = createFileRoute("/docs/openpay")({
  head: () => ({
    meta: [
      { title: "OpenPay Integration — Connect & Payments" },
      {
        name: "description",
        content:
          "Add Connect with OpenPay (OAuth) and OpenPay Balance payments to any third-party app. Partner API portal: openpy.space/partner-api.",
      },
    ],
  }),
  component: OpenPayDocsPage,
});

const API =
  "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api";
const CONNECT = "https://openpy.space/connect";
const PAY_HOST = "https://openpy.space";
const PARTNER_PORTAL = "https://openpy.space/partner-api";
const AUTH_DOCS = "https://openpy.space/openpay-auth";

function copy(text: string, label = "Copied") {
  void navigator.clipboard.writeText(text).then(
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
            <span className="truncate text-sm font-semibold">OpenPay Integration Docs</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
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
            <Button asChild variant="outline" size="sm" className="hidden rounded-full sm:inline-flex">
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
            Connect auth &amp; OpenPay payments
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Add <strong className="text-foreground">Connect with OpenPay</strong> (OAuth 2.0) and
            accept <strong className="text-foreground">OpenPay balance</strong> payments — the same
            stack used by OpenPay Pro. Live developer portal:{" "}
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
            <Button asChild size="sm" className="rounded-full">
              <a href={PARTNER_PORTAL} target="_blank" rel="noreferrer">
                <Rocket className="mr-1.5 h-3.5 w-3.5" />
                Open Partner API portal
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <a href="/api/public/docs/openpay" target="_blank" rel="noreferrer">
                Raw Markdown
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
                Create an app, copy Client ID + API key, set your domain for redirects, then ship Sign
                in, transfers, or PayButton.
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
              <li key={step} className="rounded-2xl border border-border bg-background/60 px-3 py-2.5">
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
            ["#setup", "1. Partner app setup"],
            ["#connect", "2. Connect (OAuth)"],
            ["#pay", "3. Accept payments"],
            ["#openpay-to-pro", "4. OpenPay → Pro"],
            ["#api", "5. API cheat sheet"],
            ["#errors", "6. Errors & checklist"],
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
                <code className="rounded bg-muted px-1 text-foreground">/auth/openpay/callback</code>{" "}
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
                Copy the <code className="rounded bg-muted px-1">opk_live_…</code> API key immediately
                (shown once). Save the Client ID (UUID).
              </li>
              <li>
                Enter only your domain (e.g. <code className="rounded bg-muted px-1">www.yourapp.com</code>
                ) and click <strong>Auto-fill &amp; save</strong> for redirect URIs.
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
              signs in, Allow → your callback receives <code className="text-foreground">opc_…</code>
              .
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

        <Section id="pay" eyebrow="Step 3" title="Accept OpenPay balance payments">
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

        <Section id="openpay-to-pro" eyebrow="Step 4" title="OpenPay → OpenPay Pro transfers">
          <Card className="space-y-3 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <p className="text-foreground">
              Send OUSD from OpenPay into a Pro wallet using note routing + inbound API (mirror of Pro
              → OpenPay send).
            </p>
            <p>
              Note: <code className="rounded bg-muted px-1 text-foreground">pro_xfer:@alice:r_ref</code>{" "}
              or{" "}
              <code className="rounded bg-muted px-1 text-foreground">pro_xfer:0x…:r_ref</code> (Pro
              wallet address)
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
              Pro users: <strong className="text-foreground">Receive → Create OpenPay receive link</strong>
              . OpenPay product prompt: <code className="text-foreground">docs/OPENPAY_SEND_TO_PRO_PROMPT.md</code>.
            </p>
          </Card>
        </Section>

        <Section id="api" eyebrow="Step 5" title="API cheat sheet">
          <div className="overflow-x-auto rounded-3xl border border-border">
            <table className="w-full min-w-[520px] text-left text-sm">
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
          </p>
        </Section>

        <Section id="errors" eyebrow="Step 6" title="Errors & launch checklist">
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

        <footer className="border-t border-border pt-6 text-xs text-muted-foreground">
          <p>
            Full markdown: <code className="text-foreground">docs/OPENPAY_INTEGRATION.md</code> ·
            Partner portal:{" "}
            <a
              href={PARTNER_PORTAL}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              openpy.space/partner-api
            </a>{" "}
            · Also see <code className="text-foreground">docs/PARTNER_TRANSFER_API.md</code> and{" "}
            <code className="text-foreground">docs/LEDGER_API.md</code>.
          </p>
        </footer>
      </main>
    </div>
  );
}
