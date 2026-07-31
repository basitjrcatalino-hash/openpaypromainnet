import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Bot,
  ChevronDown,
  ExternalLink,
  Globe2,
  Lock,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OUSD_LOGO_URL, OPENPAY_NETWORK_BADGE_URL, PI_NETWORK_LOGO_URL } from "@/lib/token-logos";
import { OPENPAY_AUTH_LOGO, OPENPAY_AI_MENU_ICON } from "@/lib/openpay-auth";
import { cn } from "@/lib/utils";

const TITLE = "OpenPay Pro — The money app for the open network";
const DESC =
  "Your home for OUSD, Pi, OpenTokens, and open money. Self-custody wallet, public ledger, Partner API, and OpenPay AI — one Pro account.";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://openpaypro.space/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/" }],
  }),
  component: HomePage,
});

type NavGroup = {
  label: string;
  items: ReadonlyArray<{ label: string; href: string; desc?: string }>;
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Features",
    items: [
      { label: "OpenUSD", href: "/openusd", desc: "OpenPay’s $1 ledger dollar" },
      { label: "OpenToken", href: "/wiki", desc: "Mint and trade on bonding curves" },
      { label: "Solana Pay", href: "/authpi", desc: "QR payments on Solana" },
      { label: "Multi-chain deposit", href: "/wiki", desc: "ETH, Base, BNB, Polygon, Solana…" },
    ],
  },
  {
    label: "Learn",
    items: [
      { label: "Wiki", href: "/wiki", desc: "Guides for every Pro feature" },
      { label: "Blog", href: "/blog", desc: "Product news and deep dives" },
      { label: "FAQ", href: "/docs/faq", desc: "Answers for wallets and OUSD" },
    ],
  },
  {
    label: "Explore",
    items: [
      { label: "OpenPay", href: "https://openpy.space", desc: "The open money network" },
      { label: "OpenLedger", href: "https://openpyledger.space", desc: "Public ledger explorer" },
      { label: "OpenPay AI", href: "https://www.openpy.space/blog/meet-openpay-ai", desc: "Agents on open rails" },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "About", href: "/about", desc: "Why OpenPay Pro exists" },
      { label: "Whitepaper", href: "https://openpy.space/whitepaper", desc: "Network thesis" },
      { label: "Pitch Deck", href: "https://openpy.space/pitch-deck", desc: "Product overview" },
    ],
  },
  {
    label: "Developers",
    items: [
      { label: "Docs", href: "/docs/openpay", desc: "Integrate OpenPay Pro" },
      { label: "Partner API", href: "https://openpy.space/partner-api", desc: "Apps & keys" },
      { label: "Agent Connect", href: "/docs/openpay", desc: "MCP for agents" },
    ],
  },
];

const TRADE_SLIDES = [
  {
    title: "Buy and sell majors against OUSD in an instant.",
    visual: "swap" as const,
  },
  {
    title: "Mint and trade OpenTokens on bonding curves.",
    visual: "mint" as const,
  },
  {
    title: "Watch trending assets and keep a personal watchlist.",
    visual: "watch" as const,
  },
  {
    title: "Deposit from Ethereum, Base, BNB, Polygon, Solana, and more.",
    visual: "deposit" as const,
  },
  {
    title: "Power builders with Partner API, Connect, and OpenLedger.",
    visual: "api" as const,
  },
] as const;

const MONEY_SLIDES = [
  {
    title: "One home for OUSD, Pi, majors, OpenTokens, and NFTs.",
    visual: "home" as const,
  },
  {
    title: "Send money in seconds — wallet, @username, or QR.",
    visual: "send" as const,
  },
  {
    title: "Settle in OpenUSD — OpenPay’s $1 ledger dollar.",
    visual: "ousd" as const,
  },
] as const;

const SECURITY_SLIDES = [
  {
    title: "Self-custody means you control your funds. We never hold your keys.",
    visual: "keys" as const,
  },
  {
    title: "PIN, biometrics, and recovery phrase stay under your control.",
    visual: "pin" as const,
  },
  {
    title: "Every credit and debit is a ledger entry you can inspect.",
    visual: "ledger" as const,
  },
  {
    title: "OpenPay AI and MCP agents help without hiding the rails.",
    visual: "ai" as const,
  },
] as const;

