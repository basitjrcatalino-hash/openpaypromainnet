import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { P2pDocLayout, P2pDocList, P2pDocSection } from "@/components/p2p/P2pDocLayout";

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

function PrivacyPage() {
  return (
    <P2pDocLayout
      title="P2P privacy"
      dek="This notice explains P2P-specific data use. It supplements the main OpenPay Pro Privacy Policy."
      active="/p2p/privacy"
    >
      <P2pDocSection title="What we process">
        <P2pDocList
          items={[
            "Order details: asset, amount, price, status, timers, payment method codes.",
            "Receive account snapshots shown to the counterparty for an active order (name, account no., bank, etc.).",
            "Chat messages and payment proof images you upload in the trade room.",
            "Ratings, tags, and short review comments after completed trades.",
            "Merchant application materials and admin review outcomes.",
          ]}
        />
      </P2pDocSection>

      <P2pDocSection title="Who sees what">
        <P2pDocList
          items={[
            "Your counterparty sees receive details only for orders they are party to.",
            "Marketplace shows public reputation: order counts, completion %, positive review %, merchant badges.",
            "Support / moderators can access order rooms and proofs when a dispute is opened or fraud is suspected.",
            "We do not sell your P2P chat or payment proofs to advertisers.",
          ]}
        />
      </P2pDocSection>

      <P2pDocSection title="Retention">
        <p>
          Trade records, proofs, and ratings are retained as needed for disputes, compliance, and platform
          integrity, then deleted or anonymized according to our retention schedule and legal requirements.
        </p>
      </P2pDocSection>

      <P2pDocSection title="Your choices">
        <P2pDocList
          items={[
            "Deactivate unused receive accounts in Merchant wallet / Payments.",
            "Pause or close ads at any time.",
            "Contact Support to report misuse of your payment details.",
          ]}
        />
      </P2pDocSection>

      <div className="mx-4 flex flex-col gap-2 md:mx-6">
        <Button asChild variant="outline" className="h-11 rounded-[8px] font-bold">
          <Link to="/privacy">Main Privacy Policy ›</Link>
        </Button>
        <Button asChild className="h-11 rounded-[8px] bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]">
          <Link to="/p2p/support">Contact support ›</Link>
        </Button>
      </div>
    </P2pDocLayout>
  );
}
