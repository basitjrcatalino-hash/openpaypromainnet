import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Code2,
  Handshake,
  Layers,
  Shield,
  Wallet,
} from "lucide-react";
import { PageListenButton } from "@/components/page-listen-button";
import { fetchMajorUsdPrices, getCachedPiUsdPrice } from "@/lib/ledger-majors";
import { OPENPAY_AUTH_LOGO } from "@/lib/openpay-auth";
import { OPENPAY_NETWORK_BADGE_URL, PI_NETWORK_LOGO_URL } from "@/lib/token-logos";

const TITLE = "Funding — OpenPay Pro for investors & partners";
const DESC =
  "OpenPay Pro and OpenPay network raise overview for investors and partners: capital targets, use of funds, Partner API rails, and how to get involved.";

/** Keep in sync with pitch.tsx raise targets. */
const RAISE = {
  openPayProUsd: 5_000_000,
  openPayNetworkUsd: 5_000_000,
} as const;

const TOTAL_USD = RAISE.openPayProUsd + RAISE.openPayNetworkUsd;

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
    icon: Wallet,
    title: "One network dollar",
    body: "OpenUSD gives users cash-simple $1 thinking while builders settle on the same ledger unit.",
  },
  {
    icon: Layers,
    title: "Distribution ready",
    body: "Pi Network, Phantom, Solana, MetaMask, Telegram, and OpenPay — many doors into one Pro account.",
  },
  {
    icon: Code2,
    title: "Full stack, not a silo",
    body: "Wallet + trading + deposits + Partner API + public ledger + AI agents share open rails.",
  },
  {
    icon: Shield,
    title: "Self-custody first",
    body: "Users hold keys and balances on Pro; partners Connect and settle without owning the wallet.",
  },
] as const;

export const Route = createFileRoute("/funding")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://openpaypro.space/funding" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/funding" }],
  }),
  component: FundingPage,
});

