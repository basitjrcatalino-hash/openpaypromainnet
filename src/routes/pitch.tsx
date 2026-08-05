import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  CandlestickChart,
  ChevronDown,
  ExternalLink,
  Globe2,
  Home,
  Presentation,
  Rocket,
  Users,
} from "lucide-react";
import { PageListenButton } from "@/components/page-listen-button";
import { MainTokensHighlight } from "@/components/main-tokens-highlight";
import {
  OUSD_LOGO_URL,
  OPENPAY_NETWORK_BADGE_URL,
  PI_NETWORK_LOGO_URL,
  SOL_LOGO_URL,
} from "@/lib/token-logos";
import { OPENPAY_AUTH_LOGO, OPENPAY_AI_MENU_ICON } from "@/lib/openpay-auth";
import { PHANTOM_WALLET_LOGO } from "@/lib/phantom";
import {
  ECOSYSTEM_MARKS,
  PARTNER_CATEGORIES,
  partnerListedTokens,
  partnerNetworks,
  tradeMarketStats,
  type PartnerMark,
} from "@/lib/openpay-partners";
import { cn } from "@/lib/utils";
import { fetchMajorUsdPrices, getCachedPiUsdPrice } from "@/lib/ledger-majors";

/**
 * Current raise targets (USD). Edit these — π equivalents use live Pi Network price.
 * OpenPay Pro = money app · OpenPay = open money network.
 */
const PITCH_RAISE = {
  openPayProUsd: 5_000_000,
  openPayNetworkUsd: 5_000_000,
} as const;

const TOTAL_RAISE_USD = PITCH_RAISE.openPayProUsd + PITCH_RAISE.openPayNetworkUsd;

