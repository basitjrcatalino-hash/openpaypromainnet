import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DocsSection, DocsShell } from "@/components/docs/DocsShell";
import { DOCS_BASE, PARTNER_PORTAL } from "@/lib/docs-nav";

export const Route = createFileRoute("/docs/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — OpenPay Pro Wallet" },
      {
        name: "description",
        content:
          "OpenPay Pro FAQ: wallets, send/receive, currency, OpenPay link, security, and third-party integration.",
      },
      { property: "og:title", content: "FAQ — OpenPay Pro Wallet" },
      {
        property: "og:description",
        content:
          "Answers on wallets, sending and receiving, currencies, security, and integrations.",
      },
      { property: "og:url", content: `${DOCS_BASE}/docs/faq` },
    ],
    links: [{ rel: "canonical", href: `${DOCS_BASE}/docs/faq` }],
  }),
  component: FaqPage,
});

const FAQS: { q: string; a: string; category: string }[] = [
  {
    category: "Account",
    q: "How do I create an OpenPay Pro wallet?",
    a: "Sign in via OpenPay, Pi, Solana, Phantom, WalletConnect, MetaMask, or Telegram on /authpi. A Main Wallet is created automatically on first login.",
  },
  {
    category: "Account",
    q: "Can I have multiple wallets?",
    a: "Yes. Use Switch wallet in the sidebar or Profile → Manage wallets. One wallet is active at a time.",
  },
  {
    category: "Balances",
    q: "Why did my dashboard and sidebar balances look different?",
    a: "They now use the same formula: all ledger majors (OUSD, PI, BTC, ETH, SOL, USDC, USDT, PYUSD, USDG, USD1, CASH, EURC) plus OpenToken holdings. Refresh if you still see a stale number.",
  },
  {
    category: "Send & receive",
    q: "How do I send to an OpenPay account?",
    a: "On Send, choose the OpenPay rail (after linking OpenPay in Settings), enter @username, then confirm.",
  },
  {
    category: "Send & receive",
    q: "How do I receive from OpenPay into Pro?",
    a: "Open Receive → create an OpenPay receive link, or use the inbound partner API with a pro_xfer note (see /docs/openpay#openpay-to-pro).",
  },
  {
    category: "Currency",
    q: "How do I change display currency?",
    a: "Tap the currency on the balance hero or open Settings → Currency. Rates use live FX (PI uses CoinGecko).",
  },
  {
    category: "OpenPay link",
    q: "What does Connect OpenPay do?",
    a: "It OAuth-links your openpy.space account so Pro can send/receive OpenPay balance and mint OpenNFTs on your behalf.",
  },
  {
    category: "Fees",
    q: "Where do buy/swap fees go?",
    a: "Platform fees on OpenToken trades, OpenDEX swaps, and major buys credit the admin fee wallet — usually @openpay or the address set in Admin → Top-up fee. Spot launch fees are 0.10%/0.10%; perp maker 0.02% / taker 0.05%.",
  },
  {
    category: "Security",
    q: "Where is my recovery phrase?",
    a: "Settings → Security → Recovery. Back it up offline. OpenPay Pro never stores your phrase in plaintext on the server.",
  },
  {
    category: "Developers",
    q: "How do third-party apps integrate?",
    a: "Register a partner app at openpy.space/partner-api, implement Connect OAuth + charges, and poll GET /charges/:id. Full guide: /docs/openpay.",
  },
  {
    category: "Developers",
    q: "Is there a payment webhook for partners?",
    a: "Not yet. Poll charge status after the user returns from checkout. Internal MoonPay/KYC/Circle webhooks are Pro-only.",
  },
];

function faqSpeechText() {
  return [
    "OpenPay Pro frequently asked questions. Account, wallets, payments, fees, and third-party integration.",
    ...FAQS.map((f) => `${f.category}. ${f.q} ${f.a}`),
  ].join(" ");
}

function FaqPage() {
  const categories = [...new Set(FAQS.map((f) => f.category))];

  return (
    <DocsShell
      title="Frequently asked questions"
      description="Account, wallets, payments, fees, and third-party integration."
      pathname="/docs/faq"
      eyebrow="Reference"
      speechText={faqSpeechText()}
    >
      <nav className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <a
            key={c}
            href={`#${c.toLowerCase().replace(/\s+/g, "-")}`}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
          >
            {c}
          </a>
        ))}
      </nav>

      {categories.map((cat, idx) => (
        <DocsSection
          key={cat}
          id={cat.toLowerCase().replace(/\s+/g, "-")}
          eyebrow={String(idx + 1).padStart(2, "0")}
          title={cat}
        >
          <div className="space-y-2">
            {FAQS.filter((f) => f.category === cat).map((f) => (
              <Card key={f.q} className="rounded-2xl border-border bg-card p-4 shadow-none">
                <p className="font-semibold text-foreground">{f.q}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.a}</p>
              </Card>
            ))}
          </div>
        </DocsSection>
      ))}

      <Card className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border-border bg-card p-4 shadow-none">
        <div>
          <p className="font-semibold text-foreground">Need the full integration guide?</p>
          <p className="text-sm text-muted-foreground">
            Connect, payments, Ledger API, NFT, WC Pay — or open the partner portal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="shrink-0 rounded-full">
            <a href={PARTNER_PORTAL} target="_blank" rel="noreferrer">
              Partner portal
            </a>
          </Button>
          <Button asChild className="shrink-0 rounded-full">
            <Link to="/docs/openpay">
              Docs <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Card>
    </DocsShell>
  );
}
