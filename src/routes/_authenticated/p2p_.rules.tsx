import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { P2pDocLayout, P2pDocList, P2pDocSection } from "@/components/p2p/P2pDocLayout";

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

function RulesPage() {
  return (
    <P2pDocLayout
      title="Trading rules"
      dek="Follow these rules on every trade. Breaking them can lead to order cancellation, account limits, or permanent bans."
      active="/p2p/rules"
    >
      <P2pDocSection title="Core rules">
        <P2pDocList
          items={[
            "Pay only to the receive account shown in the trade room for that order. Do not use details from chat, SMS, email, or previous trades.",
            "Transfer the exact fiat amount and use the order reference when your bank/app supports a note field.",
            "Mark Paid only after you have completed the transfer. Fake “Paid” marks are a serious violation.",
            "Sellers must release escrow only after funds have cleared in their own account — not on screenshots alone if the money is missing.",
            "Do not cancel maliciously after the counterparty has already paid. Open a dispute with proof instead.",
            "Keep all negotiation inside OpenPay Pro chat. Off-platform deals are not protected by escrow.",
          ]}
        />
      </P2pDocSection>

      <P2pDocSection title="Payment notes">
        <P2pDocList
          items={[
            "Name on the paying account should match your verified profile when required by the merchant terms.",
            "Do not split payments unless the merchant terms explicitly allow it.",
            "Third-party payments (paying from someone else’s account) may be rejected; merchants can refuse and escalate.",
            "Crypto network fees and bank fees are your responsibility unless the ad says otherwise.",
            "Platform trading fee is 0. Max size is 5,000 OUSD (or $5,000 notional) per order.",
          ]}
        />
      </P2pDocSection>

      <P2pDocSection title="Timers & completion">
        <P2pDocList
          items={[
            "Buyers must pay within the ad’s pay window. Unpaid orders expire and escrow returns to the seller.",
            "After Paid, sellers should verify promptly. Unreasonable delays may be disputed.",
            "Completed trades can be rated. Positive reviews (4–5★) build merchant reputation on the marketplace.",
          ]}
        />
      </P2pDocSection>

      <P2pDocSection title="Prohibited">
        <P2pDocList
          items={[
            "Phishing, social engineering, or asking the other party to leave the app.",
            "Money laundering, sanctioned-party transfers, or illegal goods.",
            "Price manipulation ads, wash trading, or fake volume.",
            "Harassment, threats, or sharing personal data beyond what’s needed for the trade.",
          ]}
        />
      </P2pDocSection>

      <div className="mx-4 flex flex-col gap-2 md:mx-6">
        <Button asChild className="h-11 rounded-[8px] bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]">
          <Link to="/p2p/security">Safety & protection ›</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-[8px] font-bold">
          <Link to="/p2p/agreement">Read user agreement ›</Link>
        </Button>
      </div>
    </P2pDocLayout>
  );
}
