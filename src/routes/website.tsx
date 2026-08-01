import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Bot,
  ChevronDown,
  ExternalLink,
  Fingerprint,
  Globe2,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  MessageCircle,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
  Wallet,
  Zap,
} from "lucide-react";
import { OUSD_LOGO_URL, OPENPAY_NETWORK_BADGE_URL, PI_NETWORK_LOGO_URL } from "@/lib/token-logos";
import { OPENPAY_AUTH_LOGO, OPENPAY_AI_MENU_ICON } from "@/lib/openpay-auth";
import { useSpeech } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

const TITLE = "OpenPay Pro — The money app for the open network";
const DESC =
  "Your home for OUSD, Pi, OpenTokens, and open money. Self-custody wallet, public ledger, Partner API, and OpenPay AI — one Pro account.";

export const Route = createFileRoute("/website")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://openpaypro.space/website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/website" }],
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
      { label: "All features", href: "/website#features", desc: "Everything in OpenPay Pro" },
      { label: "OpenUSD", href: "/openusd", desc: "OpenPay’s $1 ledger dollar" },
      { label: "OpenToken", href: "/wiki", desc: "Mint and trade on bonding curves" },
      { label: "Solana Pay", href: "/authpi", desc: "QR payments on Solana" },
      { label: "Multi-chain deposit", href: "/wiki", desc: "ETH, Base, BNB, Polygon, Solana…" },
      { label: "OpenPay AI", href: "https://www.openpy.space/blog/meet-openpay-ai", desc: "Assistant & MCP agents" },
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

