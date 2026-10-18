import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  Rocket,
  ShieldCheck,
  Wallet,
} from "lucide-react";
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
  PARTNER_API,
  PARTNER_PORTAL,
} from "@/lib/docs-nav";
import { TOPUP_METHOD_CATALOG } from "@/lib/topup-methods";

export const Route = createFileRoute("/docs/pro-pay")({
  head: () => ({
    meta: [
      {
        title: "Pro Pay — Merchant Checkout Integration — OpenPay Pro",
      },
      {
        name: "description",
        content:
          "Integrate OpenPay Pro payment methods for third-party apps: Partner API charges, Connect auth, receive @username / wallet address, inbound settlement, dashboard earnings, env & copy-paste setup.",
      },
      {
        property: "og:title",
        content: "Pro Pay — Merchant Checkout Integration",
      },
      {
        property: "og:description",
        content:
          "Full partner setup so users pay with OpenPay Pro methods and earnings credit to your Pro username or wallet.",
      },
      { property: "og:url", content: `${DOCS_BASE}/docs/pro-pay` },
    ],
    links: [{ rel: "canonical", href: `${DOCS_BASE}/docs/pro-pay` }],
  }),
  component: ProPayDocsPage,
});

const SPEECH = `
Pro Pay merchant integration.
Third-party apps and OpenPay can accept payment with OpenPay Pro methods.
Create Partner API charges, optionally Connect OAuth, then credit earnings to a Pro username or wallet address via inbound.
OpenPay QR Pay can add method openpay_pro for the same settle path.
Buyers who need Pi, Banxa, MoonPay, or wallet majors deep-link into Pro Top Up.
Poll charges, keep keys on the server, and track earnings on the partner dashboard and Pro wallet.
`.trim();