function formatUsdCompact(n: number) {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
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

function fundingSpeechText(piUsd: number) {
  const piSafe = piUsd > 0 ? piUsd : 0.079;
  const totalPi = TOTAL_USD / piSafe;
  const funds = FUND_USE.map((f) => `${f.pct} percent ${f.title}. ${f.body}`).join(" ");
  const why = WHY_NOW.map((w) => `${w.title}. ${w.body}`).join(" ");
  return [
    "Funding OpenPay Pro. Capital for investors and partners.",
    `The team is seeking ${formatUsdCompact(RAISE.openPayProUsd)} for OpenPay Pro and ${formatUsdCompact(RAISE.openPayNetworkUsd)} for the OpenPay network — ${formatUsdCompact(TOTAL_USD)} total, payable in USD or Pi at the live Pi price of about ${formatPiPrice(piSafe)}, or roughly ${formatPiAmount(totalPi)}.`,
    "Use of funds.",
    funds,
    "Why now.",
    why,
    "Investors can open the pitch deck for the full narrative. Partners can integrate via the Partner API, Pro Pay merchant docs, and Connect.",
    "Join the raise or build on the rails — OpenPay Pro stays open so the network can grow with you.",
  ].join(" ");
}

function FundingPage() {
  const heroRef = useRef<HTMLElement | null>(null);
  const [piUsd, setPiUsd] = useState(() => getCachedPiUsdPrice());

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

  useEffect(() => {
    const root = heroRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>("[data-rise]");
    nodes.forEach((el, i) => {
      el.style.setProperty("--rise-delay", `${80 + i * 70}ms`);
      requestAnimationFrame(() => el.classList.add("is-in"));
    });
  }, []);

  const piSafe = piUsd > 0 ? piUsd : 0.079;
  const totalPi = TOTAL_USD / piSafe;
  const raiseRows = [
    {
      name: "OpenPay Pro",
      blurb: "Self-custody money app — wallet, OpenUSD, trading, deposits, AI",
      logo: OPENPAY_NETWORK_BADGE_URL,
      usd: RAISE.openPayProUsd,
    },
    {
      name: "OpenPay",
      blurb: "Open money network — Balance, Partner API, Connect, OpenLedger",
      logo: OPENPAY_AUTH_LOGO,
      usd: RAISE.openPayNetworkUsd,
    },
  ] as const;

  return (
    <main className="opblog opabout min-h-screen text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="opabout-mesh absolute inset-0" />
        <div className="opabout-orb absolute -left-24 top-16 h-72 w-72 rounded-full bg-[rgba(171,159,242,0.35)] blur-3xl" />
        <div className="opabout-orb absolute -right-16 top-[28%] h-80 w-80 rounded-full bg-[rgba(99,102,241,0.22)] blur-3xl [animation-delay:1.2s]" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-5 pb-28 pt-10 sm:px-8">
        <nav className="mb-12 flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Link
            to="/authpi"
            className="rounded-full bg-muted px-3 py-1.5 text-foreground/80 hover:text-foreground"
          >
            OpenPay Pro
          </Link>
          <span className="text-muted-foreground">›</span>
          <span className="rounded-full bg-muted px-3 py-1.5">Funding</span>
          <Link
            to="/pitch"
            className="ml-auto rounded-full border border-border bg-card/70 px-3 py-1.5 text-muted-foreground backdrop-blur hover:text-foreground"
          >
            Pitch Deck
          </Link>
        </nav>

        <header ref={heroRef} className="relative max-w-3xl pb-16 pt-4 sm:pt-8">
          <p
            data-rise
            className="opabout-rise inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"
          >
            <Building2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            Investors · Partners
          </p>
          <h1
            data-rise
            className="opabout-rise mt-5 font-(family-name:--font-display) text-[clamp(2.75rem,8vw,5.25rem)] font-extrabold leading-[0.95] tracking-[-0.04em]"
          >
            OpenPay Pro
          </h1>
          <p
            data-rise
            className="opabout-rise mt-4 text-[clamp(1.35rem,3.5vw,2rem)] font-semibold tracking-tight text-primary"
          >
            Funding the open network.
          </p>
          <p data-rise className="opabout-rise opblog-dek mt-6 max-w-xl text-muted-foreground">
            Capital for the self-custody money app and the OpenPay network — for investors who want
            the thesis, and partners who want to build on the rails.
          </p>
          <div data-rise className="opabout-rise mt-9 flex flex-wrap gap-3">
            <Link
              to="/pitch"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground press hover:brightness-105"
            >
              Open pitch deck
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>
            <PageListenButton
              id="page:funding"
              text={fundingSpeechText(piSafe)}
              label="Listen"
              stopLabel="Stop"
              variant="outline"
            />
            <a
              href="/docs"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-6 py-3 text-sm font-semibold backdrop-blur press"
            >
              Partner docs
            </a>
          </div>
        </header>

        <section className="border-t border-border pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            The raise
          </p>
          <h2 className="opblog-h2 mt-3 max-w-2xl">
            {formatUsdCompact(TOTAL_USD)} total · USD or Pi
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Split evenly across OpenPay Pro and the OpenPay network. Accept{" "}
            <span className="font-semibold text-foreground">USD</span> or{" "}
            <span className="font-semibold text-foreground">Pi</span> at the live π market price.
          </p>

          <div className="mt-8 inline-flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/80 px-4 py-3 backdrop-blur">
            <img src={PI_NETWORK_LOGO_URL} alt="" className="h-9 w-9 rounded-full object-contain" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Live Pi price
              </p>
              <p className="text-lg font-bold tabular-nums">{formatPiPrice(piSafe)}</p>
            </div>
            <p className="ml-auto text-sm font-semibold tabular-nums text-muted-foreground">
              ≈ {formatPiAmount(totalPi)} total
            </p>
          </div>

          <ul className="mt-10 grid gap-8 sm:grid-cols-2">
            {raiseRows.map((row) => (
              <li key={row.name} className="min-w-0 border-t border-border pt-6">
                <div className="flex items-center gap-3">
                  <img src={row.logo} alt="" className="h-10 w-10 object-contain" />
                  <div>
                    <p className="text-xl font-bold tracking-tight">{row.name}</p>
                    <p className="text-sm text-muted-foreground">{row.blurb}</p>
                  </div>
                </div>
                <p className="mt-5 font-(family-name:--font-display) text-4xl font-extrabold tracking-tight tabular-nums">
                  {formatUsdCompact(row.usd)}
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-muted-foreground">
                  ≈ {formatPiAmount(row.usd / piSafe)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 border-t border-border pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Capital allocation
          </p>
          <h2 className="opblog-h2 mt-3">Use of funds</h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Product-first allocation — with liquidity, distribution, security, and operational
            resilience.
          </p>
          <div className="mt-10 space-y-8">
            {FUND_USE.map((f) => {
              const sliceUsd = (TOTAL_USD * f.pct) / 100;
              return (
                <div key={f.title}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
                    <p className="text-lg font-bold tracking-tight">
                      <span className="tabular-nums text-primary">{f.pct}%</span>
                      <span className="mx-2 text-muted-foreground/40">·</span>
                      {f.title}
                    </p>
                    <p className="text-sm font-bold tabular-nums text-muted-foreground">
                      {formatUsdCompact(sliceUsd)}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-primary to-[#7c6cf0]"
                      style={{ width: `${f.pct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-20 border-t border-border pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Two paths in
          </p>
          <h2 className="opblog-h2 mt-3">Investors & partners</h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Same network, different doors — capital that funds the stack, or software that settles
            on it.
          </p>

          <div className="mt-12 grid gap-12 sm:grid-cols-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-primary">
                <Building2 className="h-5 w-5" strokeWidth={2.25} />
                <p className="text-sm font-bold uppercase tracking-[0.14em]">Investors</p>
              </div>
              <h3 className="mt-3 text-2xl font-bold tracking-tight">Read the thesis</h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                OpenUSD, self-custody wallet, Spot & Perps, OpenToken, Partner API, OpenPay AI,
                roadmap, and the full capital story — in the pitch deck.
              </p>
              <ul className="mt-5 space-y-2 text-base text-muted-foreground">
                <li>· Raise targets and π equivalents at live price</li>
                <li>· Product pillars and go-to-market</li>
                <li>· Use of funds and why now</li>
              </ul>
              <Link
                to="/pitch"
                className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
              >
                Open pitch deck
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </Link>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-primary">
                <Handshake className="h-5 w-5" strokeWidth={2.25} />
                <p className="text-sm font-bold uppercase tracking-[0.14em]">Partners</p>
              </div>
              <h3 className="mt-3 text-2xl font-bold tracking-tight">Build on the rails</h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Connect with OpenPay, charge Balance, run Pro Pay checkout, transfer to
                @username / 0x, and read the public ledger — documented for humans and AI agents.
              </p>
              <ul className="mt-5 space-y-2 text-base text-muted-foreground">
                <li>· OAuth Connect & Partner Transfer API</li>
                <li>· Pro Pay merchant checkout & QR Pay</li>
                <li>· AI Partner Pack for OpenAI, Cursor, Claude</li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                <a
                  href="/docs"
                  className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                >
                  Developer portal
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                </a>
                <a
                  href="/docs/pro-pay"
                  className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary hover:underline"
                >
                  Pro Pay
                </a>
                <a
                  href="https://openpy.space/partner-api"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary hover:underline"
                >
                  Partner API
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20 border-t border-border pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Why now
          </p>
          <h2 className="opblog-h2 mt-3">The network is the product</h2>
          <ul className="mt-12 grid gap-10 sm:grid-cols-2">
            {WHY_NOW.map(({ icon: Icon, title, body }) => (
              <li key={title} className="min-w-0">
                <Icon className="h-6 w-6 text-primary" strokeWidth={2} />
                <h3 className="mt-4 text-xl font-bold tracking-tight">{title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 border-t border-border pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Next step
          </p>
          <h2 className="opblog-h2 mt-3 max-w-2xl">Ready to fund or integrate?</h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Start with the pitch for capital conversations, or the docs hub for partner engineering.
            The About page covers why the network stays open.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/pitch"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background press"
            >
              Pitch deck
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>
            <a
              href="/docs/ai"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-6 py-3 text-sm font-semibold backdrop-blur press"
            >
              <BookOpen className="h-4 w-4" strokeWidth={2.25} />
              AI Partner Pack
            </a>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-6 py-3 text-sm font-semibold backdrop-blur press"
            >
              About OpenPay Pro
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
