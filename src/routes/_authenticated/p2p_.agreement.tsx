import { createFileRoute, Link } from "@tanstack/react-router";

import {
  P2pDocCtas,
  P2pDocLayout,
  P2pDocList,
  P2pDocSection,
} from "@/components/p2p/P2pDocLayout";

export const Route = createFileRoute("/_authenticated/p2p_/agreement")({
  head: () => ({
    meta: [
      { title: "P2P User Agreement — OpenPay Pro" },
      { name: "description", content: "OpenPay Pro P2P user agreement for buyers and merchants." },
      { property: "og:title", content: "P2P User Agreement — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgreementPage,
});

const ESCROW = [
  "When a sell-side trade opens, seller crypto is locked until release, refund, expiry, or Support decision.",
  "Buyers acquire no claim to locked crypto until the seller confirms payment or Support releases to the buyer.",
  "Attempting to bypass escrow voids protection for that trade.",
];

const OBLIGATIONS = [
  "Provide accurate receive accounts and keep them active while your ads are live.",
  "Respond within reasonable time during open orders.",
  "Upload honest payment proof; do not alter screenshots.",
  "Comply with local laws and your payment provider’s terms.",
  "Accept that merchants may set reasonable ad terms (e.g. same-name transfers) if shown before you trade.",
];

const DISPUTES = [
  "Open a dispute with clear evidence before timers expire when possible.",
  "Support may release escrow to buyer, refund seller, or take other action based on evidence.",
  "We may pause ads, restrict P2P, or ban accounts for rule breaches.",
];

const SPEECH = [
  "P2P user agreement.",
  "By using OpenPay Pro P2P you agree to escrow rules, fair trading, and the responsibilities below.",
  "Parties and role of the platform.",
  "OpenPay Pro provides matching, escrow, chat, and dispute tools. Fiat transfers happen between traders.",
  "Escrow.",
  ...ESCROW,
  "Your obligations.",
  ...OBLIGATIONS,
  "Ratings. After a completed trade, each party may rate the other.",
  "Disputes and enforcement.",
  ...DISPUTES,
].join(" ");

function AgreementPage() {
  return (
    <P2pDocLayout
      title="User agreement"
      dek="By using OpenPay Pro P2P you agree to escrow rules, fair trading, and the responsibilities below."
      active="/p2p/agreement"
      speechId="p2p-doc:agreement"
      speechText={SPEECH}
      hero={{ from: "#ddd6fe", to: "#bfdbfe", glyph: "◎" }}
      eyebrow="Legal · Agreement"
    >
      <P2pDocSection id="parties" title="1. Parties & role of the platform">
        <p>
          OpenPay Pro provides matching, escrow lock/release, chat, and dispute tools. Fiat transfers happen
          between you and the counterparty via local payment rails. We are not a bank and do not custody your fiat.
        </p>
      </P2pDocSection>

      <P2pDocSection id="escrow" title="2. Escrow">
        <P2pDocList items={ESCROW} />
      </P2pDocSection>

      <P2pDocSection id="obligations" title="3. Your obligations">
        <P2pDocList items={OBLIGATIONS} />
      </P2pDocSection>

      <P2pDocSection id="ratings" title="4. Ratings">
        <p>
          After a completed trade, each party may rate the other (1–5 stars) with optional tags and a short
          comment. Ratings are public reputation signals on ads and profiles. Fake, retaliatory, or bribed
          ratings may be removed and can lead to enforcement action.
        </p>
      </P2pDocSection>

      <P2pDocSection id="disputes" title="5. Disputes & enforcement">
        <P2pDocList items={DISPUTES} />
      </P2pDocSection>

      <P2pDocSection id="related" title="6. Related documents">
        <p>
          This agreement works together with{" "}
          <Link to="/p2p/terms" className="font-semibold underline-offset-2 hover:underline">
            P2P Terms
          </Link>
          ,{" "}
          <Link to="/p2p/privacy" className="font-semibold underline-offset-2 hover:underline">
            P2P Privacy
          </Link>
          , and{" "}
          <Link to="/p2p/rules" className="font-semibold underline-offset-2 hover:underline">
            Trading Rules
          </Link>
          .
        </p>
      </P2pDocSection>

      <P2pDocCtas primary={{ to: "/p2p", label: "I understand — browse marketplace" }} />
    </P2pDocLayout>
  );
}
