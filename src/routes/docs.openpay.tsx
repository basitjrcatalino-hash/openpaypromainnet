import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BookOpen, Copy, ExternalLink, KeyRound, Link2, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/docs/openpay")({
  head: () => ({
    meta: [
      { title: "OpenPay Integration — Connect & Payments" },
      {
        name: "description",
        content:
          "Add Connect with OpenPay (OAuth) and OpenPay Balance payments to any third-party app.",
      },
    ],
  }),
  component: OpenPayDocsPage,
});

const API =
  "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api";
const CONNECT = "https://openpy.space/connect";
const PAY_HOST = "https://openpy.space";

function copy(text: string, label = "Copied") {
  void navigator.clipboard.writeText(text).then(
    () => toast.success(label),
    () => toast.error("Copy failed"),
  );
}

function Code({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-2xl border border-border/60 bg-muted/40 p-4 text-[11px] leading-relaxed text-foreground md:text-xs">
        <code>{children.trim()}</code>
      </pre>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="absolute right-2 top-2 h-7 rounded-full text-[10px]"
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
        <h2 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function OpenPayDocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">OpenPay Integration Docs</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <a href="https://openpy.space" target="_blank" rel="noreferrer">
                openpy.space
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
          <Badge variant="secondary" className="rounded-full">
            Third-party apps
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Connect auth &amp; OpenPay payments
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Add <strong>Connect with OpenPay</strong> (OAuth 2.0) and accept{" "}
            <strong>OpenPay balance</strong> payments in your product — the same stack used by
            OpenPay Pro.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
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

        <nav className="grid gap-2 rounded-3xl border border-border/60 bg-card/40 p-4 text-sm sm:grid-cols-2">
          {[
            ["#setup", "1. Partner app setup"],
            ["#connect", "2. Connect (OAuth)"],
            ["#pay", "3. Accept payments"],
            ["#openpay-to-pro", "4. OpenPay → Pro"],
            ["#api", "5. API cheat sheet"],
            ["#errors", "6. Errors & checklist"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-xl px-3 py-2 hover:bg-muted/60">
              {label}
            </a>
          ))}
        </nav>

        <Section id="setup" eyebrow="Step 1" title="Create a partner app">
          <Card className="space-y-3 rounded-3xl border-border/60 p-5 text-sm text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-5 text-foreground">
              <li>Sign in to OpenPay → Developer / Partner apps.</li>
              <li>Create an app (name + your site URL).</li>
              <li>
                Copy <code className="rounded bg-muted px-1">client_id</code> (UUID) and{" "}
                <code className="rounded bg-muted px-1">opk_live_…</code> API key (also OAuth{" "}
                <code className="rounded bg-muted px-1">client_secret</code>).
              </li>
              <li>
                Register exact redirect URIs, e.g.{" "}
                <code className="rounded bg-muted px-1">https://yourapp.com/openpay/callback</code>
              </li>
            </ol>
            <p>Never expose the partner API key in the browser — backend only.</p>
          </Card>
        </Section>

        <Section id="connect" eyebrow="Step 2" title="Connect with OpenPay">
          <div className="flex items-start gap-3 rounded-3xl border border-border/60 bg-card/40 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              Authorization Code flow. Scopes: <code>profile</code>, <code>balance</code>. User
              lands on the Authorize screen, signs in, Allow → your callback receives{" "}
              <code>opc_…</code>.
            </p>
          </div>

          <p className="text-sm font-medium">Authorize URL</p>
          <Code>{`${CONNECT}
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/openpay/callback
  &scope=profile%20balance
  &state=RANDOM_CSRF_TOKEN`}</Code>

          <p className="text-sm font-medium">Exchange code (server)</p>
          <Code>{`curl -X POST "${API}/oauth/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "authorization_code",
    "code": "opc_...",
    "redirect_uri": "https://yourapp.com/openpay/callback",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "opk_live_YOUR_KEY"
  }'`}</Code>

          <p className="text-sm font-medium">User APIs (Bearer opa_live_…)</p>
          <Code>{`curl -H "Authorization: Bearer opa_live_..." ${API}/user/me
curl -H "Authorization: Bearer opa_live_..." ${API}/user/balance`}</Code>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" />
            Codes expire in 10 minutes · access tokens last 30 days
          </div>
        </Section>

        <Section id="pay" eyebrow="Step 3" title="Accept OpenPay balance payments">
          <div className="flex items-start gap-3 rounded-3xl border border-border/60 bg-card/40 p-4">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              Buyer pays from their OpenPay wallet. Funds credit your partner-app owner. Prefer
              PayButton <code>/charges</code>; use <code>/pay/@username</code> for hosted tag
              payments (Pro top-up style).
            </p>
          </div>

          <p className="text-sm font-medium">A · PayButton charge</p>
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

          <p className="text-sm font-medium">B · Hosted pay tag</p>
          <Code>{`${PAY_HOST}/pay/YOUR_USERNAME
  ?amount=25.00
  &currency=OUSD
  &note=order_1234
  &success_url=https://yourapp.com/thanks
  &cancel_url=https://yourapp.com/cart

# Success return: ?openpay_return=1&openpay_ref=order_1234&openpay_tx=...
# Cancel return:  ?openpay_cancel=1`}</Code>

          <Card className="rounded-3xl border-border/60 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Pay flow</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Open pay link → amount + note</li>
              <li>Pay → balance check → debit OUSD → thank-you</li>
              <li>Redirect to your <code>success_url</code></li>
              <li>Your backend verifies, then fulfills; on cancel mark order canceled</li>
            </ol>
          </Card>
        </Section>

        <Section id="openpay-to-pro" eyebrow="Step 4" title="OpenPay → OpenPay Pro transfers">
          <Card className="space-y-3 rounded-3xl border-border/60 p-5 text-sm text-muted-foreground">
            <p className="text-foreground">
              Send OUSD from OpenPay into a Pro wallet using note routing + inbound API (mirror of
              Pro → OpenPay send).
            </p>
            <p>
              Note: <code className="rounded bg-muted px-1">pro_xfer:@alice:r_ref</code> or{" "}
              <code className="rounded bg-muted px-1">pro_xfer:0x…:r_ref</code> (Pro wallet address)
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
              Pro users: <strong>Receive → Create OpenPay receive link</strong>. OpenPay product
              prompt: <code>docs/OPENPAY_SEND_TO_PRO_PROMPT.md</code>.
            </p>
          </Card>
        </Section>

        <Section id="api" eyebrow="Step 5" title="API cheat sheet">
          <div className="overflow-x-auto rounded-3xl border border-border/60">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">Auth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
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
                  <tr key={p}>
                    <td className="px-4 py-2.5 font-mono text-xs">{m}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{p}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Base: <code className="break-all">{API}</code>
          </p>
        </Section>

        <Section id="errors" eyebrow="Step 6" title="Errors & launch checklist">
          <Card className="space-y-2 rounded-3xl border-border/60 p-5 text-sm">
            <p>
              <strong>401 / invalid_client</strong> — bad or quoted <code>opk_live_…</code> / wrong
              client_id
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
              "Partner app + secrets on server only",
              "Redirect URIs registered",
              "Connect → token → store opa_live_ server-side",
              "Charges or /pay/@tag with success/cancel URLs",
              "Fulfill only after verified paid / confirmed return",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-primary">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <footer className="border-t border-border/60 pt-6 text-xs text-muted-foreground">
          <p>
            Full markdown: <code>docs/OPENPAY_INTEGRATION.md</code> · Also see{" "}
            <code>docs/PARTNER_TRANSFER_API.md</code> and <code>docs/LEDGER_API.md</code>.
          </p>
        </footer>
      </main>
    </div>
  );
}
