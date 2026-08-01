import { createFileRoute } from "@tanstack/react-router";

import {
  P2pDocCtas,
  P2pDocLayout,
  P2pDocList,
  P2pDocSection,
} from "@/components/p2p/P2pDocLayout";

export const Route = createFileRoute("/_authenticated/p2p_/privacy")({
  head: () => ({
    meta: [
      { title: "P2P Privacy Notice — OpenPay Pro" },
      { name: "description", content: "How OpenPay Pro P2P uses trade and payment data." },
      { property: "og:title", content: "P2P Privacy Notice — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

const PROCESS = [
  "Order details: asset, amount, price, status, timers, payment method codes.",
  "Receive account snapshots shown to the counterparty for an active order (name, account no., bank, etc.).",
  "Chat messages and payment proof images you upload in the trade room.",
  "Ratings, tags, and short review comments after completed trades.",
  "Merchant application materials and admin review outcomes.",
];

const WHO = [
  "Your counterparty sees receive details only for orders they are party to.",
  "Marketplace shows public reputation: order counts, completion %, positive review %, merchant badges.",
  "Support / moderators can access order rooms and proofs when a dispute is opened or fraud is suspected.",
  "We do not sell your P2P chat or payment proofs to advertisers.",
];

const CHOICES = [
  "Deactivate unused receive accounts in Merchant wallet / Payments.",
  "Pause or close ads at any time.",
  "Contact Support to report misuse of your payment details.",
];

const SPEECH = [
  "P2P privacy notice.",
  "This notice explains P2P-specific data use. It supplements the main OpenPay Pro Privacy Policy.",
  "What we process.",
  ...PROCESS,
  "Who sees what.",
  ...WHO,
  "Retention. Trade records, proofs, and ratings are retained as needed for disputes and compliance.",
  "Your choices.",
  ...CHOICES,
].join(" ");

function PrivacyPage() {
  return (
    <P2pDocLayout
      title="P2P privacy"
      dek="This notice explains P2P-specific data use. It supplements the main OpenPay Pro Privacy Policy."
      active="/p2p/privacy"
      speechId="p2p-doc:privacy"
      speechText={SPEECH}
      hero={{ from: "#cffafe", to: "#e9d5ff", glyph: "P" }}
      eyebrow="Legal · Privacy"
    >
      <P2pDocSection id="process" title="What we process">
        <P2pDocList items={PROCESS} />
      </P2pDocSection>
      <P2pDocSection id="who" title="Who sees what">
        <P2pDocList items={WHO} />
      </P2pDocSection>
      <P2pDocSection id="retention" title="Retention">
        <p>
          Trade records, proofs, and ratings are retained as needed for disputes, compliance, and platform
          integrity, then deleted or anonymized according to our retention schedule and legal requirements.
        </p>
      </P2pDocSection>
      <P2pDocSection id="choices" title="Your choices">
        <P2pDocList items={CHOICES} />
      </P2pDocSection>
      <P2pDocCtas
        primary={{ to: "/p2p/support", label: "Contact support →" }}
        secondary={[{ to: "/privacy", label: "Main Privacy Policy" }]}
      />
    </P2pDocLayout>
  );
}
