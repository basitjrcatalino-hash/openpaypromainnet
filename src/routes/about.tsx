import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Globe2,
  Link2,
  Network,
  ScrollText,
  Shield,
  Wallet,
} from "lucide-react";
import { PageListenButton } from "@/components/page-listen-button";

const TITLE = "About OpenPay Pro — An Open Network";
const DESC =
  "OpenPay Pro is an open network for money: one wallet, open rails, public APIs, and room for builders, agents, and every token on the ledger.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://openpaypro.space/about" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/about" }],
  }),
  component: AboutPage,
});

const PILLARS = [
  {
    icon: Wallet,
    title: "Open wallets",
    body: "Anyone can hold OUSD, majors, and OpenTokens in one Pro account — address, @username, and Pi identity on the same ledger.",
  },
  {
    icon: Link2,
    title: "Open rails",
    body: "Money moves across OpenPay Balance, Pro transfers, multi-chain deposits, and partner Connect — not locked inside a closed silo.",
  },
  {
    icon: ScrollText,
    title: "Open ledger",
    body: "Every credit and debit is a ledger entry you can inspect. Builders pull the same truth through the public Ledger API.",
  },
  {
    icon: Bot,
    title: "Open agents",
    body: "MCP and Agent Connect let assistants read permitted account context — so AI can help without hiding the rails.",
  },
] as const;

function aboutSpeechText() {
  const pillars = PILLARS.map((p) => `${p.title}. ${p.body}`).join(" ");
  return [
    "About OpenPay Pro. OpenPay Pro is an open network.",
    "Not a closed bank app. A network where wallets, payments, tokens, APIs, and agents share the same open ledger — so money can move, and builders can build.",
    "What open means. One network. Many ways in.",
    "OpenPay Pro connects people, partners, and software on shared rails — so you are never stuck behind a single closed door.",
    pillars,
    "How it connects. The network is the product.",
    "Sign in with OpenPay, Pi, email, or wallets. Hold OUSD and majors. Launch OpenTokens. Deposit from chains. Pay merchants. Let agents assist — all on one Pro ledger.",
    "For builders. Open to integrate.",
    "Partner apps can Connect with OpenPay, charge from OpenPay Balance, and read ledger context through documented APIs — the same open network users already live in.",
    "Join the open network. Create a wallet, move value, or build on the rails — OpenPay Pro stays open so the network can grow with you.",
  ].join(" ");
}

function AboutPage() {
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = heroRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>("[data-rise]");
    nodes.forEach((el, i) => {
      el.style.setProperty("--rise-delay", `${80 + i * 70}ms`);
      requestAnimationFrame(() => el.classList.add("is-in"));
    });
  }, []);

  return (
    <main className="opabout min-h-screen text-foreground">
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
          <span className="rounded-full bg-muted px-3 py-1.5">About</span>
          <Link
            to="/wiki"
            className="ml-auto rounded-full border border-border bg-card/70 px-3 py-1.5 text-muted-foreground backdrop-blur hover:text-foreground"
          >
            Wiki
          </Link>
        </nav>

        <header ref={heroRef} className="relative min-h-[70vh] max-w-3xl pb-16 pt-4 sm:pt-10">
          <p
            data-rise
            className="opabout-rise inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"
          >
            <Globe2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            About
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
            is an open network.
          </p>
          <p
            data-rise
            className="opabout-rise mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            Not a closed bank app. A network where wallets, payments, tokens, APIs, and agents share
            the same open ledger — so money can move, and builders can build.
          </p>
          <div data-rise className="opabout-rise mt-9 flex flex-wrap gap-3">
            <Link
              to="/authpi"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground press hover:brightness-105"
            >
              Open the wallet
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>
            <PageListenButton
              id="page:about"
              text={aboutSpeechText()}
              label="Listen"
              stopLabel="Stop"
              variant="outline"
            />
            <a
              href="/docs/openpay"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-6 py-3 text-sm font-semibold backdrop-blur press"
            >
              Build on OpenPay
            </a>
          </div>
        </header>

        <section className="border-t border-border pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            What open means
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            One network. Many ways in.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            OpenPay Pro connects people, partners, and software on shared rails — so you are never
            stuck behind a single closed door.
          </p>

          <ul className="mt-12 grid gap-10 sm:grid-cols-2">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="min-w-0">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-primary/12 text-primary">
                  <Icon className="h-5 w-5" strokeWidth={2.1} />
                </div>
                <h3 className="text-xl font-bold tracking-tight">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 border-t border-border pt-16">
          <div className="flex items-center gap-3">
            <Network className="h-5 w-5 text-primary" strokeWidth={2.1} />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              How it connects
            </p>
          </div>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            The network is the product.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Sign in with OpenPay, Pi, email, or wallets. Hold OUSD and majors. Launch OpenTokens.
            Deposit from chains. Pay merchants. Let agents assist — all on one Pro ledger.
          </p>

          <div className="mt-10 flex flex-wrap gap-2">
            {[
              "OUSD ledger",
              "OpenPay Connect",
              "Pi Network",
              "OpenToken",
              "Ledger API",
              "MCP agents",
              "Multi-chain deposit",
              "WalletConnect Pay",
            ].map((label) => (
              <span
                key={label}
                className="rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-sm font-semibold text-foreground/85"
              >
                {label}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-20 border-t border-border pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            For builders
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Open to integrate.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Partner apps can Connect with OpenPay, charge from OpenPay Balance, and read ledger
            context through documented APIs — the same open network users already live in.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/docs/openpay"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background press"
            >
              <BookOpen className="h-4 w-4" />
              Integration docs
            </a>
            <Link
              to="/wiki"
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold press"
            >
              <Shield className="h-4 w-4" />
              Product wiki
            </Link>
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold press"
            >
              Learn more
            </Link>
          </div>
        </section>

        <section className="mt-24 rounded-[2rem] bg-foreground px-6 py-12 text-background sm:px-10 sm:py-14">
          <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            Join the open network.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-background/70">
            Create a wallet, move value, or build on the rails — OpenPay Pro stays open so the
            network can grow with you.
          </p>
          <Link
            to="/authpi"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground press"
          >
            Get started
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </Link>
        </section>
      </div>
    </main>
  );
}
