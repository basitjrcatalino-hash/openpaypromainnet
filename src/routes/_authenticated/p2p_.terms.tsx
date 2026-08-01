import { createFileRoute } from "@tanstack/react-router";

import {
  P2pDocCtas,
  P2pDocLayout,
  P2pDocList,
  P2pDocSection,
} from "@/components/p2p/P2pDocLayout";

export const Route = createFileRoute("/_authenticated/p2p_/terms")({
  head: () => ({
    meta: [
      { title: "P2P Terms of Service — OpenPay Pro" },
      { name: "description", content: "Terms governing OpenPay Pro peer-to-peer trading." },
      { property: "og:title", content: "P2P Terms of Service — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

const ELIGIBILITY = [
  "You must have an OpenPay Pro account in good standing.",
  "Merchants listing sell ads must hold sufficient merchant-wallet balance and verified receive methods.",
  "Featured / Super Merchant status is granted at our discretion under the Merchant Program.",
];

const ADS = [
  "You are responsible for prices, limits, payment methods, and ad terms you publish.",
  "We may hide or pause ads that violate rules, show wrong receive details, or harm users.",
  "Inventory is not reserved until an order successfully locks escrow.",
];

const FEES = [
  "OpenPay Pro charges 0 platform trading fee on P2P orders unless we announce otherwise.",
  "Bank, e-wallet, and blockchain network fees are paid by the parties as they arise.",
  "Per-order caps apply (currently 5,000 OUSD or $5,000 notional).",
];

const LIABILITY = [
  "We are not liable for losses from paying the wrong account, off-platform deals, or ignored timers.",
  "Escrow tools reduce — but cannot eliminate — fraud risk. Follow Safety & protection guidance.",
  "Service may be interrupted for maintenance, force majeure, or compliance holds.",
];

const SPEECH = [
  "P2P terms of service.",
  "Additional terms for the P2P marketplace. They supplement the main OpenPay Pro Terms of Service.",
  "Eligibility.",
  ...ELIGIBILITY,
  "Ads and pricing.",
  ...ADS,
  "Fees and limits.",
  ...FEES,
  "No financial advice. Crypto and fiat rates change. Prices are set by users.",
  "Liability.",
  ...LIABILITY,
].join(" ");

function TermsPage() {
  return (
    <P2pDocLayout
      title="P2P terms"
      dek="Additional terms for the P2P marketplace. They supplement the main OpenPay Pro Terms of Service."
      active="/p2p/terms"
      speechId="p2p-doc:terms"
      speechText={SPEECH}
      hero={{ from: "#e9d5ff", to: "#fecdd3", glyph: "T" }}
      eyebrow="Legal · Terms"
    >
      <P2pDocSection id="eligibility" title="Eligibility">
        <P2pDocList items={ELIGIBILITY} />
      </P2pDocSection>
      <P2pDocSection id="ads" title="Ads & pricing">
        <P2pDocList items={ADS} />
      </P2pDocSection>
      <P2pDocSection id="fees" title="Fees & limits">
        <P2pDocList items={FEES} />
      </P2pDocSection>
      <P2pDocSection id="advice" title="No financial advice">
        <p>
          Crypto and fiat exchange rates change. P2P prices are set by users. OpenPay Pro does not guarantee
          any rate, liquidity, or counterparty performance beyond escrow mechanics described in the User Agreement.
        </p>
      </P2pDocSection>
      <P2pDocSection id="liability" title="Liability">
        <P2pDocList items={LIABILITY} />
      </P2pDocSection>
      <P2pDocCtas
        primary={{ to: "/p2p/privacy", label: "P2P privacy →" }}
        secondary={[{ to: "/terms", label: "Main Terms of Service" }]}
      />
    </P2pDocLayout>
  );
}
