import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowLeftRight,
  Bot,
  ExternalLink,
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

const NAV = [
  { label: "OpenUSD", href: "/openusd" },
  { label: "About", href: "/about" },
  { label: "Wiki", href: "/wiki" },
  { label: "Blog", href: "/blog" },
  { label: "Docs", href: "/docs/openpay" },
] as const;

const TRADE_POINTS = [
  "Buy and sell majors against OUSD in an instant.",
  "Mint and trade OpenTokens on bonding curves.",
  "Watch trending assets and keep a personal watchlist.",
  "Deposit from Ethereum, Base, BNB, Polygon, Solana, and more.",
  "Power builders with Partner API, Connect, and OpenLedger.",
] as const;

const MONEY_POINTS = [
  "One home for OUSD, Pi, majors, OpenTokens, and NFTs.",
  "Send in seconds — wallet address, @username, or QR.",
  "Top up from OpenPay Balance, Pi, cards, or crypto.",
  "Meet OpenUSD: OpenPay’s $1 ledger dollar for everyday settlement.",
] as const;

const SECURITY_POINTS = [
  "Self-custody means you control your funds — we never hold your keys.",
  "PIN, biometrics, and recovery phrase stay under your control.",
  "Every credit and debit is a ledger entry you can inspect.",
  "OpenPay AI and MCP agents help without hiding the rails.",
] as const;

const ECOSYSTEM = [
  { label: "Try OpenPay", href: "https://openpy.space" },
  { label: "OpenLedger", href: "https://openpyledger.space" },
  { label: "OpenApp", href: "https://openappdev.space" },
  { label: "Partner API", href: "https://openpy.space/partner-api" },
  { label: "Whitepaper", href: "https://openpy.space/whitepaper" },
  { label: "Pitch Deck", href: "https://openpy.space/pitch-deck" },
  { label: "OpenNFT", href: "https://openpy.space/web3/nft" },
  { label: "Telegram Mini App", href: "https://t.me/openpayofficial" },
  { label: "Blogs", href: "https://www.openpy.space/blog" },
  { label: "Follow OpenPay", href: "https://droplinkpi.space/@openpay" },
  { label: "Meet OpenPay AI", href: "https://www.openpy.space/blog/meet-openpay-ai" },
  { label: "OpenPay Sign in", href: "https://openpy.space/signin" },
] as const;