const TOC = [
  ["#overview", "0. Overview"],
  ["#receive", "1. Set receive wallet"],
  ["#env", "2. Env & keys"],
  ["#auth", "3. Auth (Connect)"],
  ["#checkout", "4. Create checkout"],
  ["#inbound", "5. Credit Pro wallet"],
  ["#qr-pay", "6. QR Pay · openpay_pro"],
  ["#methods", "7. Pro payment methods"],
  ["#deeplink", "8. Deep-link Top Up"],
  ["#dashboard", "9. Dashboard & earnings"],
  ["#node", "10. Copy-paste Node"],
  ["#checklist", "11. Launch checklist"],
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

function ProPayDocsPage() {
  return (
    <DocsShell
      title="Pro Pay · Merchant checkout"
      description="Full partner setup so third parties (and OpenPay) let users pay with OpenPay Pro payment methods — earnings credit to the merchant’s Pro @username or wallet address. Auth, API, env, dashboard, copy-paste."
      pathname="/docs/pro-pay"
      eyebrow="Core guides"
      speechText={SPEECH}
    >
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-muted px-3.5 py-1.5 text-sm font-semibold text-muted-foreground">
          Partner API ready
        </span>
        <span className="rounded-full bg-muted px-3.5 py-1.5 text-sm font-semibold text-muted-foreground">
          Auth · Pay · Receive
        </span>
        <span className="rounded-full bg-muted px-3.5 py-1.5 text-sm font-semibold text-muted-foreground">
          Dashboard earnings
        </span>
        <Pill href={PARTNER_PORTAL} primary>
          <Rocket className="h-4 w-4" />
          Get API keys
        </Pill>
        <Pill href="/api/public/docs/pro-pay">Raw Markdown</Pill>
        <Pill href="/api/public/docs/qrpay-pro">QR Pay pack</Pill>
        <Pill href="/docs/ai">AI Partner Pack</Pill>
        <Pill href="/docs/openpay">Connect & payments</Pill>
      </div>

      <DocsCallout>
        <strong className="text-foreground">How settlement works:</strong> PayButton{" "}
        <code className="text-foreground">/charges</code> settle to your{" "}
        <strong className="text-foreground">OpenPay partner wallet</strong>. To land OUSD on an{" "}
        <strong className="text-foreground">OpenPay Pro @username / 0x</strong>, call inbound with{" "}
        <code className="text-foreground">pro_xfer:</code>. The multi-rail Top Up screen (Pi, Banxa,
        MoonPay, …) is a <strong className="text-foreground">deep-link</strong> into Pro — not
        provider API keys in your app.
      </DocsCallout>

      <nav className="grid gap-1.5 rounded-3xl border border-border bg-card p-4 text-base sm:grid-cols-2">
        {TOC.map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-xl px-3 py-2.5 font-medium text-foreground transition hover:bg-muted"
          >
            {label}
          </a>
        ))}
      </nav>

      <DocsSection id="overview" eyebrow="00" title="Overview — three paths">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              t: "A · Charges",
              d: "POST /charges → PayButton → poll paid. Earnings on partner OpenPay balance.",
            },
            {
              t: "B · Pro inbound",
              d: "After paid, POST inbound to credit merchant @user / 0x on Pro.",
            },
            {
              t: "C · Deep-link",
              d: "Send buyers to /topup (full methods) then /pay/@merchant.",
            },
          ].map((x) => (
            <DocsCard key={x.t} className="!p-5">
              <p className="text-lg font-bold text-foreground">{x.t}</p>
              <p className="mt-2 text-base text-muted-foreground">{x.d}</p>
            </DocsCard>
          ))}
        </div>
        <DocsCode>{`Buyer → Your checkout → POST /charges (opk_live_)
      → Pay on OpenPay → poll GET /charges/:id = paid
      → POST ${INBOUND_API}
         { to: "@shop", note: "pro_xfer:@shop:r_order", openpay_tx_id }
      → Merchant Pro wallet +$OUSD`}</DocsCode>
      </DocsSection>

      <DocsSection id="receive" eyebrow="01" title="Set receive wallet (merchant dashboard)">
        <DocsCard className="space-y-4">
          <p className="text-muted-foreground">
            Merchants configure where funds arrive. Store these in{" "}
            <strong className="text-foreground">your</strong> partner dashboard:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Pro @username</strong> — Settings / profile on
              OpenPay Pro
            </li>
            <li>
              <strong className="text-foreground">Pro 0x wallet</strong> — Wallet screen address
            </li>
            <li>
              <strong className="text-foreground">Partner OpenPay owner</strong> — charge proceeds
              via Partner portal
            </li>
            <li>
              Optional <code className="text-foreground">opdk_…</code> at{" "}
              <Link to="/developer" className="font-semibold text-primary hover:underline">
                /developer
              </Link>{" "}
              (inbound to your own Pro wallet only)
            </li>
          </ul>
          <DocsCode>{`{
  "merchant_id": "m_123",
  "pro_username": "@shop",
  "pro_wallet": "0x7bf2…851a",
  "openpay_client_id": "uuid…",
  "receive_mode": "pro_inbound"
}`}</DocsCode>
        </DocsCard>
      </DocsSection>

      <DocsSection id="env" eyebrow="02" title="Env & API keys">
        <DocsCode>{`# Required — Partner Transfer
OPENPAY_CLIENT_ID="your-client-uuid"
OPENPAY_PARTNER_API_KEY="opk_live_..."
OPENPAY_PARTNER_API_BASE="${PARTNER_API}"

# Optional — Connect OAuth
OPENPAY_REDIRECT_URI="https://yourapp.com/openpay/callback"

# Merchant receive (your dashboard)
MERCHANT_PRO_USERNAME="@shop"
MERCHANT_PRO_WALLET="0x..."
PRO_INBOUND_URL="${INBOUND_API}"

# Optional — Pro developer key (own wallet inbound only)
OPENPAY_PRO_DEVELOPER_KEY="opdk_..."`}</DocsCode>
        <div className="flex flex-wrap gap-2">
          <Pill href={PARTNER_PORTAL} primary>
            <KeyRound className="h-4 w-4" />
            Partner portal
          </Pill>
          <Pill href="/developer">Pro /developer</Pill>
        </div>
        <p className="text-base text-muted-foreground">
          Never expose <code className="text-foreground">opk_</code> /{" "}
          <code className="text-foreground">opdk_</code> in browsers or{" "}
          <code className="text-foreground">VITE_</code> env.
        </p>
      </DocsSection>

      <DocsSection id="auth" eyebrow="03" title="Auth — Connect with OpenPay">
        <DocsCallout>
          Standard Authorization Code. Scopes:{" "}
          <code className="text-foreground">profile</code>{" "}
          <code className="text-foreground">balance</code>. Codes expire in 10 minutes;{" "}
          <code className="text-foreground">opa_live_</code> tokens last 30 days.
        </DocsCallout>
        <DocsCode>{`${CONNECT_URL}
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/openpay/callback
  &scope=profile%20balance
  &state=RANDOM_CSRF`}</DocsCode>
        <DocsCode>{`curl -X POST "${PARTNER_API}/oauth/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "authorization_code",
    "code": "opc_...",
    "redirect_uri": "https://yourapp.com/openpay/callback",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "opk_live_YOUR_KEY"
  }'`}</DocsCode>
        <p className="text-base text-muted-foreground">
          Pro wallet sign-in methods (OpenPay, Telegram, Solana, Pi, Phantom, WalletConnect,
          MetaMask):{" "}
          <Link to="/docs/auth" className="font-semibold text-primary hover:underline">
            /docs/auth
          </Link>
          .
        </p>
      </DocsSection>

      <DocsSection id="checkout" eyebrow="04" title="Create checkout — PayButton charges">
        <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-4">
          <Wallet className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
          <p className="text-base text-muted-foreground">
            Buyer pays with <strong className="text-foreground">OpenPay Balance</strong>. Funds
            credit your partner-app owner. Poll status — no partner webhooks yet.
          </p>
        </div>
        <DocsCode>{`curl -X POST "${PARTNER_API}/charges" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 250.00,
    "currency": "OUSD",
    "description": "Order #9001",
    "reference": "order_9001",
    "success_url": "https://yourapp.com/pay/thanks?ref=order_9001",
    "cancel_url": "https://yourapp.com/pay/cancel?ref=order_9001"
  }'
# → { id, checkout_url, status, expires_at }  · TTL ~2h`}</DocsCode>
        <DocsCode>{`# Poll
curl -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  ${PARTNER_API}/charges/CHARGE_ID
# created | paid | canceled | expired

# Cancel unpaid
curl -X POST -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  ${PARTNER_API}/charges/CHARGE_ID/cancel`}</DocsCode>
      </DocsSection>

      <DocsSection id="inbound" eyebrow="05" title="Credit Pro @username / wallet">
        <DocsCard className="space-y-3">
          <p className="text-muted-foreground">
            After <code className="text-foreground">paid</code>, land OUSD on the merchant’s Pro
            receive identity:
          </p>
          <DocsCode>{`curl -X POST "${INBOUND_API}" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "@shop",
    "amount": 250.00,
    "openpay_tx_id": "CHARGE_OR_TX_ID",
    "note": "pro_xfer:@shop:r_order_9001",
    "from_username": "buyer"
  }'`}</DocsCode>
          <p className="text-base text-muted-foreground">
            <code className="text-foreground">to</code> accepts{" "}
            <code className="text-foreground">@user</code>,{" "}
            <code className="text-foreground">0x…</code>, or{" "}
            <code className="text-foreground">uid_…</code>. Idempotent on{" "}
            <code className="text-foreground">openpay_tx_id</code>.
          </p>
        </DocsCard>
      </DocsSection>

      <DocsSection id="qr-pay" eyebrow="06" title="QR Pay · method openpay_pro">
        <DocsCallout>
          For OpenPay’s QR Pay / checkout UI, register method{" "}
          <code className="text-foreground">openpay_pro</code>. Same settle path as Path A+B:
          PayButton charge → poll → inbound to Pro receive wallet.
        </DocsCallout>
        <DocsCard className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-md text-left text-base">
              <tbody className="divide-y divide-border">
                {[
                  ["Method id", "openpay_pro"],
                  ["Label", "OpenPay Pro"],
                  ["Pay rail", "OpenPay Balance via POST /charges"],
                  ["Receive", "@username and/or 0x… on OpenPay Pro"],
                  ["Note", "pro_xfer:@shop:r_order_9001"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <th className="py-2.5 pr-4 font-semibold text-foreground">{k}</th>
                    <td className="py-2.5 font-mono text-sm text-muted-foreground">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DocsCode>{`# Create charge for QR Pay order
curl -X POST "${PARTNER_API}/charges" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 25.00,
    "currency": "OUSD",
    "description": "QR Pay order_9001",
    "reference": "qr_order_9001",
    "success_url": "https://openpy.space/qrpay/thanks?ref=qr_order_9001",
    "cancel_url": "https://openpy.space/qrpay/cancel?ref=qr_order_9001"
  }'
# Show checkout_url (or QR of that URL) to buyer
# Poll until paid, then inbound:`}</DocsCode>
          <DocsCode>{`curl -X POST "${INBOUND_API}" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "@shop",
    "amount": 25.00,
    "openpay_tx_id": "CHARGE_OR_TX_ID",
    "note": "pro_xfer:@shop:r_qr_order_9001"
  }'`}</DocsCode>
          <div className="flex flex-wrap gap-2">
            <Pill href="/api/public/docs/qrpay-pro" primary>
              Full QR Pay markdown
            </Pill>
            <Pill href="/docs/openpay#qr-pay">OpenPay docs · QR</Pill>
          </div>
        </DocsCard>
      </DocsSection>

      <DocsSection id="methods" eyebrow="07" title="OpenPay Pro payment methods">
        <DocsCallout>
          Same catalog as the Pro <strong className="text-foreground">Top Up → Pay with</strong>{" "}
          screen. Partners deep-link buyers to Pro; they do not embed provider secrets.
        </DocsCallout>
        <div className="overflow-x-auto rounded-3xl border border-border bg-card">
          <table className="w-full min-w-[36rem] text-left text-base">
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
                  <td className="px-4 py-3 font-mono text-sm text-foreground">
                    {m.method_key}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">{m.label}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocsSection>

      <DocsSection id="deeplink" eyebrow="08" title="Deep-link Top Up + pay merchant">
        <DocsCode>{`# Buyer funds self with full Pro methods (Pi, Banxa, MoonPay, USDT…)
https://openpaypro.space/topup

# Then pay merchant
https://openpaypro.space/pay/@shop?amount=250&asset=OUSD&note=order_9001

# Or OpenPay hosted pay tag + pro_xfer note (then inbound)
https://openpy.space/pay/YOUR_PARTNER_TAG
  ?amount=250&currency=OUSD
  &note=pro_xfer:@shop:r_order_9001
  &success_url=https://yourapp.com/thanks
  &cancel_url=https://yourapp.com/cancel`}</DocsCode>
      </DocsSection>

      <DocsSection id="dashboard" eyebrow="09" title="Dashboard & earnings">
        <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-5">
          <LayoutDashboard className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
          <div className="space-y-2 text-base text-muted-foreground">
            <p>
              <strong className="text-foreground">Partner portal</strong> — keys, redirects, owner
              balance
            </p>
            <p>
              <strong className="text-foreground">GET /me · /balance</strong> — server earnings after
              charges
            </p>
            <p>
              <strong className="text-foreground">Pro wallet / activity</strong> — OUSD after inbound
            </p>
            <p>
              <strong className="text-foreground">Ledger API</strong> — reconcile{" "}
              <code className="text-foreground">buy</code> /{" "}
              <code className="text-foreground">receive</code>
            </p>
          </div>
        </div>
        <DocsCode>{`curl -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  ${PARTNER_API}/balance`}</DocsCode>
      </DocsSection>

      <DocsSection id="node" eyebrow="10" title="Copy-paste Node">
        <DocsCode>{`const API = process.env.OPENPAY_PARTNER_API_BASE || "${PARTNER_API}";
const KEY = process.env.OPENPAY_PARTNER_API_KEY;
const INBOUND = process.env.PRO_INBOUND_URL || "${INBOUND_API}";
const MERCHANT = process.env.MERCHANT_PRO_USERNAME || "@shop";

export async function createCheckout({ amount, reference, success_url, cancel_url }) {
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
  return res.json(); // { id, checkout_url }
}

export async function waitUntilPaid(chargeId) {
  for (;;) {
    const res = await fetch(\`\${API}/charges/\${chargeId}\`, {
      headers: { Authorization: \`Bearer \${KEY}\` },
    });
    const data = await res.json();
    if (data.status === "paid") return data;
    if (data.status === "canceled" || data.status === "expired") {
      throw new Error(\`Charge \${data.status}\`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export async function creditMerchantPro({ amount, openpay_tx_id, reference }) {
  const res = await fetch(INBOUND, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: MERCHANT,
      amount,
      openpay_tx_id,
      note: \`pro_xfer:\${MERCHANT}:r_\${reference}\`,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}`}</DocsCode>
      </DocsSection>

      <DocsSection id="checklist" eyebrow="11" title="Launch checklist">
        <DocsCard className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Ready for production
          </div>
          <ul className="space-y-2 text-base text-foreground">
            {[
              "Partner app + opk_live_ on server only",
              "Merchant Pro @username and/or 0x saved in your dashboard",
              "Connect redirect URIs exact-matched (if using OAuth)",
              "Charges create → redirect → poll paid",
              "Inbound credits Pro receive wallet (Path B)",
              "QR Pay method openpay_pro wired (if using OpenPay QR)",
              "/topup + /pay/@merchant tested (Path C)",
              "Earnings via GET /balance and/or Pro wallet",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-2">
            <Pill href="/docs/openpay" primary>
              Connect & payments
            </Pill>
            <Pill href="/api/public/docs/qrpay-pro">QR Pay pack</Pill>
            <Pill href="/docs/api">Partner Transfer API</Pill>
            <Pill href="/docs/auth">Auth methods</Pill>
            <Pill href="/docs/ai">AI Partner Pack</Pill>
          </div>
        </DocsCard>
      </DocsSection>

      <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
        Source: <code className="text-foreground">docs/PRO_PAY_INTEGRATION.md</code> · QR:{" "}
        <code className="text-foreground">docs/OPENPAY_QRPAY_PRO.md</code> · Raw:{" "}
        <a
          href="/api/public/docs/pro-pay"
          className="font-semibold text-foreground underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          /api/public/docs/pro-pay
        </a>
        {" · "}
        <a
          href="/api/public/docs/qrpay-pro"
          className="font-semibold text-foreground underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          /api/public/docs/qrpay-pro
        </a>
        {" · "}
        <a
          href={PARTNER_PORTAL}
          className="font-semibold text-foreground underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Partner portal
          <ExternalLink className="ml-1 inline h-3.5 w-3.5" />
        </a>
      </footer>
    </DocsShell>
  );
}