function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openNav, setOpenNav] = useState<string | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = heroRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-rise]").forEach((el, i) => {
      el.style.setProperty("--rise-delay", `${80 + i * 90}ms`);
      requestAnimationFrame(() => el.classList.add("is-in"));
    });
  }, []);

  useEffect(() => {
    const close = () => setOpenNav(null);
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, []);

  return (
    <main className="ophome min-h-screen text-[var(--foreground)]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="ophome-sky absolute inset-0" />
      </div>

      {/* Phantom-style floating header */}
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 press">
            <img
              src={OPENPAY_AUTH_LOGO}
              alt=""
              className="h-8 w-8 rounded-xl object-contain drop-shadow-sm"
            />
            <span className="font-[family-name:var(--font-display)] text-[1.05rem] font-extrabold tracking-[-0.03em] text-[var(--ink)]">
              OpenPay Pro
            </span>
          </Link>

          <nav className="ophome-pill hidden items-center gap-0.5 px-1.5 py-1.5 lg:flex">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="relative">
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-semibold text-[var(--ink)]/80 transition hover:bg-black/[0.04] hover:text-[var(--ink)]",
                    openNav === group.label && "bg-black/[0.05] text-[var(--ink)]",
                  )}
                  aria-expanded={openNav === group.label}
                  onClick={() => setOpenNav((v) => (v === group.label ? null : group.label))}
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 opacity-60 transition-transform",
                      openNav === group.label && "rotate-180",
                    )}
                  />
                </button>
                {openNav === group.label ? (
                  <div className="ophome-dropdown absolute left-1/2 top-[calc(100%+10px)] z-50 w-[280px] -translate-x-1/2 p-2">
                    {group.items.map((item) =>
                      item.href.startsWith("http") ? (
                        <a
                          key={item.href + item.label}
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-2xl px-3.5 py-2.5 hover:bg-[var(--lavender-soft)]"
                          onClick={() => setOpenNav(null)}
                        >
                          <p className="text-sm font-bold text-[var(--ink)]">{item.label}</p>
                          {item.desc ? (
                            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{item.desc}</p>
                          ) : null}
                        </a>
                      ) : (
                        <Link
                          key={item.href + item.label}
                          to={item.href}
                          className="block rounded-2xl px-3.5 py-2.5 hover:bg-[var(--lavender-soft)]"
                          onClick={() => setOpenNav(null)}
                        >
                          <p className="text-sm font-bold text-[var(--ink)]">{item.label}</p>
                          {item.desc ? (
                            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{item.desc}</p>
                          ) : null}
                        </Link>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            ))}
            <Link
              to="/docs/faq"
              className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-[var(--ink)]/80 transition hover:bg-black/[0.04] hover:text-[var(--ink)]"
            >
              Support
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/authpi" className="ophome-cta-pill hidden sm:inline-flex">
              Open wallet
            </Link>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/80 shadow-sm ring-1 ring-black/5 lg:hidden"
              aria-expanded={menuOpen}
              aria-label="Menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <div className="space-y-1.5">
                <span className="block h-0.5 w-4 bg-[var(--ink)]" />
                <span className="block h-0.5 w-4 bg-[var(--ink)]" />
              </div>
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="ophome-dropdown mx-auto mt-2 max-w-[1180px] p-3 lg:hidden">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                  {group.label}
                </p>
                {group.items.map((item) =>
                  item.href.startsWith("http") ? (
                    <a
                      key={item.href + item.label}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl px-3 py-2.5 text-sm font-semibold"
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={item.href + item.label}
                      to={item.href}
                      className="block rounded-xl px-3 py-2.5 text-sm font-semibold"
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ),
                )}
              </div>
            ))}
            <Link
              to="/authpi"
              onClick={() => setMenuOpen(false)}
              className="ophome-cta-pill mt-1 flex w-full justify-center"
            >
              Open wallet
            </Link>
          </div>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-[1180px] px-3 pb-10 sm:px-5">
        {/* Hero — full-bleed rounded plane like Phantom */}
        <section ref={heroRef} className="ophome-hero relative mt-3 overflow-hidden sm:mt-4">
          <div className="ophome-hero-glow" aria-hidden />
          <div className="relative z-10 mx-auto flex min-h-[min(78vh,720px)] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center sm:px-10 sm:py-20">
            <p
              data-rise
              className="ophome-rise text-[15px] font-medium tracking-[-0.01em] text-white/80 sm:text-lg"
            >
              The money app for the open network
            </p>
            <h1
              data-rise
              className="ophome-rise mt-4 font-[family-name:var(--font-display)] text-[clamp(2.4rem,7vw,4.35rem)] font-extrabold leading-[1.02] tracking-[-0.045em] text-white"
            >
              <span className="block text-white/95">OpenPay Pro</span>
              <span className="mt-2 block text-white">
                Your home for OUSD, Pi, OpenTokens, and more
              </span>
            </h1>
            <div data-rise className="ophome-rise mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to="/authpi" className="ophome-hero-cta">
                <Wallet className="h-4 w-4" strokeWidth={2.25} />
                Open OpenPay Pro
              </Link>
              <Link to="/openusd" className="ophome-hero-cta-ghost">
                Meet OpenUSD
              </Link>
            </div>
          </div>
        </section>

        {/* Trading tools */}
        <FeatureBand
          eyebrow="Trading"
          title="Trading tools for everyone"
          moreHref="/wiki"
          slides={TRADE_SLIDES}
          renderVisual={(v) => <TradeVisual kind={v} />}
        />

        {/* Move money */}
        <FeatureBand
          eyebrow="Move money"
          title="Spend, send & settle"
          moreHref="/openusd"
          slides={MONEY_SLIDES}
          renderVisual={(v) => <MoneyVisual kind={v} />}
          reverse
        />

        {/* Security */}
        <FeatureBand
          eyebrow="Your security"
          title="Controlled by you, secured on an open ledger"
          moreHref="/about"
          slides={SECURITY_SLIDES}
          renderVisual={(v) => <SecurityVisual kind={v} />}
        />

        {/* Trust band */}
        <section className="ophome-trust mt-6 overflow-hidden px-6 py-14 sm:mt-8 sm:px-12 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <Lock className="mx-auto h-8 w-8 text-[var(--lavender)]" strokeWidth={1.75} />
            <h2 className="mt-6 font-[family-name:var(--font-display)] text-[clamp(1.7rem,4vw,2.75rem)] font-extrabold tracking-[-0.035em] text-white">
              Trusted by the OpenPay community. It’s more than a wallet.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">
              Address, @username, and Pi identity on the same open network — with OpenUSD settlement,
              Partner API, OpenLedger, and OpenPay AI on the same rails.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
              {[
                { logo: OUSD_LOGO_URL, label: "OUSD" },
                { logo: PI_NETWORK_LOGO_URL, label: "Pi Network" },
                { logo: OPENPAY_AI_MENU_ICON, label: "OpenPay AI" },
                { logo: OPENPAY_NETWORK_BADGE_URL, label: "Open network" },
              ].map((b) => (
                <span
                  key={b.label}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-white"
                >
                  <img src={b.logo} alt="" className="h-4 w-4 rounded-md object-cover" />
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Ecosystem grid */}
        <section className="mt-16 sm:mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4 px-1">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                Ecosystem
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-[clamp(1.9rem,4vw,2.8rem)] font-extrabold tracking-[-0.04em]">
                Everything in the OpenPay network
              </h2>
            </div>
          </div>
          <ul className="mt-8 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Try OpenPay", href: "https://openpy.space" },
              { label: "OpenLedger", href: "https://openpyledger.space" },
              { label: "OpenApp", href: "https://openappdev.space" },
              { label: "Partner API", href: "https://openpy.space/partner-api" },
              { label: "Whitepaper", href: "https://openpy.space/whitepaper" },
              { label: "Pitch Deck", href: "https://openpy.space/pitch-deck" },
              { label: "OpenNFT", href: "https://openpy.space/web3/nft" },
              { label: "Telegram Mini App", href: "https://t.me/openpayofficial" },
              { label: "Meet OpenPay AI", href: "https://www.openpy.space/blog/meet-openpay-ai" },
            ].map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="ophome-eco flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold"
                >
                  <span>{item.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-40" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* Get started */}
        <section className="ophome-start mt-16 overflow-hidden px-6 py-14 text-center sm:mt-20 sm:px-12 sm:py-20">
          <p className="text-sm font-medium text-[var(--ink)]/55">Get started</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(2.2rem,6vw,3.8rem)] font-extrabold tracking-[-0.045em] text-[var(--ink)]">
            Open OpenPay Pro.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--muted-foreground)]">
            Sign in with OpenPay, Phantom, Pi, Telegram, email, and more — then hold OUSD, send, swap,
            and build on the open ledger.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/authpi" className="ophome-cta-pill text-[15px]">
              <Wallet className="h-4 w-4" />
              Open wallet
            </Link>
            <a
              href="https://openpy.space/partner-api"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--ink)]/12 bg-white/70 px-5 py-3 text-sm font-bold text-[var(--ink)] press"
            >
              Partner API
            </a>
            <a
              href="https://www.openpy.space/blog/meet-openpay-ai"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--ink)]/12 bg-white/70 px-5 py-3 text-sm font-bold text-[var(--ink)] press"
            >
              <Bot className="h-4 w-4" />
              Meet OpenPay AI
            </a>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="mt-8 border-t border-[var(--ink)]/8 bg-white/40">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <img src={OPENPAY_AUTH_LOGO} alt="" className="h-8 w-8 object-contain" />
              <span className="font-[family-name:var(--font-display)] text-lg font-extrabold tracking-tight">
                OpenPay Pro
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--muted-foreground)]">
              Self-custody money app for the OpenPay ecosystem — OUSD, Pi, OpenTokens, and open rails.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              { label: "Open wallet", href: "/authpi" },
              { label: "OpenUSD", href: "/openusd" },
              { label: "About", href: "/about" },
              { label: "Wiki", href: "/wiki" },
              { label: "Blog", href: "/blog" },
            ]}
          />
          <FooterCol
            title="Developers"
            links={[
              { label: "Docs", href: "/docs/openpay" },
              { label: "FAQ", href: "/docs/faq" },
              { label: "Partner API", href: "https://openpy.space/partner-api" },
              { label: "OpenLedger", href: "https://openpyledger.space" },
              { label: "Whitepaper", href: "https://openpy.space/whitepaper" },
            ]}
          />
          <FooterCol
            title="OpenPay"
            links={[
              { label: "OpenPay", href: "https://openpy.space" },
              { label: "OpenApp", href: "https://openappdev.space" },
              { label: "Pitch Deck", href: "https://openpy.space/pitch-deck" },
              { label: "Telegram", href: "https://t.me/openpayofficial" },
              { label: "Follow", href: "https://droplinkpi.space/@openpay" },
            ]}
          />
        </div>
        <div className="border-t border-[var(--ink)]/8">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-[var(--muted-foreground)] sm:px-8">
            <p>© {new Date().getFullYear()} OpenPay Pro</p>
            <div className="flex flex-wrap gap-4">
              <Link to="/terms" className="hover:text-[var(--ink)]">
                Terms
              </Link>
              <Link to="/privacy" className="hover:text-[var(--ink)]">
                Privacy
              </Link>
              <Link to="/regulatory" className="hover:text-[var(--ink)]">
                Regulatory
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureBand<T extends string>({
  eyebrow,
  title,
  moreHref,
  slides,
  renderVisual,
  reverse,
}: {
  eyebrow: string;
  title: string;
  moreHref: string;
  slides: ReadonlyArray<{ title: string; visual: T }>;
  renderVisual: (kind: T) => ReactNode;
  reverse?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const active = slides[idx] ?? slides[0];

  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [slides.length]);

  return (
    <section className="mt-16 sm:mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            {eyebrow}
          </p>
          <h2 className="mt-2 max-w-2xl font-[family-name:var(--font-display)] text-[clamp(1.9rem,4.2vw,3.1rem)] font-extrabold tracking-[-0.04em]">
            {title}
          </h2>
        </div>
        <Link
          to={moreHref}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--brand)] hover:underline"
        >
          See more
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div
        className={cn(
          "mt-10 grid items-center gap-8 lg:grid-cols-2 lg:gap-12",
          reverse && "lg:[&>*:first-child]:order-2",
        )}
      >
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)] shadow-sm ring-1 ring-black/[0.04]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--brand)]" />
            {eyebrow}
          </div>
          <ul className="space-y-1">
            {slides.map((slide, i) => (
              <li key={slide.title}>
                <button
                  type="button"
                  onClick={() => setIdx(i)}
                  className={cn(
                    "w-full rounded-2xl px-4 py-3.5 text-left text-[15px] leading-snug transition",
                    i === idx
                      ? "bg-white font-bold text-[var(--ink)] shadow-[0_12px_40px_-24px_rgba(40,30,80,0.35)] ring-1 ring-black/[0.04]"
                      : "font-medium text-[var(--muted-foreground)] hover:bg-white/50 hover:text-[var(--ink)]",
                  )}
                >
                  {slide.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="ophome-stage relative min-h-[320px] overflow-hidden p-6 sm:min-h-[380px] sm:p-8">
          <div key={active.visual} className="ophome-stage-in h-full">
            {renderVisual(active.visual)}
          </div>
        </div>
      </div>
    </section>
  );
}

function TradeVisual({ kind }: { kind: (typeof TRADE_SLIDES)[number]["visual"] }) {
  if (kind === "mint") {
    return (
      <StageCard>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          OpenToken
        </p>
        <p className="mt-3 text-2xl font-extrabold tracking-tight">Launch · bonding curve</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Graduate at 100k OUSD</p>
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[var(--lavender-soft)] px-4 py-3">
          <img src={OPENPAY_NETWORK_BADGE_URL} alt="" className="h-9 w-9 object-contain" />
          <div>
            <p className="text-sm font-bold">$OPEN sample</p>
            <p className="text-xs text-[var(--muted-foreground)]">Mint · trade · list</p>
          </div>
        </div>
      </StageCard>
    );
  }
  if (kind === "deposit") {
    return (
      <StageCard>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Multi-chain deposit
        </p>
        <p className="mt-3 text-2xl font-extrabold tracking-tight">Credit OUSD</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {["Ethereum", "Base", "BNB", "Polygon", "Solana"].map((c) => (
            <span
              key={c}
              className="rounded-full bg-[var(--lavender-soft)] px-3 py-1.5 text-xs font-bold text-[var(--ink)]"
            >
              {c}
            </span>
          ))}
        </div>
      </StageCard>
    );
  }
  if (kind === "api") {
    return (
      <StageCard>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Builders
        </p>
        <p className="mt-3 text-2xl font-extrabold tracking-tight">Partner API</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Connect · OpenLedger · MCP</p>
        <div className="mt-6 rounded-2xl bg-[var(--ink)] px-4 py-3 font-mono text-xs text-[var(--lavender)]">
          POST /v1/transfers
        </div>
      </StageCard>
    );
  }
  if (kind === "watch") {
    return (
      <StageCard>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Watchlist
        </p>
        <p className="mt-3 text-2xl font-extrabold tracking-tight">Trending now</p>
        <div className="mt-6 space-y-2.5">
          <AssetRow logo={OUSD_LOGO_URL} name="OpenUSD" amount="$1.00" />
          <AssetRow logo={PI_NETWORK_LOGO_URL} name="Pi" amount="Watch" />
          <AssetRow logo={OPENPAY_NETWORK_BADGE_URL} name="OpenToken" amount="+12.4%" />
        </div>
      </StageCard>
    );
  }
  return (
    <StageCard>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        OpenDEX · Swap
      </p>
      <p className="mt-3 text-2xl font-extrabold tracking-tight">OUSD → SOL</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">Instant · open network fee</p>
      <div className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--lavender-soft)]">
        <div className="ophome-bar h-full w-2/3 rounded-full bg-[var(--brand)]" />
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[var(--lavender-soft)] px-4 py-3">
        <ArrowLeftRight className="h-5 w-5 text-[var(--brand)]" />
        <div>
          <p className="text-sm font-bold">Swap majors</p>
          <p className="text-xs text-[var(--muted-foreground)]">Against OUSD liquidity</p>
        </div>
      </div>
    </StageCard>
  );
}

