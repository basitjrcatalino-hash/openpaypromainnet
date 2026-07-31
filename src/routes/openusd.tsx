import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ExternalLink,
  Globe2,
  Layers,
  Newspaper,
  Send,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { OUSD_LOGO_URL } from "@/lib/token-logos";
import { cn } from "@/lib/utils";

const TITLE = "Meet OpenUSD (OUSD) — OpenPay’s dollar on the open network";
const DESC =
  "OpenUSD (OUSD) is OpenPay’s $1 ledger dollar — hold, send, spend, and build across OpenPay Pro, OpenLedger, OpenApp, and the wider OpenPay ecosystem.";

export const Route = createFileRoute("/openusd")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: "Meet OpenUSD (OUSD)" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://openpaypro.space/openusd" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/openusd" }],
  }),
  component: OusdPage,
});

const FEATURES = [
  {
    title: "Spend and send like cash",
    body: "Move OUSD to @usernames, wallet addresses, or OpenPay accounts — instant ledger settlement inside OpenPay Pro.",
    visual: "send",
  },
  {
    title: "One place for your money",
    body: "OUSD sits beside Pi, majors, and OpenTokens in a single Pro balance — top up, swap, deposit, and pay without hopping apps.",
    visual: "wallet",
  },
  {
    title: "Built for the open network",
    body: "Partner APIs, OpenLedger, OpenApp, and agents all speak OUSD — so builders and users share the same dollar rail.",
    visual: "network",
  },
] as const;

const BULLETS = [
  {
    icon: Wallet,
    title: "View your balance in one place",
    body: "See OUSD with your other OpenPay Pro assets as one clear home-screen balance.",
  },
  {
    icon: Zap,
    title: "Move money fast",
    body: "Top up from OpenPay Balance, Pi, cards, or crypto — then send without the usual rails friction.",
  },
  {
    icon: Send,
    title: "Frictionless transfers",
    body: "Pay friends by @username or Pro address. Scan receive QRs for any Pro token, including OUSD.",
  },
  {
    icon: Layers,
    title: "Trade and build on $1",
    body: "Swap majors and OpenTokens against OUSD, and integrate Partner API payments denominated in the same dollar.",
  },
] as const;

const ECOSYSTEM = [
  { label: "Try OpenPay (Pi Browser)", href: "https://openpy.space" },
  { label: "OpenLedger", href: "https://openpyledger.space" },
  { label: "OpenApp", href: "https://openappdev.space" },
  { label: "OpenPay Blogs", href: "https://www.openpy.space/blog" },
  { label: "Telegram Mini App", href: "https://t.me/openpayofficial" },
  { label: "OpenPay Sign in", href: "https://openpy.space/signin" },
  { label: "Follow OpenPay", href: "https://droplinkpi.space/@openpay" },
  { label: "Whitepaper", href: "https://openpy.space/whitepaper" },
  { label: "Pitch Deck", href: "https://openpy.space/pitch-deck" },
  { label: "OpenNFT Marketplace", href: "https://openpy.space/web3/nft" },
  { label: "Partner API Docs", href: "https://openpy.space/partner-api" },
] as const;

const FAQS = [
  {
    q: "What is OpenUSD (OUSD)?",
    a: "OpenUSD (OUSD) is OpenPay’s ledger dollar used across OpenPay Pro and the OpenPay ecosystem. In OpenPay Pro it is the primary balance unit — $1.00 OUSD is designed to track one US dollar for spending, sending, and settling inside the network.",
  },
  {
    q: "What can I do with OUSD?",
    a: "Hold OUSD in OpenPay Pro, top up from OpenPay Balance / Pi / cards / crypto, send to people and merchants, swap into other assets, receive via QR, and build partner flows that settle in OUSD through OpenPay’s Partner API and OpenLedger.",
  },
  {
    q: "How is OUSD different from bank cash?",
    a: "OUSD lives on OpenPay’s open network ledger — inspectable, API-friendly, and portable across OpenPay products — while still behaving like a stable dollar for everyday transfers inside the ecosystem.",
  },
  {
    q: "Where can I learn more or build on OpenPay?",
    a: "Read the OpenPay AI announcement, explore OpenLedger, review Partner API docs, or open the OpenPay whitepaper and pitch deck from the ecosystem links on this page.",
  },
] as const;

