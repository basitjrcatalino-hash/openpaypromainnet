import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ChevronRight, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";

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
        content: "Answers on wallets, sending and receiving, currencies, security, and integrations.",
      },
      { property: "og:url", content: "https://openpaypro.space/docs/faq" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/docs/faq" }],
  }),
  component: FaqPage,
});

const FAQS: { q: string; a: string; category: string }[] = [
  {
    category: "Account",
    q: "How do I create an OpenPay Pro wallet?",
    a: "Sign in via OpenPay, Pi, Solana, Phantom, WalletConnect, or MetaMask on /authpi. A Main Wallet is created automatically on first login.",
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
    a: "Platform fees (0.30%) on OpenToken trades, OpenDEX swaps, and major buys credit the admin fee wallet — usually @openpay or the 0x address set in Admin → Top-up fee.",
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

function FaqPage() {
  const { theme, toggle } = useTheme();
  const categories = [...new Set(FAQS.map((f) => f.category))];

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <BookOpen className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold">OpenPay Pro FAQ</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={toggle}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/docs/openpay">Integration docs</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/dashboard">Open Pro</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Frequently asked questions</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Account, wallets, payments, fees, and third-party integration.
          </p>
        </div>

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

        {categories.map((cat) => (
          <section
            key={cat}
            id={cat.toLowerCase().replace(/\s+/g, "-")}
            className="scroll-mt-24 space-y-3"
          >
            <h2 className="text-lg font-bold tracking-tight">{cat}</h2>
            <div className="space-y-2">
              {FAQS.filter((f) => f.category === cat).map((f) => (
                <Card
                  key={f.q}
                  className="rounded-2xl border-border bg-card p-4 shadow-none"
                >
                  <p className="font-semibold text-foreground">{f.q}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.a}</p>
                </Card>
              ))}
            </div>
          </section>
        ))}

        <Card className="flex items-center justify-between gap-3 rounded-3xl border-border bg-card p-4 shadow-none">
          <div>
            <p className="font-semibold text-foreground">Need the full integration guide?</p>
            <p className="text-sm text-muted-foreground">Connect, payments, Ledger API, NFT, WC Pay.</p>
          </div>
          <Button asChild className="shrink-0 rounded-full">
            <Link to="/docs/openpay">
              Docs <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </Card>
      </main>
    </div>
  );
}
