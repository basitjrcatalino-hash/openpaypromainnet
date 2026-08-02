import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsCode, DocsSection, DocsShell } from "@/components/docs/DocsShell";
import { Card } from "@/components/ui/card";
import { DOCS_BASE, INBOUND_API, PARTNER_API, PARTNER_PORTAL } from "@/lib/docs-nav";

export const Route = createFileRoute("/docs/money")({
  head: () => ({
    meta: [
      { title: "Money Rails Docs — Send, Receive, Deposit, Withdraw, Swap" },
      {
        name: "description",
        content:
          "Integrate OpenPay Pro money rails: send, receive, deposit, withdraw, and swap for OUSD and major tokens.",
      },
      { property: "og:url", content: `${DOCS_BASE}/docs/money` },
    ],
    links: [{ rel: "canonical", href: `${DOCS_BASE}/docs/money` }],
  }),
  component: MoneyDocsPage,
});

function MoneyDocsPage() {
  return (
    <DocsShell
      title="Money rails"
      description="Send, receive, deposit, withdraw, and swap — how third-party platforms move value on OpenPay Pro and the OpenPay network."
      pathname="/docs/money"
      eyebrow="Core guides"
      speechText="Money rails docs. Send and receive with Partner Transfer and Pro QR. Deposit via OpenPay Balance, multi-chain gateway, Pi, and Solana Pay. Withdraw with Partner Transfer out. Swap via OpenDEX deep links and ledger swap entries."
    >
      <Card className="rounded-2xl border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
        Mental model: <strong className="text-foreground">Partner Transfer API</strong> moves OUSD on
        OpenPay (openpy.space). <strong className="text-foreground">OpenPay Pro</strong> is the money
        app ledger (OUSD + majors + OpenTokens). Use{" "}
        <Link to="/docs/exchange" className="font-semibold text-primary hover:underline">
          Exchange docs
        </Link>{" "}
        when listing OUSD like a network asset.
      </Card>

      <DocsSection id="send-receive" eyebrow="01" title="Send & receive">
        <p className="text-sm leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Partner payouts / sends</strong> — debit your partner
          OpenPay balance and credit any <code className="text-foreground">@username</code>,{" "}
          <code className="text-foreground">OP…</code>, or email:
        </p>
        <DocsCode>{`curl -X POST "${PARTNER_API}/transfers" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"to":"@alice","amount":10.00,"note":"Payout"}'`}</DocsCode>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Pro receive</strong> — users share QR / receive links from{" "}
          <code className="text-foreground">/receive</code>. Camera-friendly{" "}
          <code className="text-foreground">/pay</code> links open cleanly from phone scans.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <strong className="text-foreground">OpenPay → Pro inbound</strong> — when funds should land in
          a Pro wallet, use the <code className="text-foreground">pro_xfer</code> note convention and
          call:
        </p>
        <DocsCode>{`POST ${INBOUND_API}
Authorization: Bearer <partner-or-service-key>
{ "openpay_tx_id": "...", "amount": 10, "note": "pro_xfer:..." }`}</DocsCode>
        <p className="text-sm text-muted-foreground">
          Full inbound guide:{" "}
          <Link to="/docs/openpay" className="font-semibold text-primary hover:underline">
            /docs/openpay#openpay-to-pro
          </Link>{" "}
          · raw{" "}
          <a href="/api/public/docs/openpay-to-pro" className="font-semibold text-primary hover:underline">
            markdown
          </a>
          .
        </p>
      </DocsSection>

      <DocsSection id="deposit" eyebrow="02" title="Deposit (fund Pro / credit users)">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Partners typically implement <strong className="text-foreground">deposit</strong> as: user
          pays your OpenPay tag or PayButton charge → you credit their account in your DB.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">OpenPay Balance / payment link</strong> —{" "}
            <code className="text-foreground">POST /charges</code> + checkout_url (see{" "}
            <Link to="/docs/api" className="text-primary hover:underline">
              API reference
            </Link>
            ).
          </li>
          <li>
            <strong className="text-foreground">Pro in-app deposits</strong> (user opens Pro): OpenPay
            Balance, Pi Network, Wallet USDT/USDC/SOL, MoonPay Commerce USDC/crypto, Solana Pay, Circle
            Mint, Banxa, multi-chain scan-to-pay.
          </li>
          <li>
            Deep-link users into Pro top-up:{" "}
            <code className="text-foreground">{DOCS_BASE}/topup</code>
          </li>
        </ul>
        <DocsCode>{`# Merchant-style deposit: create charge, redirect user, poll until paid
GET ${PARTNER_API}/charges/CHARGE_ID
# status: created | paid | canceled | expired`}</DocsCode>
      </DocsSection>

      <DocsSection id="withdraw" eyebrow="03" title="Withdraw (pay out)">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Exchange-style withdraw: debit the user on your platform, then{" "}
          <code className="text-foreground">POST /transfers</code> from your funded partner OpenPay
          account to their <code className="text-foreground">@username</code> /{" "}
          <code className="text-foreground">OP…</code> / Pro destination.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Always send <code className="text-foreground">Idempotency-Key</code> on payouts.</li>
          <li>Fund the OpenPay account that owns the API key (your hot wallet).</li>
          <li>
            Pro-native withdraw UI lives at <code className="text-foreground">/withdraw</code> — for
            end users inside the app, not a public partner HTTP swap of chains.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Step-by-step for listings:{" "}
          <Link to="/docs/exchange" className="font-semibold text-primary hover:underline">
            Exchange · OUSD
          </Link>
          .
        </p>
      </DocsSection>

      <DocsSection id="swap" eyebrow="04" title="Swap">
        <p className="text-sm leading-relaxed text-muted-foreground">
          There is <strong className="text-foreground">no partner OpenDEX HTTP swap endpoint</strong>{" "}
          today. Integrate swap by:
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Deep-link users into Pro:{" "}
            <code className="text-foreground">{DOCS_BASE}/swap</code> or{" "}
            <code className="text-foreground">{DOCS_BASE}/trade</code>
          </li>
          <li>
            Or hold OUSD on your books and let users swap inside Pro; reconcile with Ledger{" "}
            <code className="text-foreground">type=swap</code>
          </li>
        </ol>
        <DocsCode>{`# Ledger filter for swaps
GET ${DOCS_BASE}/api/public/ledger/entries?type=swap&limit=50
x-api-key: YOUR_LEDGER_KEY`}</DocsCode>
      </DocsSection>

      <DocsSection id="checklist" eyebrow="05" title="Integration checklist">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>✓ Partner app + <code className="text-foreground">opk_live_</code> key at {PARTNER_PORTAL}</li>
          <li>✓ Deposit: charges or inbound transfers with idempotency</li>
          <li>✓ Withdraw: Partner Transfer out with Idempotency-Key</li>
          <li>✓ Send/receive UX: QR, @username, or your own payment screens</li>
          <li>✓ Reconcile via Ledger API or charge polling</li>
          <li>✓ Never ship API keys to browsers or mobile binaries</li>
        </ul>
      </DocsSection>
    </DocsShell>
  );
}