function MoneyVisual({ kind }: { kind: (typeof MONEY_SLIDES)[number]["visual"] }) {
  if (kind === "send") {
    return (
      <StageCard>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Send OUSD
        </p>
        <p className="mt-3 text-2xl font-extrabold tracking-tight">To @alice</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">$42.00 · Instant ledger settle</p>
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-[#eefbf5] px-4 py-3">
          <span className="text-sm font-semibold text-[var(--muted-foreground)]">You send</span>
          <span className="text-lg font-extrabold">42.00 OUSD</span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-600">
          <Send className="h-4 w-4" />
          Ready to send
        </div>
      </StageCard>
    );
  }
  if (kind === "ousd") {
    return (
      <StageCard>
        <div className="flex items-center gap-3">
          <img src={OUSD_LOGO_URL} alt="" className="h-12 w-12 rounded-2xl object-cover" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              OpenUSD
            </p>
            <p className="text-2xl font-extrabold tracking-tight">$1 ledger dollar</p>
          </div>
        </div>
        <p className="mt-5 text-sm leading-relaxed text-[var(--muted-foreground)]">
          Hold, send, and settle with the power of crypto and the ease of cash — on the open network.
        </p>
        <Link
          to="/openusd"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--brand)]"
        >
          Learn about OpenUSD
          <ArrowRight className="h-4 w-4" />
        </Link>
      </StageCard>
    );
  }
  return (
    <StageCard>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={OUSD_LOGO_URL} alt="" className="h-10 w-10 rounded-2xl object-cover" />
          <div>
            <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">Home balance</p>
            <p className="text-xl font-extrabold tracking-tight">$4,820.40</p>
          </div>
        </div>
        <Sparkles className="h-5 w-5 text-[var(--brand)]" strokeWidth={1.75} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Send", Icon: Send },
          { label: "Receive", Icon: QrCode },
          { label: "Swap", Icon: ArrowLeftRight },
        ].map(({ label, Icon }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-[var(--lavender-soft)] px-2 py-3"
          >
            <Icon className="h-4 w-4 text-[var(--brand)]" strokeWidth={2.1} />
            <span className="text-[10px] font-bold">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        <AssetRow logo={OUSD_LOGO_URL} name="OpenUSD" amount="2,480.00" />
        <AssetRow logo={PI_NETWORK_LOGO_URL} name="Pi" amount="1,204.50" />
      </div>
    </StageCard>
  );
}