function formatUsdCompact(n: number) {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString("en-US")}`;
}

function formatUsdFull(n: number) {
  return `$${n.toLocaleString("en-US")}`;
}

function formatPiAmount(pi: number) {
  if (pi >= 1_000_000_000) return `${(pi / 1_000_000_000).toFixed(2)}B π`;
  if (pi >= 1_000_000) return `${(pi / 1_000_000).toFixed(2)}M π`;
  if (pi >= 1_000) return `${(pi / 1_000).toFixed(1)}K π`;
  return `${pi.toLocaleString("en-US", { maximumFractionDigits: 0 })} π`;
}

function formatPiPrice(p: number) {
  if (p >= 1) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

const ETH_LOGO_URL = "https://assets.coingecko.com/coins/images/279/large/ethereum.png";
const BTC_LOGO_URL = "https://assets.coingecko.com/coins/images/1/large/bitcoin.png";
const BNB_LOGO_URL = "https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png";

const TITLE = "OpenPay Pro Pitch Deck — Investor overview";
const DESC =
  "Investor pitch for OpenPay and OpenPay Pro: OpenUSD, self-custody wallet, Spot & Perps, OpenToken, Partner API, OpenPay AI, roadmap, and capital allocation.";

const FEATURE_PILLARS = [
  {
    id: "money",
    title: "Money · OpenUSD + Pi",
    blurb: "Main tokens first — then majors and OpenTokens.",
    logos: [OUSD_LOGO_URL, PI_NETWORK_LOGO_URL],
    items: [
      "OpenUSD (OUSD) — primary $1 ledger dollar",
      "Pi Network — core Pro asset and OUSD top-up rail",
      "Unified wallet: OUSD, Pi, majors, OpenTokens, NFTs",
      "@username identity on the same ledger",
      "Display currencies (USD, EUR, PI, and more)",
    ],
  },
  {
    id: "trading",
    title: "Trading & OpenToken",
    blurb: "Spot, Perps, P2P, and community coins.",
    logo: OPENPAY_NETWORK_BADGE_URL,
    items: [
      "Spot trading vs OUSD with live books & charts",
      "Perpetuals with leverage, mark price & funding",
      "P2P marketplace — escrow ads, merchants, chat",
      "OpenToken bonding-curve launchpad",
      "OpenDEX swaps, discovery, watchlist, Live Chat",
    ],
  },
  {
    id: "markets",
    title: "Markets & discovery",
    blurb: "Majors, memes, and community listings.",
    logo: OUSD_LOGO_URL,
    items: [
      "Tokens list with live USD prices",
      "Trust Wallet hub — search, safety, trending",
      "TradingView charts on Spot & Perps",
      "CoinGecko · CoinMarketCap · exchange feeds",
    ],
  },
  {
    id: "rails",
    title: "Send, receive & deposit",
    blurb: "Move value in on open rails.",
    logos: [ETH_LOGO_URL, SOL_LOGO_URL, BNB_LOGO_URL, BTC_LOGO_URL],
    items: [
      "Send to @users, addresses, or OpenPay",
      "Receive QR & public /pay links",
      "MoonPay · Circle · Solana Pay · WalletConnect Pay",
      "Multi-chain: Ethereum, Base, BNB, Polygon, Solana…",
      "Pi Network and OpenPay Balance top-ups → OUSD",
    ],
  },
  {
    id: "security",
    title: "Security & self-custody",
    blurb: "Your keys. Open ledger. Your rules.",
    logo: PHANTOM_WALLET_LOGO,
    items: [
      "12/24-word recovery phrase",
      "PIN & biometrics",
      "Pi Verify KYC when required",
      "OpenPay OAuth for network features",
      "Not a closed bank silo",
    ],
  },
  {
    id: "ai",
    title: "OpenPay AI & agents",
    blurb: "Help without hiding how money moves.",
    logo: OPENPAY_AI_MENU_ICON,
    items: [
      "In-app OpenPay AI assistant",
      "Spoken answers (TTS)",
      "Agent Connect (MCP) for ChatGPT / Claude",
      "Read-oriented tools — no silent fund moves",
    ],
  },
  {
    id: "builders",
    title: "Builders & open network",
    blurb: "Same OUSD rails for apps and agents.",
    logo: OPENPAY_AUTH_LOGO,
    items: [
      "Partner API & Connect with OpenPay",
      "Public Ledger API & OpenLedger explorer",
      "In-app Developer console",
      "Docs, Wiki, Blog, FAQ",
    ],
  },
] as const;

const DEMO_EXPERIENCES = [
  {
    id: "spot",
    tag: "Spot",
    title: "Spot trade",
    body: "Buy and sell majors against OUSD with order books, TradingView charts, and clear fees.",
    href: "/trade",
    cta: "Try Spot demo",
    accent: "#1652f0",
    Icon: CandlestickChart,
    stats: (s: ReturnType<typeof tradeMarketStats>) => [
      { k: String(s.spot), v: "Spot markets" },
      { k: String(s.majors), v: "Majors" },
    ],
    preview: "spot" as const,
  },
  {
    id: "perp",
    tag: "Perpetuals",
    title: "Perpetual futures",
    body: "Trade with leverage on mark price — funding, liquidation clarity, and pro charting.",
    href: "/trade",
    cta: "Try Perps demo",
    accent: "#7c6cf0",
    Icon: CandlestickChart,
    stats: (s: ReturnType<typeof tradeMarketStats>) => [
      { k: String(s.perp), v: "Perp markets" },
      { k: "Live", v: "Funding · mark" },
    ],
    preview: "perp" as const,
  },
  {
    id: "p2p",
    tag: "P2P",
    title: "P2P marketplace",
    body: "Peer escrow ads, merchant wallets, order chat, and payment methods — cash-like OTC inside Pro.",
    href: "/p2p",
    cta: "Try P2P demo",
    accent: "#14f195",
    Icon: Users,
    stats: (_s: ReturnType<typeof tradeMarketStats>) => [
      { k: "Escrow", v: "Protected trades" },
      { k: "Chat", v: "In-order messaging" },
    ],
    preview: "p2p" as const,
  },
  {
    id: "opentoken",
    tag: "OpenToken",
    title: "OpenToken launchpad",
    body: "Mint community coins on bonding curves, trade vs OUSD, and jump into token rooms.",
    href: "/opentoken",
    cta: "Try OpenToken demo",
    accent: "#ab9ff2",
    Icon: Rocket,
    stats: (_s: ReturnType<typeof tradeMarketStats>) => [
      { k: "Curve", v: "Bonding launch" },
      { k: "OUSD", v: "Settle & mint fee" },
    ],
    preview: "opentoken" as const,
  },
] as const;

const AUTH_METHODS = [
  { name: "OpenPay", logo: OPENPAY_AUTH_LOGO },
  { name: "Pi Network", logo: PI_NETWORK_LOGO_URL },
  { name: "Phantom", logo: PHANTOM_WALLET_LOGO },
  { name: "Solana", logo: SOL_LOGO_URL },
  { name: "MetaMask", logo: "https://www.google.com/s2/favicons?domain=metamask.io&sz=128" },
  { name: "Telegram", logo: "https://cdn.simpleicons.org/telegram/26A5E4" },
] as const;

const ROADMAP = [
  {
    phase: "Live now",
    when: "Today",
    tone: "live" as const,
    items: [
      "OpenPay Pro wallet — OUSD, Pi, majors, OpenTokens",
      "OpenUSD settlement across send, swap, Spot & Perps",
      "Multi-rail deposits (cards, crypto, Solana Pay, Circle, Pi)",
      "Self-custody, OpenLedger, Partner API, OpenPay AI + MCP",
      "Auth: OpenPay, Pi, Phantom, Solana, MetaMask, WalletConnect, Telegram",
    ],
  },
  {
    phase: "Near term",
    when: "Next 6–12 months",
    tone: "near" as const,
    items: [
      "Deeper liquidity across listed majors and OpenToken markets",
      "Expanded exchange & payment partner coverage",
      "Stronger merchant tools — QR, pay links, Connect charges",
      "Growth in Pi-native and Solana-native distribution",
      "Compliance tooling and regional readiness",
    ],
  },
  {
    phase: "Mid term",
    when: "12–24 months",
    tone: "mid" as const,
    items: [
      "Scale OpenUSD as the default settlement unit for partners",
      "Institutional-grade reporting on public ledger rails",
      "Broader agent economy via MCP and Partner API",
      "Global onboarding funnels for wallets and merchants",
      "Network effects across OpenPay Balance ↔ Pro",
    ],
  },
  {
    phase: "Long term",
    when: "24 months+",
    tone: "long" as const,
    items: [
      "OpenPay as the open money network for people, apps, and agents",
      "OpenUSD ubiquitous across apps built on Partner API",
      "Self-custody money app category leadership",
      "Sustainable fee flywheel from trading, deposits, and builders",
    ],
  },
] as const;

const FUND_USE = [
  {
    pct: 35,
    title: "Product & engineering",
    body: "Core wallet, OpenUSD rails, Spot/Perps, OpenToken, AI/MCP, multi-chain deposits, and developer surfaces.",
  },
  {
    pct: 20,
    title: "Liquidity & market operations",
    body: "Depth for majors and OpenToken markets, settlement reliability, and healthy OUSD trading experience.",
  },
  {
    pct: 20,
    title: "Growth & partnerships",
    body: "User acquisition, Pi & wallet distribution, exchange/payment integrations, and merchant adoption.",
  },
  {
    pct: 15,
    title: "Security & compliance",
    body: "Self-custody hardening, audits, Pi Verify / KYC flows, and regional regulatory readiness.",
  },
  {
    pct: 10,
    title: "Operations & reserve",
    body: "Team ops, infrastructure, contingency, and long-horizon network resilience.",
  },
] as const;

const WHY_NOW = [
  {
    title: "One network dollar",
    body: "OpenUSD gives users cash-simple $1 thinking while builders settle on the same ledger unit.",
  },
  {
    title: "Distribution ready",
    body: "Pi Network, Phantom, Solana, MetaMask, Telegram, and OpenPay — many doors into one Pro account.",
  },
  {
    title: "Full stack, not a silo",
    body: "Wallet + trading + deposits + Partner API + public ledger + AI agents share open rails.",
  },
  {
    title: "Partner gravity",
    body: "TradingView, CoinGecko, MoonPay, Circle, Solana Pay, Trust Wallet, and exchange feeds already in the product story.",
  },
] as const;

const TOP_LINKS = [
  { label: "Website", href: "/website", Icon: Home },
  { label: "Pitch Deck", href: "/pitch", Icon: Presentation },
  { label: "OpenUSD", href: "/openusd", Icon: null },
  { label: "Blog", href: "/blog", Icon: null },
  { label: "About", href: "/about", Icon: null },
] as const;

function pitchSpeechText() {
  const stats = tradeMarketStats();
  return [
    "OpenPay Pro investor pitch deck.",
    "OpenPay is the open money network. OpenPay Pro is the self-custody money app on that network.",
    "Meet OpenUSD — OpenPay's one-dollar ledger dollar for hold, send, spend, and settle.",
    `Live markets: ${stats.majors} majors, ${stats.spot} spot, ${stats.perp} perpetuals, ${stats.networks} networks.`,
    "The problem: closed bank apps and fragmented crypto wallets force users to hop rails.",
    "The solution: one Pro home for OUSD, Pi, majors, and OpenTokens — with open ledger, Partner API, and agents.",
    "Experience Spot, Perpetuals, P2P, and OpenToken demos live in OpenPay Pro.",
    "Roadmap from live product to global open money network.",
    `The team is seeking ${formatUsdCompact(PITCH_RAISE.openPayProUsd)} for OpenPay Pro and ${formatUsdCompact(PITCH_RAISE.openPayNetworkUsd)} for OpenPay — ${formatUsdCompact(TOTAL_RAISE_USD)} total, payable in USD or Pi at the live π price.`,
    "Capital allocation prioritizes product, liquidity, growth, security, and operations.",
    "Join the open network. Build with us.",
  ].join(" ");
}

export const Route = createFileRoute("/pitch")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://openpaypro.space/pitch" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/pitch" }],
  }),
  component: PitchPage,
});

function PitchPage() {
  const stats = tradeMarketStats();
  const networks = partnerNetworks();
  const tokens = partnerListedTokens().slice(0, 24);
  const heroRef = useRef<HTMLElement | null>(null);
  const [activeNav, setActiveNav] = useState("cover");
  const [piUsd, setPiUsd] = useState(() => getCachedPiUsdPrice());
  const [raiseUnit, setRaiseUnit] = useState<"usd" | "pi">("usd");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const prices = await fetchMajorUsdPrices(["pi"]);
        if (!cancelled && prices.pi > 0) setPiUsd(prices.pi);
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const piSafe = piUsd > 0 ? piUsd : 0.079;
  const raiseRows = [
    {
      name: "OpenPay Pro",
      blurb: "Self-custody money app — wallet, OpenUSD, trading, deposits, AI",
      logo: OPENPAY_NETWORK_BADGE_URL,
      usd: PITCH_RAISE.openPayProUsd,
    },
    {
      name: "OpenPay",
      blurb: "Open money network — Balance, Partner API, Connect, OpenLedger",
      logo: OPENPAY_AUTH_LOGO,
      usd: PITCH_RAISE.openPayNetworkUsd,
    },
  ] as const;
  const totalPi = TOTAL_RAISE_USD / piSafe;

  useEffect(() => {
    const root = heroRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>("[data-rise]");
    nodes.forEach((el, i) => {
      el.style.setProperty("--rise-delay", `${70 + i * 65}ms`);
      requestAnimationFrame(() => el.classList.add("is-in"));
    });
  }, []);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-slide]"));
    if (!sections.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.getAttribute("data-slide");
        if (id) setActiveNav(id);
      },
      { rootMargin: "-35% 0px -45% 0px", threshold: [0.15, 0.4, 0.7] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("is-in");
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  const nav = [
    { id: "cover", label: "01" },
    { id: "thesis", label: "02" },
    { id: "problem", label: "03" },
    { id: "solution", label: "04" },
    { id: "openusd", label: "05" },
    { id: "product", label: "06" },
    { id: "demos", label: "07" },
    { id: "traction", label: "08" },
    { id: "model", label: "09" },
    { id: "roadmap", label: "10" },
    { id: "funds", label: "11" },
    { id: "raise", label: "12" },
    { id: "ask", label: "13" },
  ];

  return (
    <main className="opblog oppitch min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="oppitch-sky absolute inset-0" />
        <div className="oppitch-glow absolute -left-28 top-8 h-112 w-md rounded-full bg-[rgba(171,159,242,0.35)] blur-3xl" />
        <div className="oppitch-glow absolute -right-20 top-[42%] h-104 w-104 rounded-full bg-[rgba(124,108,240,0.18)] blur-3xl [animation-delay:1.4s]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-border/80 bg-[color-mix(in_srgb,var(--background)_88%,white)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
          <Link
            to="/website"
            className="flex shrink-0 items-center gap-2 font-extrabold tracking-tight"
          >
            <img src={OPENPAY_AUTH_LOGO} alt="" className="h-7 w-7 rounded-lg object-contain" />
            <span className="hidden sm:inline">OpenPay Pro</span>
          </Link>

          <nav className="ml-1 hidden items-center gap-1 lg:flex">
            {TOP_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-colors",
                  link.href === "/pitch"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {link.Icon ? <link.Icon className="h-3.5 w-3.5" strokeWidth={2.25} /> : null}
                {link.label}
              </Link>
            ))}
          </nav>

          <nav className="ml-auto flex max-w-[42vw] items-center gap-0.5 overflow-x-auto sm:max-w-none">
            {nav.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={cn(
                  "rounded-full px-2 py-1 text-sm font-bold tabular-nums transition-colors",
                  activeNav === n.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n.label}
              </a>
            ))}
          </nav>
          <Link
            to="/authpi"
            className="hidden shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-sm font-bold text-background sm:inline-flex"
          >
            Open wallet
          </Link>
        </div>

        <div className="flex gap-2 overflow-x-auto border-t border-border/60 px-4 py-2 lg:hidden scrollbar-none">
          {TOP_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm font-bold",
                link.href === "/pitch"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </header>

      <section
        id="cover"
        data-slide="cover"
        ref={heroRef}
        className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-7xl flex-col justify-center px-5 pb-16 pt-10 sm:px-8"
      >
        <p
          data-rise
          className="oppitch-rise oppitch-label inline-flex items-center gap-2 text-muted-foreground"
        >
          <Globe2 className="h-3.5 w-3.5" strokeWidth={2.25} />
          Investor overview · Confidential
        </p>
        <h1 data-rise className="oppitch-rise opblog-title mt-6">
          OpenPay
        </h1>
        <p data-rise className="oppitch-rise opblog-dek mt-5 max-w-3xl text-primary">
          The open money network — and OpenPay Pro, the self-custody money app built on it.
        </p>
        <p data-rise className="oppitch-rise oppitch-body mt-7 max-w-2xl text-muted-foreground">
          Hold, send, and settle in <span className="font-bold text-foreground">OpenUSD</span>.{" "}
          <span className="font-bold text-foreground">Pi Network</span> is a core Pro asset and
          top-up rail — then majors, OpenTokens, Spot, Perps, and P2P on one public ledger.
        </p>
        <div data-rise className="oppitch-rise mt-7 max-w-2xl">
          <MainTokensHighlight tone="lavender" compact />
        </div>
        <div data-rise className="oppitch-rise mt-9 flex flex-wrap items-center gap-3">
          <a
            href="#thesis"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-bold text-background"
          >
            Read the deck
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </a>
          <Link
            to="/openusd"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-6 py-3.5 text-base font-bold backdrop-blur"
          >
            Meet OpenUSD
          </Link>
          <Link
            to="/website"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-6 py-3.5 text-base font-bold backdrop-blur"
          >
            Website
          </Link>
          <PageListenButton
            id="page:pitch"
            text={pitchSpeechText()}
            variant="muted"
            className="rounded-full"
          />
        </div>
        <div data-rise className="oppitch-rise mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: String(stats.majors), v: "Listed majors" },
            { k: String(stats.spot), v: "Spot markets" },
            { k: String(stats.perp), v: "Perpetuals" },
            { k: String(stats.networks), v: "Live networks" },
          ].map((s) => (
            <div key={s.v} className="oppitch-stat px-4 py-4">
              <p className="oppitch-stat-num">{s.k}</p>
              <p className="mt-2.5 text-base font-semibold text-muted-foreground">{s.v}</p>
            </div>
          ))}
        </div>
        <a
          href="#thesis"
          className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 animate-bounce text-muted-foreground sm:block"
          aria-label="Scroll"
        >
          <ChevronDown className="h-5 w-5" />
        </a>
      </section>

      <div className="border-y border-border/80 bg-card/50 py-4 backdrop-blur-sm">
        <div className="oppitch-marquee overflow-hidden">
          <div className="oppitch-marquee-track flex w-max gap-10 px-6">
            {[...ECOSYSTEM_MARKS, ...ECOSYSTEM_MARKS].map((m, i) => (
              <MarkChip key={`${m.name}-${i}`} mark={m} />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-4 px-5 py-16 sm:px-8 sm:py-24">
        <Slide id="thesis" num="02" title="Thesis" kicker="Why this exists">
          <p className="opblog-dek max-w-3xl font-semibold">
            Money should move on an <span className="text-primary">open network</span> — not locked
            inside a closed bank app. OpenPay is that network. OpenPay Pro is how people use it
            every day.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <ThesisCard
              logo={OPENPAY_AUTH_LOGO}
              name="OpenPay"
              href="https://openpy.space"
              body="The open money network: Balance, Partner API, Connect, OpenLedger, OpenNFT, and the network thesis."
            />
            <ThesisCard
              logo={OPENPAY_NETWORK_BADGE_URL}
              name="OpenPay Pro"
              href="/website"
              body="The self-custody money app on that network — OUSD, Pi, majors, OpenTokens, trading, deposits, and OpenPay AI."
            />
          </div>
        </Slide>

        <Slide id="problem" num="03" title="The problem" kicker="Fragmented money">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                t: "Closed silos",
                b: "Banks and fintech apps trap balances behind walls — hard to inspect, hard to build on, hard to leave.",
              },
              {
                t: "Wallet chaos",
                b: "Users juggle chains, bridges, and apps just to hold dollars, majors, and community coins in one place.",
              },
              {
                t: "No shared dollar rail",
                b: "Builders and agents lack a simple $1 settlement unit that works across wallet, trade, and Partner API.",
              },
            ].map((p) => (
              <div key={p.t} data-reveal className="oppitch-reveal oppitch-panel p-6">
                <h3 className="oppitch-card-title">{p.t}</h3>
                <p className="mt-3 oppitch-body text-muted-foreground">{p.b}</p>
              </div>
            ))}
          </div>
        </Slide>

        <Slide id="solution" num="04" title="The solution" kicker="One Pro home">
          <p className="max-w-2xl oppitch-body text-muted-foreground">
            OpenPay Pro unifies network dollars, Pi, listed majors, and OpenTokens — with
            self-custody keys, a public ledger, and builder rails that speak OpenUSD.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_NOW.map((w) => (
              <div key={w.title} data-reveal className="oppitch-reveal oppitch-panel p-5">
                <h3 className="oppitch-card-title">{w.title}</h3>
                <p className="mt-2 oppitch-body text-muted-foreground">{w.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <p className="oppitch-label text-muted-foreground">Sign in your way</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {AUTH_METHODS.map((a) => (
                <div
                  key={a.name}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2"
                >
                  <img src={a.logo} alt="" className="h-5 w-5 rounded object-contain" />
                  <span className="text-sm font-bold">{a.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        <Slide id="openusd" num="05" title="OpenUSD + Pi" kicker="Main tokens">
          <MainTokensHighlight tone="lavender" className="mb-8" />
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <img
                  src={OUSD_LOGO_URL}
                  alt="OpenUSD"
                  className="h-16 w-16 rounded-2xl object-contain shadow-sm"
                />
                <div>
                  <h3 className="opblog-h2">OpenUSD</h3>
                  <p className="text-lg font-semibold text-primary">
                    OUSD · primary $1 ledger dollar
                  </p>
                </div>
              </div>
              <p className="oppitch-body mt-6 max-w-xl text-muted-foreground">
                OpenPay's ledger dollar — the primary Pro balance unit. Hold, send, spend, and
                settle with cash-simple $1 thinking and crypto settlement power.
              </p>
              <ul className="mt-6 space-y-3 text-lg font-semibold leading-snug">
                {[
                  "Settles OpenDEX swaps, Tokens buys, Spot & Perpetuals",
                  "Denominates Partner API and OpenLedger activity",
                  "Funded via Pi Network, OpenPay Balance, cards, USDC, Solana Pay, Circle, multi-chain",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/openusd"
                className="mt-8 inline-flex items-center gap-2 text-lg font-bold text-primary"
              >
                Full OpenUSD story
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="oppitch-panel flex-1 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <img
                  src={PI_NETWORK_LOGO_URL}
                  alt="Pi Network"
                  className="h-14 w-14 rounded-full object-contain shadow-sm"
                />
                <div>
                  <h3 className="oppitch-card-title">Pi Network</h3>
                  <p className="text-base font-semibold text-muted-foreground">
                    Core Pro asset · top-up rail
                  </p>
                </div>
              </div>
              <p className="oppitch-label mt-6 text-muted-foreground">This is New Money</p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="oppitch-card-title">OpenUSD</p>
                  <p className="mt-2 oppitch-body text-muted-foreground">
                    One-dollar OUSD thinking for everyday sends, merchant payouts, and clear
                    balances.
                  </p>
                </div>
                <div>
                  <p className="oppitch-card-title">Pi Network</p>
                  <p className="mt-2 oppitch-body text-muted-foreground">
                    Hold Pi beside OUSD — pay with π at live price and credit OpenUSD instantly.
                  </p>
                </div>
              </div>
              <div className="mt-8 flex items-center gap-3">
                <img src={PI_NETWORK_LOGO_URL} alt="" className="h-9 w-9 rounded-full" />
                <span className="text-muted-foreground">+</span>
                <img src={OUSD_LOGO_URL} alt="" className="h-9 w-9 rounded-full" />
                <span className="ml-auto text-sm font-bold text-muted-foreground">
                  Pi × OpenUSD
                </span>
              </div>
            </div>
          </div>
        </Slide>

        <Slide id="product" num="06" title="Product suite" kicker="Everything in Pro">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {FEATURE_PILLARS.map((f) => (
              <div
                key={f.id}
                data-reveal
                className="oppitch-reveal oppitch-panel flex flex-col p-5"
              >
                <div className="flex flex-col gap-3">
                  {"logos" in f && f.logos ? (
                    <div className="flex shrink-0 items-center -space-x-2" aria-hidden>
                      {f.logos.map((src) => (
                        <img
                          key={src}
                          src={src}
                          alt=""
                          className="h-9 w-9 rounded-full border-2 border-card bg-card object-contain shadow-sm"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ))}
                    </div>
                  ) : (
                    <img
                      src={"logo" in f ? f.logo : OPENPAY_AUTH_LOGO}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-xl object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="oppitch-card-title">{f.title}</h3>
                    <p className="mt-1.5 text-lg text-muted-foreground">{f.blurb}</p>
                  </div>
                </div>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {f.items.map((item) => (
                    <li key={item} className="text-lg leading-snug text-muted-foreground">
                      · {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="oppitch-body mt-6 text-muted-foreground">
            Full feature walkthrough on{" "}
            <Link to="/website" className="font-bold text-primary">
              /website
            </Link>
            . Or jump into live demos below.
          </p>
        </Slide>

        <Slide id="demos" num="07" title="Live demos" kicker="Experience the product">
          <p className="oppitch-body max-w-3xl text-muted-foreground">
            Highlighted for investors: <span className="font-bold text-foreground">Spot</span>,{" "}
            <span className="font-bold text-foreground">Perpetuals</span>,{" "}
            <span className="font-bold text-foreground">P2P</span>, and{" "}
            <span className="font-bold text-foreground">OpenToken</span>. Sign in once — then try
            the real OpenPay Pro experience.
          </p>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {DEMO_EXPERIENCES.map((demo) => {
              const Icon = demo.Icon;
              const demoStats = demo.stats(stats);
              return (
                <div
                  key={demo.id}
                  data-reveal
                  className="oppitch-reveal oppitch-panel overflow-hidden"
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="grid h-12 w-12 place-items-center rounded-2xl"
                          style={{ background: `${demo.accent}22`, color: demo.accent }}
                        >
                          <Icon className="h-6 w-6" strokeWidth={2.25} />
                        </div>
                        <div>
                          <p className="oppitch-label" style={{ color: demo.accent }}>
                            {demo.tag}
                          </p>
                          <h3 className="oppitch-card-title mt-1">{demo.title}</h3>
                        </div>
                      </div>
                      <Link
                        to="/authpi"
                        search={{ next: demo.href }}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-sm font-bold text-background"
                      >
                        {demo.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <p className="oppitch-body mt-4 text-muted-foreground">{demo.body}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {demoStats.map((s) => (
                        <span
                          key={s.v}
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-sm font-bold"
                        >
                          <span className="tabular-nums text-foreground">{s.k}</span>
                          <span className="text-muted-foreground">{s.v}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <DemoPreview kind={demo.preview} accent={demo.accent} />
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/authpi"
              search={{ next: "/dashboard" }}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-bold text-background"
            >
              Open full wallet demo
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>
            <a
              href="/website#features"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-base font-bold"
            >
              All features on website
            </a>
            <Link
              to="/wiki"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-base font-bold"
            >
              Wiki tutorials
            </Link>
          </div>
        </Slide>

        <Slide
          id="traction"
          num="08"
          title="Ecosystem & traction"
          kicker="Partners · markets · networks"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: `${stats.majors}+`, v: "Majors listed" },
              { k: String(stats.spot), v: "Spot markets" },
              { k: String(stats.perp), v: "Perp markets" },
              { k: String(stats.networks), v: "Networks" },
            ].map((s) => (
              <div key={s.v} className="oppitch-stat px-4 py-5 text-center">
                <p className="oppitch-stat-num">{s.k}</p>
                <p className="mt-2.5 text-base font-semibold text-muted-foreground">{s.v}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 space-y-8">
            {PARTNER_CATEGORIES.map((cat) => (
              <div key={cat.id} data-reveal className="oppitch-reveal">
                <h3 className="oppitch-card-title">{cat.title}</h3>
                <p className="mt-1.5 text-lg text-muted-foreground">{cat.blurb}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {cat.partners.map((p) => (
                    <div
                      key={p.name}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5"
                      title={p.blurb}
                    >
                      <img src={p.logo} alt="" className="h-4 w-4 object-contain" />
                      <span className="text-sm font-bold">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <p className="oppitch-label text-muted-foreground">Networks</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {networks.map((n) => (
                <MarkChip key={n.name} mark={n} />
              ))}
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card/60 py-4">
            <div className="oppitch-marquee">
              <div className="oppitch-marquee-track flex w-max gap-8 px-4">
                {[...tokens, ...tokens].map((t, i) => (
                  <MarkChip key={`${t.name}-${i}`} mark={t} />
                ))}
              </div>
            </div>
          </div>
        </Slide>

        <Slide id="model" num="09" title="Business model" kicker="How value accrues">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                t: "Trading & markets",
                b: "OpenDEX, Spot, and Perpetuals settle in OUSD — fee-aware quotes with professional charting.",
              },
              {
                t: "OpenToken economy",
                b: "Bonding-curve launches mint and trade against OUSD — community coins on shared rails.",
              },
              {
                t: "Rails & builders",
                b: "Deposits, Partner API, Connect charges, and agent tooling grow with network usage.",
              },
            ].map((m) => (
              <div key={m.t} data-reveal className="oppitch-reveal oppitch-panel p-6">
                <h3 className="oppitch-card-title">{m.t}</h3>
                <p className="mt-3 oppitch-body text-muted-foreground">{m.b}</p>
              </div>
            ))}
          </div>
          <p className="oppitch-body mt-8 max-w-2xl text-muted-foreground">
            OpenPay Pro is positioned like a network-native money app: grow users and builders on
            the same OpenUSD ledger — similar in ambition to how open networks scale distribution
            first, then deepen economic activity.
          </p>
        </Slide>

        <Slide id="roadmap" num="10" title="Roadmap" kicker="Where capital goes to work">
          <div className="relative space-y-4 before:absolute before:left-[0.85rem] before:top-3 before:bottom-3 before:w-px before:bg-border sm:before:left-[1.1rem]">
            {ROADMAP.map((r) => (
              <div
                key={r.phase}
                data-reveal
                className="oppitch-reveal relative grid gap-3 pl-10 sm:grid-cols-[10rem_1fr] sm:pl-12"
              >
                <div className="absolute left-0 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary text-xs font-bold text-primary-foreground shadow sm:h-8 sm:w-8">
                  {r.tone === "live" ? "●" : "○"}
                </div>
                <div>
                  <p className="oppitch-card-title">{r.phase}</p>
                  <p className="text-base font-semibold text-muted-foreground">{r.when}</p>
                </div>
                <ul className="oppitch-panel space-y-2.5 p-4 sm:p-5">
                  {r.items.map((item) => (
                    <li key={item} className="text-lg leading-snug text-muted-foreground">
                      · {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Slide>

        <Slide id="funds" num="11" title="Use of funds" kicker="Capital allocation">
          <p className="oppitch-body max-w-2xl text-muted-foreground">
            How the {formatUsdCompact(TOTAL_RAISE_USD)} raise ({formatPiAmount(totalPi)} at live π)
            is allocated — product-first, with liquidity, distribution, security, and operational
            resilience.
          </p>
          <div className="mt-8 space-y-4">
            {FUND_USE.map((f) => {
              const sliceUsd = (TOTAL_RAISE_USD * f.pct) / 100;
              const slicePi = sliceUsd / piSafe;
              return (
                <div key={f.title} data-reveal className="oppitch-reveal">
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-3">
                    <p className="oppitch-card-title">
                      <span className="tabular-nums text-primary">{f.pct}%</span> · {f.title}
                    </p>
                    <p className="text-base font-bold tabular-nums text-muted-foreground">
                      {formatUsdCompact(sliceUsd)}
                      <span className="mx-1.5 text-muted-foreground/50">·</span>
                      {formatPiAmount(slicePi)}
                    </p>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="oppitch-bar h-full rounded-full bg-linear-to-r from-primary to-[#7c6cf0]"
                      style={{ width: `${f.pct}%` }}
                    />
                  </div>
                  <p className="mt-2 oppitch-body text-muted-foreground">{f.body}</p>
                </div>
              );
            })}
          </div>
        </Slide>

        <Slide id="raise" num="12" title="The raise" kicker="What the team is seeking">
          <div className="flex flex-wrap items-center gap-3">
            <p className="oppitch-body max-w-2xl text-muted-foreground">
              Capital for OpenPay Pro and the OpenPay network — accept{" "}
              <span className="font-bold text-foreground">USD</span> or{" "}
              <span className="font-bold text-foreground">Pi</span> at the live π market price.
            </p>
            <div className="ml-auto inline-flex rounded-full border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setRaiseUnit("usd")}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-bold transition-colors",
                  raiseUnit === "usd"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                USD
              </button>
              <button
                type="button"
                onClick={() => setRaiseUnit("pi")}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-bold transition-colors",
                  raiseUnit === "pi"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Pi (π)
              </button>
            </div>
          </div>

          <div className="mt-6 inline-flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <img src={PI_NETWORK_LOGO_URL} alt="" className="h-9 w-9 rounded-full object-contain" />
            <div>
              <p className="oppitch-label text-muted-foreground">Live Pi price</p>
              <p className="oppitch-card-title tabular-nums">1 π = {formatPiPrice(piSafe)}</p>
            </div>
            <p className="ml-auto max-w-xs text-sm leading-snug text-muted-foreground sm:text-base">
              Conversion updates from market data so investors see exactly how much π matches the
              USD ask.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {raiseRows.map((row) => {
              const piAmt = row.usd / piSafe;
              return (
                <div key={row.name} data-reveal className="oppitch-reveal oppitch-panel p-6 sm:p-8">
                  <div className="flex items-center gap-3">
                    <img src={row.logo} alt="" className="h-12 w-12 rounded-2xl object-contain" />
                    <div>
                      <h3 className="oppitch-card-title">{row.name}</h3>
                      <p className="mt-1 text-base text-muted-foreground">{row.blurb}</p>
                    </div>
                  </div>
                  <p className="oppitch-stat-num mt-8 text-foreground">
                    {raiseUnit === "usd" ? formatUsdCompact(row.usd) : formatPiAmount(piAmt)}
                  </p>
                  <p className="mt-3 oppitch-body text-muted-foreground">
                    {raiseUnit === "usd" ? (
                      <>
                        {formatUsdFull(row.usd)} · ≈ {formatPiAmount(piAmt)}
                      </>
                    ) : (
                      <>
                        ≈ {formatUsdFull(row.usd)} at {formatPiPrice(piSafe)} / π
                      </>
                    )}
                  </p>
                </div>
              );
            })}
          </div>

          <div
            data-reveal
            className="oppitch-reveal mt-6 rounded-2xl border-2 border-primary/35 bg-primary/10 p-6 sm:p-8"
          >
            <p className="oppitch-label text-muted-foreground">Total raise</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="oppitch-stat-num">
                  {raiseUnit === "usd"
                    ? formatUsdCompact(TOTAL_RAISE_USD)
                    : formatPiAmount(totalPi)}
                </p>
                <p className="oppitch-body mt-3 text-muted-foreground">
                  {raiseUnit === "usd" ? (
                    <>
                      {formatUsdFull(TOTAL_RAISE_USD)} total · ≈ {formatPiAmount(totalPi)}
                    </>
                  ) : (
                    <>≈ {formatUsdFull(TOTAL_RAISE_USD)} · OpenPay Pro + OpenPay network</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2">
                <img src={PI_NETWORK_LOGO_URL} alt="" className="h-6 w-6 rounded-full" />
                <span className="text-base font-bold">USD or Pi accepted</span>
              </div>
            </div>
          </div>
        </Slide>

        <Slide id="ask" num="13" title="The opportunity" kicker="Why invest">
          <p className="opblog-dek max-w-3xl font-semibold">
            Back the open money stack: <span className="text-primary">OpenPay</span> as the network,{" "}
            <span className="text-primary">OpenPay Pro</span> as the daily money app, and{" "}
            <span className="text-primary">OpenUSD</span> as the shared dollar rail.
          </p>
          <p className="oppitch-body mt-5 max-w-2xl text-muted-foreground">
            Seeking {formatUsdCompact(TOTAL_RAISE_USD)} ({formatPiAmount(totalPi)} at{" "}
            {formatPiPrice(piSafe)} / π) to scale product, liquidity, partners, and the open
            network.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                t: "Product live",
                b: "Wallet, markets, deposits, AI, and builder APIs shipping today.",
              },
              { t: "Clear wedge", b: "OUSD + Pi + majors in one self-custody home." },
              {
                t: "Network upside",
                b: "Partners, agents, and apps compound on open ledger rails.",
              },
            ].map((x) => (
              <div key={x.t} className="oppitch-panel p-5">
                <p className="oppitch-card-title">{x.t}</p>
                <p className="mt-2 oppitch-body text-muted-foreground">{x.b}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              to="/authpi"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-bold text-background"
            >
              Open OpenPay Pro
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>
            <a
              href="https://openpy.space/whitepaper"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-base font-bold"
            >
              Whitepaper
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link
              to="/website"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-base font-bold"
            >
              Website
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-base font-bold"
            >
              About the network
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-base font-bold"
            >
              <BookOpen className="h-4 w-4" />
              Developer portal
            </Link>
          </div>
        </Slide>
      </div>

      <footer className="border-t border-border bg-card/60 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <img src={OPENPAY_AUTH_LOGO} alt="" className="h-8 w-8 rounded-lg" />
            <div>
              <p className="oppitch-card-title">OpenPay Pro</p>
              <p className="text-xs text-muted-foreground">openpaypro.space/pitch</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-bold text-muted-foreground">
            <Link to="/website" className="hover:text-foreground">
              Website
            </Link>
            <Link to="/pitch" className="hover:text-foreground">
              Pitch Deck
            </Link>
            <Link to="/openusd" className="hover:text-foreground">
              OpenUSD
            </Link>
            <Link to="/blog" className="hover:text-foreground">
              Blog
            </Link>
            <a
              href="https://openpy.space"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              OpenPay
            </a>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-7xl px-5 text-[11px] leading-relaxed text-muted-foreground sm:px-8">
          This overview is for informational purposes and does not constitute an offer to sell or a
          solicitation of an offer to buy securities. Product features and market counts reflect the
          live OpenPay Pro catalog and may change.
        </p>
      </footer>
    </main>
  );
}

function Slide({
  id,
  num,
  title,
  kicker,
  children,
}: {
  id: string;
  num: string;
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-slide={id}
      data-reveal
      className="oppitch-reveal oppitch-slide scroll-mt-24 p-6 sm:p-10"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <p className="oppitch-label text-muted-foreground">{kicker}</p>
          <h2 className="opblog-h2 mt-2">{title}</h2>
        </div>
        <span className="oppitch-stat-num text-primary/30 tabular-nums">{num}</span>
      </div>
      {children}
    </section>
  );
}

function ThesisCard({
  logo,
  name,
  body,
  href,
}: {
  logo: string;
  name: string;
  body: string;
  href: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-3">
        <img src={logo} alt="" className="h-10 w-10 rounded-xl object-contain" />
        <h3 className="oppitch-card-title">{name}</h3>
      </div>
      <p className="mt-4 oppitch-body text-muted-foreground">{body}</p>
    </>
  );
  if (href.startsWith("http")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        data-reveal
        className="oppitch-reveal oppitch-panel block p-6 transition hover:border-primary/50"
      >
        {inner}
      </a>
    );
  }
  return (
    <Link
      to={href}
      data-reveal
      className="oppitch-reveal oppitch-panel block p-6 transition hover:border-primary/50"
    >
      {inner}
    </Link>
  );
}

function DemoPreview({
  kind,
  accent,
}: {
  kind: "spot" | "perp" | "p2p" | "opentoken";
  accent: string;
}) {
  if (kind === "spot" || kind === "perp") {
    const rows =
      kind === "spot"
        ? [
            { side: "ask", p: "68,420", s: "0.42" },
            { side: "ask", p: "68,410", s: "1.10" },
            { side: "bid", p: "68,390", s: "0.88" },
            { side: "bid", p: "68,380", s: "2.05" },
          ]
        : [
            { side: "ask", p: "68,450", s: "12.4×" },
            { side: "ask", p: "68,430", s: "8.0×" },
            { side: "bid", p: "68,370", s: "5.5×" },
            { side: "bid", p: "68,350", s: "15×" },
          ];
    return (
      <div className="border-t border-border bg-muted/40 px-5 py-4">
        <div className="mb-3 flex items-center justify-between text-sm font-bold">
          <span>{kind === "spot" ? "BTC / OUSD · Spot" : "BTC-PERP · Mark"}</span>
          <span style={{ color: accent }}>{kind === "spot" ? "Book live" : "Funding 0.01%"}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <span>Side</span>
          <span className="text-right">Price</span>
          <span className="text-right">{kind === "spot" ? "Size" : "Lev"}</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <div
              key={`${r.side}-${r.p}`}
              className="grid grid-cols-3 gap-2 rounded-lg px-2 py-1.5 text-sm font-bold tabular-nums"
              style={{
                background: r.side === "ask" ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.1)",
              }}
            >
              <span className={r.side === "ask" ? "text-red-500" : "text-emerald-600"}>
                {r.side.toUpperCase()}
              </span>
              <span className="text-right">{r.p}</span>
              <span className="text-right text-muted-foreground">{r.s}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "p2p") {
    return (
      <div className="border-t border-border bg-muted/40 px-5 py-4">
        <div className="mb-3 flex items-center justify-between text-sm font-bold">
          <span>P2P · Buy OUSD</span>
          <span style={{ color: accent }}>Escrow on</span>
        </div>
        <div className="space-y-2">
          {[
            { m: "Merchant · Pi Pay", rate: "1.00 OUSD", lim: "50–2,000" },
            { m: "Merchant · Bank", rate: "0.998 OUSD", lim: "100–5,000" },
          ].map((ad) => (
            <div
              key={ad.m}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-extrabold">{ad.m}</p>
                <p className="text-xs text-muted-foreground">Limit {ad.lim}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-extrabold tabular-nums">{ad.rate}</p>
                <p className="text-xs font-bold" style={{ color: accent }}>
                  Trade
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-muted/40 px-5 py-4">
      <div className="mb-3 flex items-center justify-between text-sm font-bold">
        <span>OpenToken · Bonding curve</span>
        <span style={{ color: accent }}>+12.4%</span>
      </div>
      <div className="flex items-end gap-1.5 h-16">
        {[28, 34, 32, 44, 48, 55, 52, 68, 74, 82].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md"
            style={{
              height: `${h}%`,
              background: `linear-gradient(180deg, ${accent}, ${accent}55)`,
            }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm font-bold">
        <span className="inline-flex items-center gap-2">
          <img src={OPENPAY_NETWORK_BADGE_URL} alt="" className="h-5 w-5 rounded-full" />
          Community coin
        </span>
        <span className="tabular-nums text-muted-foreground">Mint · Trade · Chat</span>
      </div>
    </div>
  );
}

function MarkChip({ mark }: { mark: PartnerMark }) {
  return (
    <div className="inline-flex shrink-0 items-center gap-2.5">
      <img src={mark.logo} alt="" className="h-7 w-7 object-contain" />
      <span className="text-base font-bold whitespace-nowrap text-foreground/85">{mark.name}</span>
    </div>
  );
}