/** Full product showcase — every major OpenPay Pro surface (no bank debit cards). */
const FEATURE_SHOWCASE = [
  {
    id: "money",
    title: "Money & OpenUSD",
    blurb: "Your home balance on the open network.",
    items: [
      { name: "OpenUSD (OUSD)", desc: "OpenPay’s $1 ledger dollar for hold, send, spend, and settle." },
      { name: "Unified Pro wallet", desc: "One home for OUSD, Pi, majors, OpenTokens, and NFTs." },
      { name: "Multi-asset holdings", desc: "BTC, ETH, SOL, PI, USDC, USDT, EURC and more beside OUSD." },
      { name: "@username identity", desc: "Pay and get paid with readable @handles on the same ledger." },
      { name: "Pi in the wallet", desc: "Hold and move Pi alongside OUSD on one Pro account." },
      { name: "Display currencies", desc: "See balances in USD, EUR, PI, and dozens of display currencies." },
      { name: "Activity & history", desc: "Every credit and debit in a clear transaction timeline." },
      { name: "OpenNFT collectibles", desc: "Browse and mint marketplace-linked NFTs inside the wallet." },
      { name: "Multi-wallet switching", desc: "Create, import, and switch Pro wallets without leaving the app." },
    ],
  },
  {
    id: "trading",
    title: "Trading & OpenToken",
    blurb: "Swap majors and launch community coins.",
    items: [
      { name: "OpenDEX swap", desc: "Buy and sell majors against OUSD with quotes and fee clarity." },
      { name: "OpenToken launchpad", desc: "Mint and trade community coins on bonding curves." },
      { name: "Create OpenToken", desc: "Launch your coin with name, symbol, and logo — mint fee in OUSD." },
      { name: "Token discovery", desc: "Trending rails, charts, holders, and per-token rooms." },
      { name: "Watchlist", desc: "Star tokens you care about and jump back in one tap." },
      { name: "Live Chat", desc: "Global and token rooms for launches and markets." },
    ],
  },
  {
    id: "move",
    title: "Send, receive & deposit",
    blurb: "Move value in — and out — on open rails.",
    items: [
      { name: "Send anywhere Pro", desc: "OUSD, Pi, majors, or OpenTokens to @users, addresses, or OpenPay." },
      { name: "Receive + QR", desc: "Share a QR or receive link so others can pay you instantly." },
      { name: "Public pay links", desc: "Camera-friendly /pay links that open cleanly from phone scans." },
      { name: "Buy / Top up OUSD", desc: "Fund from OpenPay Balance, Pi, USDC, crypto, Solana Pay, or Circle." },
      { name: "OpenPay Balance", desc: "Move network balance into Pro OUSD when accounts are linked." },
      { name: "Pi Network top-up", desc: "Pay with Pi at a live π price and get OUSD credited." },
      { name: "USDC / crypto deposit", desc: "Deposit USDC and supported crypto via Commerce rails into OUSD." },
      { name: "Circle Mint", desc: "Circle Mint USDC pay-ins that settle as OUSD on your Pro wallet." },
      { name: "Solana Pay", desc: "Wallet connect, PaymentButton, and Solana Pay QR → OUSD." },
      { name: "Multi-chain gateway", desc: "Deposit from Ethereum, Base, BNB, Polygon, Solana, and more." },
      { name: "Scan QR", desc: "Point the camera at payment QRs to prefill Send or merchant flows." },
      { name: "WalletConnect Pay", desc: "Pay WalletConnect merchant links with an EVM signature." },
      { name: "Tx notifications", desc: "In-app alerts — and email when Email alerts are on." },
    ],
  },
  {
    id: "security",
    title: "Security & control",
    blurb: "Self-custody keys. Open ledger. Your rules.",
    items: [
      { name: "Recovery phrase", desc: "Create or import 12/24-word recovery so you control the wallet." },
      { name: "PIN protection", desc: "Gate sensitive actions with an optional PIN." },
      { name: "Biometrics", desc: "Fingerprint / Face ID where the device supports it." },
      { name: "Pi Verify KYC", desc: "Identity verification via Pi Verify when higher access requires it." },
      { name: "OpenPay OAuth link", desc: "Connect OpenPay for balance top-ups, NFTs, and partner features." },
      { name: "Self-custody posture", desc: "A money app on open rails — not a closed bank silo." },
    ],
  },
  {
    id: "ai",
    title: "OpenPay AI & agents",
    blurb: "Help without hiding how money moves.",
    items: [
      { name: "OpenPay AI assistant", desc: "Ask how-to questions about top-ups, sends, OpenToken, ledger, KYC." },
      { name: "Spoken answers", desc: "Listen to AI and Wiki replies with built-in text-to-speech." },
      { name: "Agent Connect (MCP)", desc: "Plug ChatGPT, Claude, or any MCP client into Pro wallet tools." },
      { name: "Read-oriented tools", desc: "Documented assistant surfaces — help without silent fund moves." },
    ],
  },
  {
    id: "builders",
    title: "Builders & open network",
    blurb: "Same OUSD rails for apps, ledgers, and agents.",
    items: [
      { name: "Partner API", desc: "Apps, keys, and OUSD-denominated partner transfers." },
      { name: "Connect with OpenPay", desc: "Sign in with OpenPay and Balance payments for third-party apps." },
      { name: "Public Ledger API", desc: "Mirror sends, receives, buys, swaps, and mints to an append-only ledger." },
      { name: "OpenLedger explorer", desc: "Inspect credits and debits on public OpenLedger rails." },
      { name: "In-app Ledger console", desc: "API keys, entries, and sync helpers under Developer mode." },
      { name: "Docs & FAQ", desc: "Ship Connect, payments, Ledger, and WalletConnect Pay with first-party docs." },
      { name: "Wiki & Blog", desc: "Guides and updates for every major Pro surface." },
    ],
  },
  {
    id: "auth",
    title: "Sign in your way",
    blurb: "One Pro account — many doors in.",
    items: [
      { name: "OpenPay", desc: "Featured path for users already on the OpenPay network." },
      { name: "Email & password", desc: "Classic create / sign-in without a wallet extension." },
      { name: "Phantom", desc: "Continue with Phantom — or Google / Apple via Phantom." },
      { name: "Solana wallet", desc: "Sign in with a Solana wallet when Phantom isn’t the path." },
      { name: "WalletConnect", desc: "Bring mobile and desktop wallets through WalletConnect." },
      { name: "MetaMask", desc: "Sign in with MetaMask / embedded Web3 auth." },
      { name: "Pi Network", desc: "Pi Browser or Pi OAuth — username into Pro." },
      { name: "Telegram", desc: "One-tap Telegram Login for social-native entry." },
    ],
  },
] as const;