function OusdPage() {
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = heroRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-rise]").forEach((el, i) => {
      el.style.setProperty("--rise-delay", `${90 + i * 80}ms`);
      requestAnimationFrame(() => el.classList.add("is-in"));
    });
  }, []);

  return (
    <main className="opcash min-h-screen text-[var(--foreground)]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="opcash-sky absolute inset-0" />
        <div className="opcash-cloud absolute -left-10 top-24 h-40 w-56 opacity-70" />
        <div className="opcash-cloud opcash-cloud-b absolute right-[-2rem] top-[18%] h-48 w-64 opacity-60" />
        <div className="opcash-cloud opcash-cloud-c absolute bottom-[12%] left-[18%] h-36 w-52 opacity-50" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 pb-28 pt-8 sm:px-8">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Link
            to="/authpi"
            className="rounded-full bg-white/70 px-3 py-1.5 text-[var(--foreground)]/80 backdrop-blur hover:text-[var(--foreground)]"
          >
            OpenPay Pro
          </Link>
          <span className="text-[var(--muted-foreground)]">›</span>
          <span className="rounded-full bg-white/70 px-3 py-1.5 backdrop-blur">OpenUSD</span>
          <a
            href="https://www.openpy.space/blog/meet-openpay-ai"
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/80 px-3 py-1.5 text-[var(--muted-foreground)] backdrop-blur hover:text-[var(--foreground)]"
          >
            Announcement
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </nav>

        {/* Hero — Phantom Cash style: brand + product stage */}
        <header
          ref={heroRef}
          className="relative grid min-h-[78vh] items-center gap-10 pb-16 pt-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8"
        >
          <div className="relative z-10 max-w-xl">
            <p
              data-rise
              className="opcash-rise inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]"
            >
              <img src={OUSD_LOGO_URL} alt="" className="h-5 w-5 rounded-md object-cover" />
              OpenUSD · OUSD
            </p>
            <h1
              data-rise
              className="opcash-rise mt-5 font-[family-name:var(--font-display)] text-[clamp(2.8rem,7.5vw,5rem)] font-extrabold leading-[0.92] tracking-[-0.045em]"
            >
              Meet OpenUSD
            </h1>
            <p data-rise className="opcash-rise mt-5 text-xl font-semibold tracking-tight sm:text-2xl">
              OpenPay’s dollar for the open network.
            </p>
            <p
              data-rise
              className="opcash-rise mt-4 max-w-md text-base leading-relaxed text-[var(--muted-foreground)] sm:text-lg"
            >
              Hold, send, and settle in OUSD across OpenPay Pro — with the power of crypto and the
              ease of cash.
            </p>
            <div data-rise className="opcash-rise mt-8 flex flex-wrap gap-3">
              <Link
                to="/authpi"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--foreground)] px-6 py-3 text-sm font-bold text-white press"
              >
                Get OUSD in OpenPay Pro
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </Link>
              <a
                href="https://openpy.space/partner-api"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-6 py-3 text-sm font-semibold backdrop-blur press"
              >
                Partner API
              </a>
            </div>
          </div>

          <div data-rise className="opcash-rise relative mx-auto w-full max-w-md lg:max-w-none">
            <ProductStage />
          </div>
        </header>

        {/* This is New Money */}
        <section className="border-t border-[var(--border)]/80 py-20 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold tracking-[-0.04em]">
            This is New Money
          </h2>
          <div className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
            <div className="rounded-[1.75rem] bg-white/75 px-6 py-8 shadow-[0_20px_60px_-40px_rgba(30,60,90,0.35)] backdrop-blur">
              <Sparkles className="mx-auto h-8 w-8 text-[var(--accent)]" strokeWidth={1.75} />
              <p className="mt-4 text-lg font-bold">The power of crypto</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                Ledger settlement, APIs, agents, and multi-rail top-ups — without giving up dollar
                clarity.
              </p>
            </div>
            <div className="rounded-[1.75rem] bg-white/75 px-6 py-8 shadow-[0_20px_60px_-40px_rgba(30,60,90,0.35)] backdrop-blur">
              <Globe2 className="mx-auto h-8 w-8 text-[var(--accent)]" strokeWidth={1.75} />
              <p className="mt-4 text-lg font-bold">The ease of cash</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                $1 OUSD thinking for everyday sends, receives, and merchant payouts across OpenPay.
              </p>
            </div>
          </div>
        </section>

        {/* Feature stories */}
        <section className="space-y-24 border-t border-[var(--border)]/80 py-20">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={cn(
                "grid items-center gap-10 lg:grid-cols-2 lg:gap-14",
                i % 2 === 1 && "lg:[&>*:first-child]:order-2",
              )}
            >
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
                  {f.title}
                </h3>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-[var(--muted-foreground)]">
                  {f.body}
                </p>
              </div>
              <FeatureVisual kind={f.visual} />
            </div>
          ))}
        </section>

        {/* Bullet grid */}
        <section className="border-t border-[var(--border)]/80 py-20">
          <h2 className="max-w-2xl font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            Everything you need from a network dollar
          </h2>
          <ul className="mt-12 grid gap-8 sm:grid-cols-2">
            {BULLETS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="min-w-0">
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
                  <Icon className="h-5 w-5" strokeWidth={2.1} />
                </div>
                <h3 className="text-lg font-bold tracking-tight">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted-foreground)]">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Powered by OUSD */}
        <section className="border-t border-[var(--border)]/80 py-20 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Powered by
          </p>
          <div className="mt-5 inline-flex items-center gap-3">
            <img src={OUSD_LOGO_URL} alt="" className="h-12 w-12 rounded-2xl object-cover shadow-md" />
            <span className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">
              OUSD
            </span>
          </div>
          <p className="mx-auto mt-4 max-w-lg text-[var(--muted-foreground)]">
            OpenUSD keeps OpenPay Pro, OpenLedger, and partner apps on one clear dollar unit.
          </p>
          <a
            href="https://openpyledger.space"
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)] hover:underline"
          >
            Explore OpenLedger
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>

        {/* News / announcement */}
        <section className="border-t border-[var(--border)]/80 py-20">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            New news
          </p>
          <a
            href="https://www.openpy.space/blog/meet-openpay-ai"
            target="_blank"
            rel="noreferrer"
            className="group mt-6 flex flex-col gap-5 rounded-[1.75rem] bg-white/80 p-6 shadow-[0_24px_70px_-48px_rgba(30,60,90,0.45)] backdrop-blur transition hover:-translate-y-0.5 sm:flex-row sm:items-center sm:p-8"
          >
            <div className="grid h-24 w-full shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#d7f0ff,#e8fff6)] sm:h-28 sm:w-40">
              <Newspaper className="h-10 w-10 text-[var(--accent)]" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Announcement · OpenPay
              </p>
              <h3 className="mt-1 text-xl font-bold tracking-tight group-hover:underline sm:text-2xl">
                Meet OpenPay AI — read the announcement
              </h3>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                How OpenPay is opening the network for assistants, partners, and everyday money.
              </p>
            </div>
            <ExternalLink className="hidden h-5 w-5 shrink-0 text-[var(--muted-foreground)] sm:block" />
          </a>
        </section>

        {/* Ecosystem */}
        <section className="border-t border-[var(--border)]/80 py-20">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            OpenPay ecosystem
          </h2>
          <p className="mt-3 max-w-xl text-[var(--muted-foreground)]">
            OUSD sits at the center of OpenPay’s products — explore every door into the network.
          </p>
          <ul className="mt-8 grid gap-2 sm:grid-cols-2">
            {ECOSYSTEM.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)]/80 bg-white/70 px-4 py-3.5 text-sm font-semibold backdrop-blur transition hover:border-[var(--accent)]/40 hover:bg-white"
                >
                  <span>{item.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="border-t border-[var(--border)]/80 py-20">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            FAQ
          </h2>
          <div className="mt-8 space-y-2">
            {FAQS.map((item) => (
              <FaqItem key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-8 overflow-hidden rounded-[2rem] bg-[var(--foreground)] px-6 py-12 text-white sm:px-10 sm:py-14">
          <h2 className="max-w-xl font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            Start with OpenUSD in OpenPay Pro
          </h2>
          <p className="mt-4 max-w-lg text-white/70">
            Open your wallet, top up OUSD, and join the open network — or build on Partner API and
            OpenLedger today.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/authpi"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white press"
            >
              Open OpenPay Pro
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>
            <a
              href="https://openpy.space"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/90 press"
            >
              <BookOpen className="h-4 w-4" />
              Try OpenPay
            </a>
          </div>
        </section>

        <p className="mt-10 text-center text-xs leading-relaxed text-[var(--muted-foreground)]">
          OUSD is OpenPay’s network dollar for use inside OpenPay products. Always review in-app
          disclosures for fees, availability, and settlement details.
        </p>
      </div>
    </main>
  );
}

function ProductStage() {
  return (
    <div className="relative aspect-[4/5] w-full sm:aspect-square">
      <div className="opcash-float absolute left-[6%] top-[8%] z-20 w-[72%] rounded-[1.4rem] bg-white p-4 shadow-[0_28px_80px_-36px_rgba(20,50,80,0.45)]">
        <div className="flex items-center gap-2">
          <img src={OUSD_LOGO_URL} alt="" className="h-8 w-8 rounded-xl object-cover" />
          <div>
            <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">My balance</p>
            <p className="text-lg font-extrabold tracking-tight">$2,480.00</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f0f7ff] px-3 py-2.5">
          <span className="text-xs font-semibold text-[var(--muted-foreground)]">OUSD</span>
          <span className="text-sm font-bold">2,480.00</span>
        </div>
      </div>

      <div className="opcash-float-b absolute bottom-[10%] right-[2%] z-10 w-[68%] rounded-[1.4rem] bg-white p-4 shadow-[0_28px_80px_-36px_rgba(20,50,80,0.4)]">
        <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">You get</p>
        <div className="mt-2 flex items-center gap-2">
          <img src={OUSD_LOGO_URL} alt="" className="h-7 w-7 rounded-lg object-cover" />
          <span className="text-sm font-bold">OUSD</span>
        </div>
        <p className="mt-3 text-2xl font-extrabold tracking-tight">$250.00</p>
        <p className="mt-1 text-xs font-semibold text-emerald-600">Instantly</p>
      </div>

      <div className="absolute left-1/2 top-1/2 z-0 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(56,168,255,0.28),transparent_70%)]" />
    </div>
  );
}

function FeatureVisual({ kind }: { kind: "send" | "wallet" | "network" }) {
  const copy =
    kind === "send"
      ? { title: "Send OUSD", line: "To @alice · $42.00" }
      : kind === "wallet"
        ? { title: "Home balance", line: "OUSD · Pi · OpenTokens" }
        : { title: "Open network", line: "API · Ledger · Agents" };

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-white/80 p-8 shadow-[0_24px_70px_-48px_rgba(30,60,90,0.4)] backdrop-blur">
      <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(56,168,255,0.2),transparent_70%)]" />
      <div className="relative rounded-2xl border border-[var(--border)] bg-[#f7fbff] p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          OpenPay Pro
        </p>
        <p className="mt-3 text-xl font-extrabold tracking-tight">{copy.title}</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{copy.line}</p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white">
          <div className="opcash-bar h-full w-2/3 rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)]/80 bg-white/75 backdrop-blur">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left press"
      >
        <span className="text-[15px] font-bold tracking-tight">{question}</span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-[var(--muted-foreground)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-300",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm leading-relaxed text-[var(--muted-foreground)]">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}
