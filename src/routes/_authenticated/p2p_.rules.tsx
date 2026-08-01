import { createFileRoute } from "@tanstack/react-router";

import {
  P2pDocCtas,
  P2pDocLayout,
  P2pDocList,
  P2pDocSection,
} from "@/components/p2p/P2pDocLayout";

export const Route = createFileRoute("/_authenticated/p2p_/rules")({
  head: () => ({
    meta: [
      { title: "P2P Trading Rules — OpenPay Pro" },
      { name: "description", content: "Official OpenPay Pro P2P trading rules and notes." },
      { property: "og:title", content: "P2P Trading Rules — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RulesPage,
});

const CORE = [
  "Pay only to the receive account shown in the trade room for that order. Do not use details from chat, SMS, email, or previous trades.",
  "Transfer the exact fiat amount and use the order reference when your bank/app supports a note field.",
  "Mark Paid only after you have completed the transfer. Fake “Paid” marks are a serious violation.",
  "Sellers must release escrow only after funds have cleared in their own account — not on screenshots alone if the money is missing.",
  "Do not cancel maliciously after the counterparty has already paid. Open a dispute with proof instead.",
  "Keep all negotiation inside OpenPay Pro chat. Off-platform deals are not protected by escrow.",
];

const PAYMENT = [
  "Name on the paying account should match your verified profile when required by the merchant terms.",
  "Do not split payments unless the merchant terms explicitly allow it.",
  "Third-party payments may be rejected; merchants can refuse and escalate.",
  "Crypto network fees and bank fees are your responsibility unless the ad says otherwise.",
  "Platform trading fee is 0. Max size is 5,000 OUSD (or $5,000 notional) per order.",
];

const TIMERS = [
  "Buyers must pay within the ad’s pay window. Unpaid orders expire and escrow returns to the seller.",
  "After Paid, sellers should verify promptly. Unreasonable delays may be disputed.",
  "Completed trades can be rated. Positive reviews (4–5★) build merchant reputation on the marketplace.",
];

const PROHIBITED = [
  "Phishing, social engineering, or asking the other party to leave the app.",
  "Money laundering, sanctioned-party transfers, or illegal goods.",
  "Price manipulation ads, wash trading, or fake volume.",
  "Harassment, threats, or sharing personal data beyond what’s needed for the trade.",
];

const SPEECH = [
  "P2P trading rules.",
  "Follow these rules on every trade.",
  "Core rules.",
  ...CORE,
  "Payment notes.",
  ...PAYMENT,
  "Timers and completion.",
  ...TIMERS,
  "Prohibited.",
  ...PROHIBITED,
].join(" ");

function RulesPage() {
  return (
    <P2pDocLayout
      title="Trading rules"
      dek="Follow these rules on every trade. Breaking them can lead to order cancellation, account limits, or permanent bans."
      active="/p2p/rules"
      speechId="p2p-doc:rules"
      speechText={SPEECH}
      hero={{ from: "#fde68a", to: "#fda4af", glyph: "§" }}
      eyebrow="Policy · Required reading"
    >
      <P2pDocSection id="core" title="Core rules">
        <P2pDocList items={CORE} />
      </P2pDocSection>
      <P2pDocSection id="payment" title="Payment notes">
        <P2pDocList items={PAYMENT} />
      </P2pDocSection>
      <P2pDocSection id="timers" title="Timers & completion">
        <P2pDocList items={TIMERS} />
      </P2pDocSection>
      <P2pDocSection id="prohibited" title="Prohibited">
        <P2pDocList items={PROHIBITED} />
      </P2pDocSection>
      <P2pDocCtas
        primary={{ to: "/p2p/security", label: "Safety & protection →" }}
        secondary={[{ to: "/p2p/agreement", label: "User agreement" }]}
      />
    </P2pDocLayout>
  );
}