function SecurityVisual({ kind }: { kind: (typeof SECURITY_SLIDES)[number]["visual"] }) {
  if (kind === "pin") {
    return (
      <StageCard dark>
        <ShieldCheck className="h-8 w-8 text-[var(--lavender)]" />
        <p className="mt-5 text-2xl font-extrabold tracking-tight text-white">PIN & biometrics</p>
        <p className="mt-2 text-sm text-white/65">Device lock stays on your hardware — not ours.</p>
      </StageCard>
    );
  }
  if (kind === "ledger") {
    return (
      <StageCard dark>
        <BookOpen className="h-8 w-8 text-[var(--lavender)]" />
        <p className="mt-5 text-2xl font-extrabold tracking-tight text-white">OpenLedger</p>
        <p className="mt-2 text-sm text-white/65">Inspect every credit and debit on the public rails.</p>
      </StageCard>
    );
  }
  if (kind === "ai") {
    return (
      <StageCard dark>
        <img src={OPENPAY_AI_MENU_ICON} alt="" className="h-10 w-10 object-contain" />
        <p className="mt-5 text-2xl font-extrabold tracking-tight text-white">OpenPay AI</p>
        <p className="mt-2 text-sm text-white/65">Agents help — without hiding how money moves.</p>
      </StageCard>
    );
  }
  return (
    <StageCard dark>
      <Lock className="h-8 w-8 text-[var(--lavender)]" />
      <p className="mt-5 text-2xl font-extrabold tracking-tight text-white">Your keys</p>
      <p className="mt-2 text-sm text-white/65">
        Self-custody wallet. Recovery phrase under your control. We never hold your funds.
      </p>
      <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-[var(--lavender)]">
        <Globe2 className="h-4 w-4" />
        Open network · not a closed bank app
      </div>
    </StageCard>
  );
}

function StageCard({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      className={cn(
        "relative h-full rounded-[1.75rem] p-6 sm:p-7",
        dark ? "bg-[#1a1528] text-white" : "bg-white text-[var(--ink)]",
      )}
    >
      {children}
    </div>
  );
}

function AssetRow({ logo, name, amount }: { logo: string; name: string; amount: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src={logo} alt="" className="h-7 w-7 rounded-full object-cover" />
      <span className="flex-1 text-sm font-semibold">{name}</span>
      <span className="text-sm font-bold tabular-nums">{amount}</span>
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        {title}
      </p>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href + link.label}>
            {link.href.startsWith("http") ? (
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-[var(--ink)]/85 hover:text-[var(--brand)]"
              >
                {link.label}
              </a>
            ) : (
              <Link
                to={link.href}
                className="text-sm font-semibold text-[var(--ink)]/85 hover:text-[var(--brand)]"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
