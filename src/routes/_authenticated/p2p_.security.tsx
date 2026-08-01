import { createFileRoute } from "@tanstack/react-router";

import {
  P2pDocCtas,
  P2pDocLayout,
  P2pDocList,
  P2pDocSection,
  P2pDocTips,
} from "@/components/p2p/P2pDocLayout";

export const Route = createFileRoute("/_authenticated/p2p_/security")({
  head: () => ({
    meta: [
      { title: "P2P Safety & Protection — OpenPay Pro" },
      { name: "description", content: "Stay safe while trading P2P with escrow." },
      { property: "og:title", content: "P2P Safety & Protection — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SecurityPage,
});

const BUYER = [
  "Only pay the account snapshot in the trade room for this order.",
  "Keep the pay timer visible; don’t mark Paid until the transfer is done.",
  "Upload clear proof (amount, time, account digits). Blurry edits look like fraud.",
  "If the seller asks you to cancel after you paid — open a dispute immediately.",
  "Prefer merchants with Verified / Super badges and high positive review %.",
];

const SELLER = [
  "Release only after funds settle in your own account — not on a chat promise.",
  "Reject third-party payments if your ad terms require same-name transfers.",
  "Never share “alternative” receive accounts outside the saved payment methods.",
  "If a buyer’s proof doesn’t match, don’t release — ask for clarification or dispute.",
];

const SCAMS = [
  "Fake Support accounts DMing you to “unlock” escrow off-app.",
  "QR codes or links that drain wallets or steal bank sessions.",
  "Chargebacks / recall after you already released crypto.",
  "Impersonation: “I’m the merchant’s friend, pay this other account.”",
];

const SPEECH = [
  "P2P safety and protection.",
  "Escrow protects crypto. These habits protect your fiat and identity.",
  "Buyer protection.",
  ...BUYER,
  "Seller and merchant protection.",
  ...SELLER,
  "Common scams.",
  ...SCAMS,
].join(" ");

function SecurityPage() {
  return (
    <P2pDocLayout
      title="Safety & protection"
      dek="Escrow protects crypto. These habits protect your fiat and identity — the notes every careful P2P trader should know before they send money."
      active="/p2p/security"
      speechId="p2p-doc:security"
      speechText={SPEECH}
      hero={{ from: "#bbf7d0", to: "#a5b4fc", glyph: "✓" }}
      eyebrow="Security · Essential"
    >
      <P2pDocTips
        items={[
          "Crypto stays locked until the seller confirms payment or Support resolves a dispute.",
          "Fiat moves on your bank or e-wallet — verify carefully before you release.",
        ]}
      />
      <P2pDocSection id="buyer" title="Buyer protection">
        <P2pDocList items={BUYER} />
      </P2pDocSection>
      <P2pDocSection id="seller" title="Seller / merchant protection">
        <P2pDocList items={SELLER} />
      </P2pDocSection>
      <P2pDocSection id="scams" title="Common scams">
        <P2pDocList items={SCAMS} />
      </P2pDocSection>
      <P2pDocCtas
        primary={{ to: "/p2p", label: "Back to marketplace" }}
        secondary={[
          { to: "/p2p/rules", label: "Trading rules" },
          { to: "/p2p/support", label: "Report a problem" },
          { to: "/settings", label: "App lock & biometrics" },
        ]}
      />
    </P2pDocLayout>
  );
}
