import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BookOpen,
  Copy,
  ExternalLink,
  Network,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageListenButton } from "@/components/page-listen-button";
import { useTheme } from "@/components/theme-provider";
import { Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/docs/exchange")({
  head: () => ({
    meta: [
      { title: "OUSD Exchange Integration — OpenPay Network" },
      {
        name: "description",
        content:
          "Integrate OUSD on OpenPay Network into exchanges and apps: deposit, withdraw, swap, Partner Transfer API, inbound Pro credits, and Ledger.",
      },
      { property: "og:title", content: "OUSD Exchange Integration — OpenPay Network" },
      {
        property: "og:description",
        content:
          "Partner guide to list OpenPay / OUSD like a network asset — APIs for deposit, withdraw, and reconciliation.",
      },
      { property: "og:url", content: "https://openpaypro.space/docs/exchange" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/docs/exchange" }],
  }),
  component: ExchangeDocsPage,
});

const PARTNER_BASE =
  "https://araojncyittkahvvpdrn.supabase.co/functions/v1/partner-transfer-api";
const PARTNER_PORTAL = "https://openpy.space/partner-api";
const PRO_HOST = "https://openpaypro.space";

const DOCS_SPEECH = `
OUSD Exchange Integration. OpenPay Network.

OUSD is OpenPay’s ledger dollar on the open network — not a public on-chain ERC-20.
Exchanges and apps integrate it like another network: register a partner app, fund a hot wallet,
then wire deposit, withdraw, and optional swap using Partner Transfer API and OpenPay Pro inbound.

Deposit with charges or transfers to your OpenPay tag. Withdraw with POST transfers and idempotency keys.
Reconcile with the public Ledger API. Full markdown is at slash api slash public slash docs slash exchange.
`.trim();

function copy(text: string, label = "Copied") {
  void copyText(text).then(
    () => toast.success(label),
    () => toast.error("Copy failed"),
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-foreground sm:text-xs">
      <code>{children}</code>
    </pre>
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
    <section id={id} className="scroll-mt-24 space-y-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ExchangeDocsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-sm font-semibold tracking-tight text-foreground">
            OpenPay Pro
          </Link>
          <div className="flex items-center gap-1.5">
            <PageListenButton text={DOCS_SPEECH} label="Listen" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <a href="/api/public/docs/exchange" target="_blank" rel="noreferrer">
                Raw MD
              </a>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <a href={PARTNER_PORTAL} target="_blank" rel="noreferrer">
                Partner portal
                <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8 pb-20">
        <div className="space-y-4">
          <Badge variant="secondary" className="rounded-full">
            Partners · Exchanges · Apps
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Integrate OUSD on OpenPay Network
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            List OpenPay like another network: deposit and withdraw{" "}
            <strong className="text-foreground">OUSD</strong> via Partner Transfer API, credit Pro
            wallets with inbound, and reconcile on the public ledger. Same model as wiring a
            chain — network id, address formats, hot wallet, explorer.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-full">
              <a href={PARTNER_PORTAL} target="_blank" rel="noreferrer">
                Create partner app
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/docs/openpay">Connect & payments docs</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => copy(PARTNER_BASE, "API base copied")}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy Partner API base
            </Button>
          </div>
        </div>

        <Card className="grid gap-3 rounded-3xl border-border bg-card p-5 shadow-none sm:grid-cols-2">
          {[
            ["Network", "openpay"],
            ["Asset", "OUSD (~$1 USD)"],
            ["Decimals", "8 ledger · 2 display"],
            ["Contract", "None (ledger API)"],
            ["Partner portal", "openpy.space/partner-api"],
            ["Explorer", `${PRO_HOST}/ledger`],
          ].map(([k, v]) => (
            <div key={k} className="space-y-0.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {k}
              </div>
              <div className="break-all text-sm font-medium text-foreground">{v}</div>
            </div>
          ))}
        </Card>

        <nav className="grid gap-2 rounded-3xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
          {[
            ["#network", "1. Network model"],
            ["#bases", "2. API bases"],
            ["#deposit", "3. Deposit"],
            ["#withdraw", "4. Withdraw"],
            ["#swap", "5. Swap"],
            ["#ledger", "6. Ledger / audit"],
            ["#checklist", "7. Launch checklist"],
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

        <Section id="network" eyebrow="Step 1" title="How OpenPay maps to a listed network">
          <Card className="space-y-3 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <p className="text-foreground">
              OUSD lives on OpenPay’s <strong>open network ledger</strong> (custodial balances). There
              is no public ERC-20 / SPL mint for partners to scrape. Treat OpenPay as{" "}
              <strong>network + REST</strong>, like integrating a ledger chain via API.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Exchange concept</th>
                    <th className="py-2 font-medium">OpenPay / OUSD</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  {[
                    ["Network", "openpay"],
                    ["Native asset", "OUSD"],
                    ["Deposit address", "@user · OP… · Pro 0x…"],
                    ["Confirmations", "Idempotent API receipt"],
                    ["Hot wallet", "Partner OpenPay account (API key)"],
                    ["Explorer", "Public Ledger API + /ledger"],
                  ].map(([a, b]) => (
                    <tr key={a} className="border-b border-border/60">
                      <td className="py-2 pr-3">{a}</td>
                      <td className="py-2">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-3">
              <Network className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                Full JSON listing metadata (decimals, address patterns, API URLs) is in{" "}
                <a
                  href="/api/public/docs/exchange"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  /api/public/docs/exchange
                </a>
                .
              </p>
            </div>
          </Card>
        </Section>

        <Section id="bases" eyebrow="Step 2" title="API base URLs">
          <Card className="space-y-4 rounded-3xl border-border bg-card p-5 text-sm shadow-none">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">Partner Transfer API</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-full"
                  onClick={() => copy(PARTNER_BASE, "Copied")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Code>{PARTNER_BASE}</Code>
              <p className="text-xs text-muted-foreground">
                Auth: <code className="rounded bg-muted px-1">Authorization: Bearer opk_live_…</code>
                — endpoints: <code className="rounded bg-muted px-1">/me</code>,{" "}
                <code className="rounded bg-muted px-1">/balance</code>,{" "}
                <code className="rounded bg-muted px-1">/transfers</code>,{" "}
                <code className="rounded bg-muted px-1">/charges</code>,{" "}
                <code className="rounded bg-muted px-1">/accounts/:id</code>
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">Pro inbound (credit Pro wallets)</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-full"
                  onClick={() =>
                    copy(`${PRO_HOST}/api/public/openpay/inbound`, "Copied")
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Code>{`POST ${PRO_HOST}/api/public/openpay/inbound`}</Code>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">Public Ledger API</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-full"
                  onClick={() => copy(`${PRO_HOST}/api/public/ledger`, "Copied")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Code>{`${PRO_HOST}/api/public/ledger`}</Code>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Never put <code className="rounded bg-muted px-1 text-foreground">opk_live_</code> in
              browsers or mobile apps — key = hot wallet.
            </p>
          </Card>
        </Section>

        <Section id="deposit" eyebrow="Step 3" title="Deposit (user → your exchange)">
          <Card className="space-y-4 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <div className="flex items-start gap-3">
              <ArrowDownToLine className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-foreground">
                Recommended: create a <strong>charge</strong>, send the user to OpenPay checkout,
                poll until <code className="rounded bg-muted px-1">paid</code>, then credit their
                exchange balance (idempotent on charge id / reference).
              </p>
            </div>
            <Code>{`curl -X POST "${PARTNER_BASE}/charges" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 100.00,
    "currency": "OUSD",
    "description": "Deposit to ExchangeAccount#42",
    "reference": "dep_42_abc",
    "success_url": "https://your.exchange/deposits/openpay/success",
    "cancel_url": "https://your.exchange/deposits/openpay/cancel"
  }'`}</Code>
            <p>
              Also supported: users send OUSD to your published{" "}
              <code className="rounded bg-muted px-1 text-foreground">@partner</code> /{" "}
              <code className="rounded bg-muted px-1 text-foreground">OP…</code> hot wallet, or
              credit Pro users via{" "}
              <Link
                to="/docs/openpay"
                hash="openpay-to-pro"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                OpenPay → Pro inbound
              </Link>
              .
            </p>
          </Card>
        </Section>

        <Section id="withdraw" eyebrow="Step 4" title="Withdraw (your exchange → user)">
          <Card className="space-y-4 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <div className="flex items-start gap-3">
              <ArrowUpFromLine className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-foreground">
                Debit the user on your books, then{" "}
                <code className="rounded bg-muted px-1">POST /transfers</code> from your partner hot
                wallet. Always send an <strong>Idempotency-Key</strong>. Validate destinations with{" "}
                <code className="rounded bg-muted px-1">GET /accounts/:id</code>.
              </p>
            </div>
            <Code>{`curl -X POST "${PARTNER_BASE}/transfers" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: withdraw_user42_batch9" \\
  -d '{
    "to": "@satoshi",
    "amount": 50.00,
    "note": "Withdraw from YourExchange #9001"
  }'`}</Code>
          </Card>
        </Section>

        <Section id="swap" eyebrow="Step 5" title="Swap / convert">
          <Card className="space-y-3 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <div className="flex items-start gap-3">
              <ArrowLeftRight className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-2 text-foreground">
                <p>
                  <strong>On your exchange:</strong> hold OUSD inventory and list pairs (e.g.
                  OUSD/USDT) on your matching engine.
                </p>
                <p>
                  <strong>On OpenPay Pro:</strong> users swap in-app at{" "}
                  <Link
                    to="/swap"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    /swap
                  </Link>
                  ; movements appear on the ledger as{" "}
                  <code className="rounded bg-muted px-1">type: swap</code>.
                </p>
                <p className="text-muted-foreground">
                  There is no public partner endpoint that runs OpenDEX swaps for arbitrary users
                  yet — use transfers + your order book, or deep-link to Pro.
                </p>
              </div>
            </div>
          </Card>
        </Section>

        <Section id="ledger" eyebrow="Step 6" title="Ledger & reconciliation">
          <Card className="space-y-3 rounded-3xl border-border bg-card p-5 text-sm text-muted-foreground shadow-none">
            <p className="text-foreground">
              Poll{" "}
              <code className="rounded bg-muted px-1">GET {PRO_HOST}/api/public/ledger/entries</code>{" "}
              with <code className="rounded bg-muted px-1">asset=OUSD</code>. Auth with{" "}
              <code className="rounded bg-muted px-1">x-api-key</code> or Bearer (Ledger keys from
              admin). See{" "}
              <Link
                to="/docs/openpay"
                hash="ledger"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Ledger section
              </Link>{" "}
              and <code className="rounded bg-muted px-1">docs/LEDGER_API.md</code>.
            </p>
          </Card>
        </Section>

        <Section id="checklist" eyebrow="Step 7" title="Launch checklist">
          <ul className="space-y-2 text-sm">
            {[
              "Partner app registered; opk_live_ in secrets / KMS",
              "Hot wallet funded with OUSD",
              "Deposit: charges or transfer + idempotent credit",
              "Withdraw: /transfers + account validation",
              "Listing UI: network openpay · asset OUSD",
              "Optional: Pro inbound + Ledger API monitoring",
            ].map((item) => (
              <li key={item} className="flex gap-2 text-foreground">
                <span className="text-primary">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <Card className="mt-4 flex flex-wrap items-center gap-3 rounded-3xl border-border bg-card p-5 shadow-none">
            <BookOpen className="h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-foreground">Full reference</p>
              <p className="text-muted-foreground">
                Markdown:{" "}
                <a
                  href="/api/public/docs/exchange"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  /api/public/docs/exchange
                </a>{" "}
                · Connect guide:{" "}
                <Link to="/docs/openpay" className="text-primary underline-offset-2 hover:underline">
                  /docs/openpay
                </Link>
              </p>
            </div>
            <Button asChild className="rounded-full">
              <a href={PARTNER_PORTAL} target="_blank" rel="noreferrer">
                Partner portal
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          </Card>
        </Section>
      </main>
    </div>
  );
}
