import { createFileRoute, Link } from "@tanstack/react-router";

import {
  P2pDocCtas,
  P2pDocLayout,
  P2pDocSteps,
  P2pDocTips,
} from "@/components/p2p/P2pDocLayout";

export const Route = createFileRoute("/_authenticated/p2p_/guide")({
  head: () => ({
    meta: [
      { title: "How P2P works — OpenPay Pro" },
      { name: "description", content: "Escrow-protected P2P trading guide." },
      { property: "og:title", content: "How P2P works — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuidePage,
});

const STEPS = [
  {
    title: "Pick an ad",
    detail:
      "Filter by Buy/Sell, asset, amount, and payment method. Check merchant badges, orders, completion %, and positive reviews.",
  },
  {
    title: "Escrow locks crypto",
    detail:
      "When a trade opens, seller crypto is locked in escrow. Buyers only pay after seeing the merchant receive details in the trade room.",
  },
  {
    title: "Pay with local rails",
    detail:
      "Send fiat via GCash, bank, PIX, UPI, and more. Upload payment proof — never leave the app for “better rates.”",
  },
  {
    title: "Confirm & release",
    detail:
      "Seller verifies funds arrived, then releases escrow. Buyer receives crypto. Disputes go to Support if needed.",
  },
  {
    title: "Rate your counterparty",
    detail:
      "After completion, leave a 1–5★ rating. Positive reviews help good merchants build trust on the marketplace.",
  },
];

const TIPS = [
  "Platform trading fee is 0 — only bank/network fees may apply.",
  "Max size is 5,000 OUSD (or $5,000 notional) per trade.",
  "Sell ads need a funded merchant wallet + receive accounts.",
  "Never release escrow before money clears in your own account.",
  "Read Trading rules and Safety before your first large trade.",
];

const SPEECH = [
  "How to use OpenPay Pro P2P.",
  "OpenPay Pro P2P matches you with other users. We hold crypto in escrow until fiat payment is confirmed.",
  ...STEPS.map((s, i) => `Step ${i + 1}. ${s.title}. ${s.detail}`),
  "Good to know.",
  ...TIPS,
].join(" ");

function GuidePage() {
  return (
    <P2pDocLayout
      title="How to use"
      dek="OpenPay Pro P2P matches you with other users. We hold crypto in escrow until fiat payment is confirmed — the same safety model as major exchange P2P desks."
      active="/p2p/guide"
      speechId="p2p-doc:guide"
      speechText={SPEECH}
      hero={{ from: "#ddd6fe", to: "#a7f3d0", glyph: "P2P" }}
      eyebrow="Tutorial · Beginner · 4 min"
    >
      <P2pDocSteps steps={STEPS} />
      <P2pDocTips items={TIPS} />
      <P2pDocCtas
        primary={{ to: "/p2p", label: "Browse marketplace" }}
        secondary={[
          { to: "/p2p/rules", label: "Trading rules →" },
          { to: "/p2p/express", label: "Try Express" },
        ]}
      />
      <p className="text-sm text-[var(--muted-foreground)]">
        Prefer a shorter path?{" "}
        <Link to="/p2p/express" className="font-semibold text-[var(--foreground)] underline-offset-2 hover:underline">
          Express
        </Link>{" "}
        matches you to a live ad automatically.
      </p>
    </P2pDocLayout>
  );
}