const FEATURE_BENTO = [
  {
    title: "OpenUSD home",
    body: "One balance for OUSD, Pi, majors, and OpenTokens — send, receive, swap.",
    tag: "Money",
    href: "/website#feature-money",
    icon: Wallet,
  },
  {
    title: "OpenToken launch",
    body: "Mint community coins on bonding curves and trade against OUSD.",
    tag: "Trade",
    href: "/website#feature-trading",
    icon: Sparkles,
  },
  {
    title: "Multi-chain in",
    body: "Deposit from Ethereum, Base, BNB, Polygon, Solana — credit as OUSD.",
    tag: "Deposit",
    href: "/website#feature-move",
    icon: Layers,
  },
  {
    title: "Self-custody",
    body: "Recovery phrase, PIN, biometrics — your keys, open ledger.",
    tag: "Security",
    href: "/website#feature-security",
    icon: ShieldCheck,
  },
  {
    title: "OpenPay AI",
    body: "Ask how money moves. Listen to answers. MCP agents on open rails.",
    tag: "AI",
    href: "/website#feature-ai",
    icon: Bot,
  },
  {
    title: "Partner API",
    body: "Connect, charges, OpenLedger — build on the same OUSD network.",
    tag: "Builders",
    href: "/website#feature-builders",
    icon: Zap,
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

const ECO_MARKS = [
  { logo: OUSD_LOGO_URL, label: "OpenUSD" },
  { logo: PI_NETWORK_LOGO_URL, label: "Pi Network" },
  { logo: OPENPAY_AI_MENU_ICON, label: "OpenPay AI" },
  { logo: OPENPAY_NETWORK_BADGE_URL, label: "Open network" },
  { logo: OUSD_LOGO_URL, label: "Partner API" },
  { logo: OPENPAY_AUTH_LOGO, label: "Self-custody" },
  { logo: OPENPAY_NETWORK_BADGE_URL, label: "OpenLedger" },
  { logo: PI_NETWORK_LOGO_URL, label: "Multi-chain" },
] as const;

/** Plain-language tour for local browser text-to-speech. */
function websiteSpeechText() {
  const parts: string[] = [
    "OpenPay Pro. Your home for OUSD, Pi, and OpenTokens on the open network.",
    "Self-custody wallet, public ledger, Partner API, and OpenPay AI — one Pro account.",
  ];
  for (const cat of FEATURE_SHOWCASE) {
    parts.push(`${cat.title}. ${cat.blurb}`);
    for (const item of cat.items) {
      parts.push(`${item.name}. ${item.desc}`);
    }
  }
  parts.push(
    "Get started. Sign in with OpenPay, Phantom, Pi, Telegram, email, and more — then hold OUSD, send, swap, and build on the open ledger.",
  );
  return parts.join(" ").slice(0, 3900);
}

function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openNav, setOpenNav] = useState<string | null>(null);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const speech = useSpeech();
  const speechId = "website-tour";
  const isSpeaking = speech.speakingId === speechId;
  const isLoadingAudio = speech.loadingId === speechId;

  const listen = () => {
    void speech.speak(speechId, websiteSpeechText());
  };

  const listenLabel = isLoadingAudio
    ? "Starting…"
    : isSpeaking
      ? "Stop"
      : "Listen";

  useEffect(() => {
    const root = heroRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-rise]").forEach((el, i) => {
      el.style.setProperty("--rise-delay", `${70 + i * 100}ms`);
      requestAnimationFrame(() => el.classList.add("is-in"));
    });
  }, []);

  useEffect(() => {
    const close = () => setOpenNav(null);
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, []);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    const phone = phoneRef.current;
    if (!hero || !phone) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const onMove = (e: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      phone.style.setProperty("--phone-x", `${x * 18}px`);
      phone.style.setProperty("--phone-y", `${y * 12}px`);
    };
    const onLeave = () => {
      phone.style.setProperty("--phone-x", "0px");
      phone.style.setProperty("--phone-y", "0px");
    };
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    return () => {
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <main className="ophome min-h-screen text-[var(--foreground)]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="ophome-sky absolute inset-0" />
      </div>

      {/* Phantom-style floating header */}
      <header
        className={cn(
          "sticky top-0 z-50 px-3 pt-3 transition-[background,backdrop-filter] duration-300 sm:px-5 sm:pt-4",
          headerScrolled && "ophome-header-scrolled pb-2",
        )}
      >
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3">
          <Link to="/website" className="flex items-center gap-2.5 press">
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
                      item.href.startsWith("http") || item.href.includes("#") ? (
                        <a
                          key={item.href + item.label}
                          href={item.href}
                          {...(item.href.startsWith("http")
                            ? { target: "_blank", rel: "noreferrer" }
                            : {})}
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
            <button
              type="button"
              onClick={listen}
              disabled={isLoadingAudio}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-bold press",
                isSpeaking
                  ? "bg-[var(--ink)] text-white"
                  : "bg-white/80 text-[var(--ink)] shadow-sm ring-1 ring-black/5 hover:bg-white",
              )}
              aria-label={isSpeaking ? "Stop listening" : "Listen to this page"}
            >
              {isLoadingAudio ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSpeaking ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Volume2 className="h-4 w-4" strokeWidth={2.25} />
              )}
              <span className="hidden sm:inline">{listenLabel}</span>
            </button>
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
                  item.href.startsWith("http") || item.href.includes("#") ? (
                    <a
                      key={item.href + item.label}
                      href={item.href}
                      {...(item.href.startsWith("http")
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
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
        {/* Hero — brand-first composition */}
        <section ref={heroRef} className="ophome-hero relative mt-3 overflow-hidden sm:mt-4">
          <div className="ophome-hero-glow" aria-hidden />
          <div className="ophome-hero-mesh" aria-hidden />
          <div
            className="pointer-events-none absolute -left-8 top-16 h-40 w-40 rounded-full bg-[var(--lavender)]/25 blur-3xl ophome-float"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-6 bottom-24 h-48 w-48 rounded-full bg-[var(--brand)]/20 blur-3xl ophome-float-delay"
            aria-hidden
          />
          <div className="relative z-10 mx-auto flex min-h-[min(88vh,820px)] max-w-3xl flex-col items-center px-6 pb-[min(42vh,340px)] pt-16 text-center sm:px-10 sm:pt-20">
            <div
              data-rise
              className="ophome-rise inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 ring-1 ring-white/15 backdrop-blur-md"
            >
              <img src={OPENPAY_AUTH_LOGO} alt="" className="h-5 w-5 rounded-md object-contain" />
              <span className="text-[12px] font-bold tracking-wide text-white/90">OpenPay Pro</span>
            </div>
            <h1
              data-rise
              className="ophome-rise mt-6 font-[family-name:var(--font-display)] text-[clamp(2.85rem,8vw,5rem)] font-extrabold leading-[0.98] tracking-[-0.05em] text-white"
            >
              OpenPay Pro
            </h1>
            <p
              data-rise
              className="ophome-rise mt-5 max-w-xl text-[clamp(1.05rem,2.2vw,1.35rem)] font-medium leading-snug tracking-[-0.02em] text-white/80"
            >
              Your home for OUSD, Pi, and OpenTokens on the open network.
            </p>
            <div data-rise className="ophome-rise mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to="/authpi" className="ophome-hero-cta">
                <Wallet className="h-4 w-4" strokeWidth={2.25} />
                Open wallet
              </Link>
              <button
                type="button"
                onClick={listen}
                disabled={isLoadingAudio}
                className="ophome-hero-cta-ghost"
                aria-label={isSpeaking ? "Stop listening" : "Listen to this page"}
              >
                {isLoadingAudio ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isSpeaking ? (
                  <Square className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Volume2 className="h-4 w-4" strokeWidth={2.25} />
                )}
                {isSpeaking ? "Stop" : "Listen"}
              </button>
            </div>
          </div>

          {/* Product preview — single composition (activity lives inside the phone) */}
          <div className="ophome-hero-preview" aria-hidden>
            <div ref={phoneRef} className="ophome-phone ophome-float-slow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={OPENPAY_AUTH_LOGO} alt="" className="h-7 w-7 rounded-lg object-contain" />
                  <span className="text-xs font-bold text-white">OpenPay Pro</span>
                </div>
                <span className="relative flex h-2 w-2">
                  <span className="ophome-pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              </div>
              <p className="mt-4 text-left text-[11px] font-semibold text-white/55">Total balance</p>
              <p className="mt-0.5 bg-linear-to-r from-white via-[var(--lavender)] to-white bg-clip-text text-left text-3xl font-extrabold tracking-tight text-transparent ophome-shimmer">
                $4,820.40
              </p>
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                {[
                  { label: "Send", Icon: Send },
                  { label: "Receive", Icon: QrCode },
                  { label: "Swap", Icon: ArrowLeftRight },
                ].map(({ label, Icon }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-1 rounded-xl bg-white/12 px-1.5 py-2.5"
                  >
                    <Icon className="h-3.5 w-3.5 text-[var(--lavender)]" />
                    <span className="text-[9px] font-bold text-white/90">{label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 rounded-xl bg-white/10 px-2.5 py-2">
                  <img src={OUSD_LOGO_URL} alt="" className="h-6 w-6 rounded-full object-cover" />
                  <span className="flex-1 text-left text-[11px] font-bold text-white">OpenUSD</span>
                  <span className="text-[11px] font-bold text-white/90">2,480</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/10 px-2.5 py-2">
                  <img src={PI_NETWORK_LOGO_URL} alt="" className="h-6 w-6 rounded-full object-cover" />
                  <span className="flex-1 text-left text-[11px] font-bold text-white">Pi</span>
                  <span className="text-[11px] font-bold text-white/90">1,204</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-2.5 py-2 ring-1 ring-emerald-400/20">
                  <img src={OUSD_LOGO_URL} alt="" className="h-6 w-6 rounded-full object-cover" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[10px] font-bold text-white">Sent to @alice</p>
                    <p className="text-[10px] font-semibold text-emerald-300">+42.00 OUSD</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ecosystem marquee */}
        <div
          data-reveal
          className="ophome-section-reveal ophome-marquee mt-8 sm:mt-10"
          aria-label="OpenPay ecosystem"
        >
          <div className="ophome-marquee-track px-1">
            {[...ECO_MARKS, ...ECO_MARKS].map((item, i) => (
              <span
                key={`${item.label}-${i}`}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--ink)]/8 bg-white/70 px-3.5 py-2 text-xs font-bold text-[var(--ink)] shadow-sm"
              >
                <img src={item.logo} alt="" className="h-4 w-4 rounded-md object-cover" />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Trading tools */}
        <div data-reveal className="ophome-section-reveal">
          <FeatureBand
            eyebrow="Trading"
            title="Trading tools for everyone"
            moreHref="/wiki"
            slides={TRADE_SLIDES}
            renderVisual={(v) => <TradeVisual kind={v} />}
          />
        </div>

        {/* Move money */}
        <div data-reveal className="ophome-section-reveal">
          <FeatureBand
            eyebrow="Move money"
            title="Spend, send & settle"
            moreHref="/openusd"
            slides={MONEY_SLIDES}
            renderVisual={(v) => <MoneyVisual kind={v} />}
            reverse
          />
        </div>

        {/* Security */}
        <div data-reveal className="ophome-section-reveal">
          <FeatureBand
            eyebrow="Your security"
            title="Controlled by you, secured on an open ledger"
            moreHref="/about"
            slides={SECURITY_SLIDES}
            renderVisual={(v) => <SecurityVisual kind={v} />}
          />
        </div>

        {/* Full product showcase */}
        <section
          id="features"
          data-reveal
          className="ophome-section-reveal mt-16 scroll-mt-28 sm:mt-24"
        >
          <div className="flex flex-wrap items-end justify-between gap-4 px-1">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                Product
              </p>
              <h2 className="mt-2 max-w-3xl font-[family-name:var(--font-display)] text-[clamp(1.9rem,4.2vw,3.1rem)] font-extrabold tracking-[-0.04em]">
                Everything in OpenPay Pro
              </h2>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--muted-foreground)]">
                One money app — wallet, OpenUSD, OpenToken, deposits, and AI on the same rails.
              </p>
            </div>
            <button
              type="button"
              onClick={listen}
              disabled={isLoadingAudio}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold press",
                isSpeaking
                  ? "bg-[var(--ink)] text-white"
                  : "bg-[var(--lavender)] text-[var(--ink)] hover:brightness-105",
              )}
              aria-label={isSpeaking ? "Stop listening" : "Listen to all features"}
            >
              {isLoadingAudio ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSpeaking ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Volume2 className="h-4 w-4" strokeWidth={2.25} />
              )}
              {isSpeaking ? "Stop" : "Listen"}
            </button>
          </div>

          {/* Bento highlight row */}
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_BENTO.map((card) => {
              const Icon = card.icon;
              return (
                <li key={card.title}>
                  <a href={card.href} className="ophome-bento block h-full p-5 press">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--lavender-soft)] text-[var(--brand)]">
                        <Icon className="h-5 w-5" strokeWidth={2.1} />
                      </div>
                      <span className="rounded-full bg-[var(--ink)]/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                        {card.tag}
                      </span>
                    </div>
                    <p className="text-lg font-extrabold tracking-tight text-[var(--ink)]">{card.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
                      {card.body}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--brand)]">
                      Explore
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="mt-8 flex gap-2 overflow-x-auto pb-2 scrollbar-none [-webkit-overflow-scrolling:touch]">
            {FEATURE_SHOWCASE.map((cat) => (
              <a
                key={cat.id}
                href={`#feature-${cat.id}`}
                className="shrink-0 rounded-full border border-[var(--ink)]/8 bg-white/70 px-3.5 py-2 text-xs font-bold text-[var(--ink)] press hover:bg-white"
              >
                {cat.title}
              </a>
            ))}
          </div>

          <div className="mt-6 space-y-16 sm:space-y-20">
            {FEATURE_SHOWCASE.map((cat, i) => (
              <ShowcaseBand key={cat.id} category={cat} reverse={i % 2 === 1} />
            ))}
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link to="/authpi" className="ophome-cta-pill">
              <Wallet className="h-4 w-4" />
              Open wallet
            </Link>
            <Link
              to="/openusd"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--ink)]/12 bg-white/70 px-5 py-3 text-sm font-bold text-[var(--ink)] press"
            >
              Meet OpenUSD
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/wiki"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--ink)]/12 bg-white/70 px-5 py-3 text-sm font-bold text-[var(--ink)] press"
            >
              Read the Wiki
            </Link>
          </div>
        </section>

        {/* Trust band */}
        <section
          data-reveal
          className="ophome-section-reveal ophome-trust mt-6 overflow-hidden px-6 py-14 sm:mt-8 sm:px-12 sm:py-16"
        >
          <div className="mx-auto max-w-3xl text-center">
            <Lock className="mx-auto h-8 w-8 text-[var(--lavender)]" strokeWidth={1.75} />
            <h2 className="mt-6 font-[family-name:var(--font-display)] text-[clamp(1.7rem,4vw,2.75rem)] font-extrabold tracking-[-0.035em] text-white">
              Built for open money — not a closed bank silo.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">
              Address, @username, and Pi identity on one network — with OpenUSD settlement, Partner
              API, OpenLedger, and OpenPay AI on the same rails.
            </p>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { value: "Self-custody", label: "Your keys, your wallet" },
                { value: "OpenUSD", label: "$1 ledger dollar" },
                { value: "Open rails", label: "API · Ledger · AI" },
              ].map((s) => (
                <div key={s.value} className="ophome-stat px-4 py-5 text-center">
                  <p className="text-lg font-extrabold tracking-tight text-white">{s.value}</p>
                  <p className="mt-1 text-xs font-medium text-white/55">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ecosystem grid */}
        <section data-reveal className="ophome-section-reveal mt-16 sm:mt-20">
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
        <section
          data-reveal
          className="ophome-section-reveal ophome-start mt-16 overflow-hidden px-6 py-14 text-center sm:mt-20 sm:px-12 sm:py-20"
        >
          <p className="text-sm font-medium text-[var(--ink)]/55">Get started</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(2.2rem,6vw,3.8rem)] font-extrabold tracking-[-0.045em] text-[var(--ink)]">
            Open OpenPay Pro.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--muted-foreground)]">
            Sign in with OpenPay, Phantom, Pi, Telegram, or email — then hold OUSD, send, swap, and
            build.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/authpi" className="ophome-cta-pill text-[15px]">
              <Wallet className="h-4 w-4" />
              Open wallet
            </Link>
            <Link
              to="/openusd"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--ink)]/12 bg-white/70 px-5 py-3 text-sm font-bold text-[var(--ink)] press"
            >
              Meet OpenUSD
              <ArrowRight className="h-4 w-4" />
            </Link>
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
              <Link to="/legal" className="hover:text-[var(--ink)]">
                License
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function ShowcaseBand({
  category,
  reverse,
}: {
  category: (typeof FEATURE_SHOWCASE)[number];
  reverse?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const active = category.items[idx] ?? category.items[0];

  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % category.items.length);
    }, 3800);
    return () => window.clearInterval(id);
  }, [category.items.length]);

  return (
    <div id={`feature-${category.id}`} className="scroll-mt-28">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            {category.blurb}
          </p>
          <h3 className="mt-2 font-[family-name:var(--font-display)] text-[clamp(1.7rem,3.5vw,2.6rem)] font-extrabold tracking-[-0.035em]">
            {category.title}
          </h3>
        </div>
        <span className="rounded-full bg-[var(--lavender)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink)]">
          {category.items.length} live
        </span>
      </div>

      <div
        className={cn(
          "grid items-stretch gap-6 lg:grid-cols-2 lg:gap-10",
          reverse && "lg:[&>*:first-child]:order-2",
        )}
      >
        <ul className="space-y-1.5">
          {category.items.map((item, i) => (
            <li key={item.name}>
              <button
                type="button"
                onClick={() => setIdx(i)}
                className={cn(
                  "w-full rounded-2xl px-4 py-3.5 text-left transition press",
                  i === idx
                    ? "bg-white shadow-[0_16px_48px_-28px_rgba(40,30,80,0.45)] ring-1 ring-black/[0.05]"
                    : "hover:bg-white/60",
                )}
              >
                <p
                  className={cn(
                    "text-[15px] font-bold tracking-tight",
                    i === idx ? "text-[var(--ink)]" : "text-[var(--ink)]/70",
                  )}
                >
                  {item.name}
                </p>
                {i === idx ? (
                  <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
                    {item.desc}
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>

        <div className="ophome-feature-stage relative min-h-[340px] p-5 sm:min-h-[400px] sm:p-7">
          <div key={`${category.id}-${active.name}`} className="ophome-stage-in relative z-10 h-full">
            <ShowcaseVisual categoryId={category.id} item={active} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ShowcaseVisual({
  categoryId,
  item,
}: {
  categoryId: (typeof FEATURE_SHOWCASE)[number]["id"];
  item: { name: string; desc: string };
}) {
  if (categoryId === "money") {
    return (
      <StageCard>
        <div className="relative">
          <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-[var(--lavender)]/30 ophome-pulse-ring" />
          <div className="flex items-center gap-3">
            <img src={OUSD_LOGO_URL} alt="" className="h-12 w-12 rounded-2xl object-cover" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                {item.name}
              </p>
              <p className="text-2xl font-extrabold tracking-tight">$4,820.40</p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted-foreground)]">{item.desc}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: "Send", Icon: Send },
            { label: "Receive", Icon: QrCode },
            { label: "Swap", Icon: ArrowLeftRight },
          ].map(({ label, Icon }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-[var(--lavender-soft)] px-2 py-3"
            >
              <Icon className="h-4 w-4 text-[var(--brand)]" />
              <span className="text-[10px] font-bold">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <AssetRow logo={OUSD_LOGO_URL} name="OpenUSD" amount="2,480" />
          <AssetRow logo={PI_NETWORK_LOGO_URL} name="Pi" amount="1,204" />
          <AssetRow logo={OPENPAY_NETWORK_BADGE_URL} name="OpenToken" amount="+12%" />
        </div>
      </StageCard>
    );
  }

  if (categoryId === "trading") {
    return (
      <StageCard>
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
          {item.name}
        </p>
        <p className="mt-2 text-2xl font-extrabold tracking-tight">OUSD ↔ Markets</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.desc}</p>
        <div className="mt-6 flex h-24 items-end gap-1.5">
          {[40, 62, 48, 78, 55, 88, 70, 95, 72, 84].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md bg-linear-to-t from-[var(--brand)] to-[var(--lavender)] opacity-80"
              style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[var(--lavender-soft)] px-4 py-3">
          <ArrowLeftRight className="h-5 w-5 text-[var(--brand)]" />
          <div>
            <p className="text-sm font-bold">OpenDEX · OpenToken</p>
            <p className="text-xs text-[var(--muted-foreground)]">Live curve · clear fees</p>
          </div>
        </div>
      </StageCard>
    );
  }

  if (categoryId === "move") {
    return (
      <StageCard>
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
          {item.name}
        </p>
        <p className="mt-2 text-2xl font-extrabold tracking-tight">Move value in</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.desc}</p>
        <div className="relative mx-auto mt-8 grid h-36 w-36 place-items-center">
          <div className="absolute inset-0 rounded-full border border-dashed border-[var(--brand)]/30 ophome-orbit" />
          <div className="absolute inset-3 rounded-full border border-[var(--lavender)]/40" />
          <div className="relative z-10 grid h-16 w-16 place-items-center rounded-2xl bg-[var(--lavender-soft)]">
            <Send className="h-7 w-7 text-[var(--brand)]" />
          </div>
          {["ETH", "SOL", "BNB", "BASE"].map((c, i) => (
            <span
              key={c}
              className="absolute rounded-full bg-white px-2 py-1 text-[10px] font-extrabold shadow-md"
              style={{
                top: `${18 + Math.sin((i / 4) * Math.PI * 2) * 42}%`,
                left: `${42 + Math.cos((i / 4) * Math.PI * 2) * 42}%`,
              }}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {["Solana Pay", "Circle Mint", "QR", "WC Pay"].map((t) => (
            <span
              key={t}
              className="rounded-full bg-[var(--lavender-soft)] px-2.5 py-1 text-[10px] font-bold"
            >
              {t}
            </span>
          ))}
        </div>
      </StageCard>
    );
  }

  if (categoryId === "security") {
    return (
      <StageCard dark>
        <div className="relative inline-grid place-items-center">
          <div className="absolute h-20 w-20 rounded-full border border-[var(--lavender)]/40 ophome-pulse-ring" />
          <ShieldCheck className="relative h-10 w-10 text-[var(--lavender)]" />
        </div>
        <p className="mt-6 text-2xl font-extrabold tracking-tight text-white">{item.name}</p>
        <p className="mt-2 text-sm text-white/65">{item.desc}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { label: "Keys", Icon: KeyRound },
            { label: "PIN", Icon: Lock },
            { label: "Bio", Icon: Fingerprint },
          ].map(({ label, Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white"
            >
              <Icon className="h-3.5 w-3.5 text-[var(--lavender)]" />
              {label}
            </span>
          ))}
        </div>
      </StageCard>
    );
  }

  if (categoryId === "ai") {
    return (
      <StageCard dark>
        <div className="flex items-center gap-3">
          <img src={OPENPAY_AI_MENU_ICON} alt="" className="h-10 w-10 object-contain" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-white/50">{item.name}</p>
            <p className="text-xl font-extrabold text-white">OpenPay AI</p>
          </div>
        </div>
        <div className="mt-5 space-y-2.5">
          <div className="rounded-2xl rounded-tl-md bg-white/10 px-3.5 py-2.5 text-sm text-white/85">
            How do I top up OUSD with Pi?
          </div>
          <div className="ml-4 rounded-2xl rounded-tr-md bg-[var(--lavender)]/25 px-3.5 py-2.5 text-sm text-white">
            Open Top up → choose Pi → confirm live π price. I’ll walk you through it.
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-white/55">{item.desc}</p>
        <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[var(--lavender)]">
          <MessageCircle className="h-3.5 w-3.5" />
          Speak · MCP · Wiki listen
        </div>
      </StageCard>
    );
  }

  if (categoryId === "builders") {
    return (
      <StageCard dark>
        <p className="text-xs font-bold uppercase tracking-wide text-white/50">{item.name}</p>
        <p className="mt-2 font-mono text-sm text-[var(--lavender)]">POST /v1/transfers</p>
        <p className="mt-3 text-2xl font-extrabold text-white">Build on OUSD</p>
        <p className="mt-2 text-sm text-white/65">{item.desc}</p>
        <div className="mt-6 space-y-2 font-mono text-[11px] text-white/70">
          <p>
            <span className="text-emerald-400">200</span> charge.created
          </p>
          <p>
            <span className="text-[var(--lavender)]">ok</span> ledger.synced
          </p>
          <p>
            <span className="text-sky-300">mcp</span> tools.ready
          </p>
        </div>
      </StageCard>
    );
  }

  // auth
  return (
    <StageCard>
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
        {item.name}
      </p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">Sign in your way</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.desc}</p>
      <div className="mt-6 grid grid-cols-2 gap-2">
        {["OpenPay", "Phantom", "Pi", "Telegram", "Solana", "MetaMask", "Email", "WC"].map(
          (label, i) => (
            <div
              key={label}
              className={cn(
                "rounded-2xl px-3 py-3 text-center text-xs font-extrabold",
                i === 0
                  ? "bg-[var(--lavender)] text-[var(--ink)]"
                  : "bg-[var(--lavender-soft)] text-[var(--ink)]/80",
              )}
            >
              {label}
            </div>
          ),
        )}
      </div>
    </StageCard>
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