function HomePage() {
  const heroRef = useRef<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const root = heroRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-rise]").forEach((el, i) => {
      el.style.setProperty("--rise-delay", `${70 + i * 75}ms`);
      requestAnimationFrame(() => el.classList.add("is-in"));
    });
  }, []);

  return (
    <main className="ophome min-h-screen text-[var(--foreground)]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="ophome-sky absolute inset-0" />
        <div className="ophome-blob absolute -left-24 top-10 h-80 w-80 rounded-full bg-[rgba(22,82,240,0.16)] blur-3xl" />
        <div className="ophome-blob absolute right-[-4rem] top-[22%] h-96 w-96 rounded-full bg-[rgba(20,241,149,0.14)] blur-3xl [animation-delay:1.4s]" />
        <div className="ophome-blob absolute bottom-[8%] left-[30%] h-72 w-72 rounded-full bg-[rgba(56,189,248,0.12)] blur-3xl [animation-delay:2.2s]" />
      </div>

      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)]/60 bg-[rgba(244,250,255,0.78)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 press">
            <img src={OUSD_LOGO_URL} alt="" className="h-8 w-8 rounded-xl object-cover shadow-sm" />
            <span className="font-[family-name:var(--font-display)] text-lg font-extrabold tracking-tight">
              OpenPay Pro
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) =>
              item.href.startsWith("http") ? (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--muted-foreground)] hover:bg-white/70 hover:text-[var(--foreground)]"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  to={item.href}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--muted-foreground)] hover:bg-white/70 hover:text-[var(--foreground)]"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/authpi"
              className="hidden rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-bold text-white press sm:inline-flex"
            >
              Open wallet
            </Link>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-white/80 md:hidden"
              aria-expanded={menuOpen}
              aria-label="Menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="sr-only">Menu</span>
              <div className="space-y-1.5">
                <span className="block h-0.5 w-4 bg-[var(--foreground)]" />
                <span className="block h-0.5 w-4 bg-[var(--foreground)]" />
              </div>
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div className="border-t border-[var(--border)]/70 bg-white/95 px-5 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/authpi"
                onClick={() => setMenuOpen(false)}
                className="mt-2 rounded-full bg-[var(--foreground)] px-4 py-3 text-center text-sm font-bold text-white"
              >
                Open wallet
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
        {/* Hero — brand + one headline + dek + CTAs + dominant stage */}
        <section
          ref={heroRef}
          className="relative grid min-h-[calc(100vh-4rem)] items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-16"
        >
          <div className="relative z-10 max-w-xl">
            <p
              data-rise
              className="ophome-rise inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]"
            >
              <img src={OPENPAY_AUTH_LOGO} alt="" className="h-5 w-5 object-contain" />
              OpenPay ecosystem
            </p>
            <h1
              data-rise
              className="ophome-rise mt-5 font-[family-name:var(--font-display)] text-[clamp(2.9rem,8vw,5.4rem)] font-extrabold leading-[0.9] tracking-[-0.05em]"
            >
              OpenPay Pro
            </h1>
            <p
              data-rise
              className="ophome-rise mt-5 text-xl font-semibold tracking-tight sm:text-2xl"
            >
              The money app for the open network.
            </p>
            <p
              data-rise
              className="ophome-rise mt-4 max-w-md text-base leading-relaxed text-[var(--muted-foreground)] sm:text-lg"
            >
              Your home for trading crypto, settling in OUSD, paying with Pi, and building with open
              rails — all in one self-custody Pro wallet.
            </p>
            <div data-rise className="ophome-rise mt-8 flex flex-wrap gap-3">
              <Link
                to="/authpi"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-6 py-3.5 text-sm font-bold text-white shadow-[0_16px_40px_-18px_rgba(22,82,240,0.7)] press"
              >
                Open OpenPay Pro
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </Link>
              <Link
                to="/openusd"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-6 py-3.5 text-sm font-semibold backdrop-blur press"
              >
                Meet OpenUSD
              </Link>
            </div>
          </div>

          <div data-rise className="ophome-rise relative mx-auto w-full max-w-md lg:max-w-none">
            <HeroStage />
          </div>
        </section>

        {/* Trading tools */}
        <section className="border-t border-[var(--border)]/80 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                Trading tools
              </p>
              <h2 className="mt-3 max-w-xl font-[family-name:var(--font-display)] text-[clamp(2rem,4.5vw,3.4rem)] font-extrabold tracking-[-0.04em]">
                Trading tools for everyone
              </h2>
            </div>
            <Link
              to="/wiki"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--brand)] hover:underline"
            >
              See more
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-12 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <FeaturePanel
              eyebrow="Trading"
              title="Swap, mint, deposit"
              icon={<ArrowLeftRight className="h-5 w-5" strokeWidth={2.1} />}
            >
              <ul className="mt-5 space-y-3">
                {TRADE_POINTS.map((line) => (
                  <li key={line} className="flex gap-3 text-[15px] leading-relaxed text-[var(--muted-foreground)]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
                    {line}
                  </li>
                ))}
              </ul>
            </FeaturePanel>
            <ProductStrip kind="trade" />
          </div>
        </section>

        {/* Spend send save */}
        <section className="border-t border-[var(--border)]/80 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                Move money
              </p>
              <h2 className="mt-3 max-w-xl font-[family-name:var(--font-display)] text-[clamp(2rem,4.5vw,3.4rem)] font-extrabold tracking-[-0.04em]">
                Spend, send &amp; settle
              </h2>
            </div>
            <Link
              to="/openusd"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--brand)] hover:underline"
            >
              See more
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <ProductStrip kind="money" />
            <FeaturePanel
              eyebrow="OpenUSD"
              title="One home for your money"
              icon={<Wallet className="h-5 w-5" strokeWidth={2.1} />}
            >
              <ul className="mt-5 space-y-3">
                {MONEY_POINTS.map((line) => (
                  <li key={line} className="flex gap-3 text-[15px] leading-relaxed text-[var(--muted-foreground)]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mint)]" />
                    {line}
                  </li>
                ))}
              </ul>
            </FeaturePanel>
          </div>
        </section>

        {/* Security */}
        <section className="border-t border-[var(--border)]/80 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                Your security
              </p>
              <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-[clamp(2rem,4.5vw,3.4rem)] font-extrabold tracking-[-0.04em]">
                Controlled by you, secured on an open ledger
              </h2>
            </div>
            <Link
              to="/about"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--brand)] hover:underline"
            >
              See more
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-center">
            <FeaturePanel
              eyebrow="Self-custody"
              title="Your keys. Your network."
              icon={<ShieldCheck className="h-5 w-5" strokeWidth={2.1} />}
            >
              <ul className="mt-5 space-y-3">
                {SECURITY_POINTS.map((line) => (
                  <li key={line} className="flex gap-3 text-[15px] leading-relaxed text-[var(--muted-foreground)]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--foreground)]" />
                    {line}
                  </li>
                ))}
              </ul>
            </FeaturePanel>
            <div className="relative overflow-hidden rounded-[2rem] bg-[var(--foreground)] px-8 py-10 text-white">
              <Lock className="h-8 w-8 text-[var(--mint)]" strokeWidth={1.75} />
              <p className="mt-6 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.03em]">
                Trusted by the OpenPay community
              </p>
              <p className="mt-4 max-w-md text-white/70">
                It’s more than a wallet — address, @username, and Pi identity on the same open
                network, with AI and Partner API on the same rails.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
                  <img src={OUSD_LOGO_URL} alt="" className="h-4 w-4 rounded-md object-cover" />
                  OUSD
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
                  <img src={PI_NETWORK_LOGO_URL} alt="" className="h-4 w-4 rounded-full object-cover" />
                  Pi Network
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
                  <img src={OPENPAY_AI_MENU_ICON} alt="" className="h-4 w-4 object-contain" />
                  OpenPay AI
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
                  <img src={OPENPAY_NETWORK_BADGE_URL} alt="" className="h-4 w-4 object-contain" />
                  Open network
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Ecosystem */}
        <section className="border-t border-[var(--border)]/80 py-20">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3rem)] font-extrabold tracking-[-0.04em]">
            OpenPay ecosystem
          </h2>
          <p className="mt-3 max-w-xl text-[var(--muted-foreground)]">
            OpenPay Pro sits inside the wider OpenPay network — explore every product, doc, and
            surface.
          </p>
          <ul className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ECOSYSTEM.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)]/80 bg-white/70 px-4 py-3.5 text-sm font-semibold backdrop-blur transition hover:border-[var(--brand)]/35 hover:bg-white"
                >
                  <span>{item.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* Get started */}
        <section className="mt-4 overflow-hidden rounded-[2rem] bg-[var(--brand)] px-6 py-14 text-white sm:px-12 sm:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Get started</p>
          <h2 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold tracking-[-0.04em]">
            Open OpenPay Pro.
          </h2>
          <p className="mt-4 max-w-lg text-lg text-white/80">
            Sign in with OpenPay, Phantom, Pi, Telegram, email, and more — then hold OUSD, send,
            swap, and build on the open ledger.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/authpi"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[var(--brand)] press"
            >
              Open wallet
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>
            <a
              href="https://openpy.space/partner-api"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3.5 text-sm font-semibold text-white press"
            >
              Partner API
            </a>
            <a
              href="https://www.openpy.space/blog/meet-openpay-ai"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3.5 text-sm font-semibold text-white press"
            >
              <Bot className="h-4 w-4" />
              Meet OpenPay AI
            </a>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border)]/80 bg-white/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2">
              <img src={OUSD_LOGO_URL} alt="" className="h-8 w-8 rounded-xl object-cover" />
              <span className="font-[family-name:var(--font-display)] text-lg font-extrabold">
                OpenPay Pro
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[var(--muted-foreground)]">
              Self-custody Web3 wallet for the OpenPay ecosystem.
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
              { label: "OpenPay Docs", href: "/docs/openpay" },
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
        <div className="border-t border-[var(--border)]/70">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-[var(--muted-foreground)] sm:px-8">
            <p>© {new Date().getFullYear()} OpenPay Pro</p>
            <div className="flex flex-wrap gap-4">
              <Link to="/terms" className="hover:text-[var(--foreground)]">
                Terms
              </Link>
              <Link to="/privacy" className="hover:text-[var(--foreground)]">
                Privacy
              </Link>
              <Link to="/regulatory" className="hover:text-[var(--foreground)]">
                Regulatory
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function HeroStage() {
  return (
    <div className="relative aspect-[4/5] w-full sm:aspect-square">
      <div className="ophome-float absolute left-[4%] top-[6%] z-20 w-[78%] rounded-[1.6rem] bg-white p-5 shadow-[0_32px_90px_-40px_rgba(12,40,80,0.45)]">
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
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-[#f0f6ff] px-2 py-3"
            >
              <Icon className="h-4 w-4 text-[var(--brand)]" strokeWidth={2.1} />
              <span className="text-[10px] font-bold">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ophome-float-b absolute bottom-[8%] right-[0%] z-10 w-[70%] rounded-[1.6rem] bg-white p-4 shadow-[0_28px_80px_-36px_rgba(12,40,80,0.4)]">
        <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">Assets</p>
        <div className="mt-3 space-y-2.5">
          <AssetRow logo={OUSD_LOGO_URL} name="OpenUSD" amount="2,480.00" />
          <AssetRow logo={PI_NETWORK_LOGO_URL} name="Pi" amount="1,204.50" />
          <AssetRow logo={OPENPAY_NETWORK_BADGE_URL} name="OpenToken" amount="312.08" />
        </div>
      </div>

      <div className="absolute left-1/2 top-1/2 z-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(22,82,240,0.22),transparent_70%)]" />
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

function FeaturePanel({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)] backdrop-blur">
        <span className="text-[var(--brand)]">{icon}</span>
        {eyebrow}
      </div>
      <h3 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ProductStrip({ kind }: { kind: "trade" | "money" }) {
  if (kind === "trade") {
    return (
      <div className="relative overflow-hidden rounded-[2rem] bg-white/80 p-6 shadow-[0_24px_70px_-48px_rgba(12,40,80,0.4)] backdrop-blur sm:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(22,82,240,0.18),transparent_70%)]" />
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          OpenDEX · Swap
        </p>
        <p className="mt-3 text-2xl font-extrabold tracking-tight">OUSD → SOL</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Instant · 0.30% fee</p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#e8f0fb]">
          <div className="ophome-bar h-full w-2/3 rounded-full bg-[var(--brand)]" />
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#f3f8ff] px-4 py-3">
          <img src={OPENPAY_NETWORK_BADGE_URL} alt="" className="h-8 w-8 object-contain" />
          <div>
            <p className="text-sm font-bold">OpenToken launch</p>
            <p className="text-xs text-[var(--muted-foreground)]">Bonding curve · graduate at 100k OUSD</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-white/80 p-6 shadow-[0_24px_70px_-48px_rgba(12,40,80,0.4)] backdrop-blur sm:p-8">
      <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(20,241,149,0.2),transparent_70%)]" />
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
                className="text-sm font-semibold text-[var(--foreground)]/85 hover:text-[var(--brand)]"
              >
                {link.label}
              </a>
            ) : (
              <Link
                to={link.href}
                className={cn(
                  "text-sm font-semibold text-[var(--foreground)]/85 hover:text-[var(--brand)]",
                )}
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
