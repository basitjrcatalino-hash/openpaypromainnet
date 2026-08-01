import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { P2pDocLayout, P2pDocList, P2pDocSection } from "@/components/p2p/P2pDocLayout";

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

function TermsPage() {
  return (
    <P2pDocLayout
      title="P2P terms"
      dek="Additional terms for the P2P marketplace. They supplement the main OpenPay Pro Terms of Service."
      active="/p2p/terms"
    >
      <P2pDocSection title="Eligibility">
        <P2pDocList
          items={[
            "You must have an OpenPay Pro account in good standing.",
            "Merchants listing sell ads must hold sufficient merchant-wallet balance and verified receive methods.",
            "Featured / Super Merchant status is granted at our discretion under the Merchant Program.",
          ]}
        />
      </P2pDocSection>

      <P2pDocSection title="Ads & pricing">
        <P2pDocList
          items={[
            "You are responsible for prices, limits, payment methods, and ad terms you publish.",
            "We may hide or pause ads that violate rules, show wrong receive details, or harm users.",
            "Inventory is not reserved until an order successfully locks escrow.",
          ]}
        />
      </P2pDocSection>

      <P2pDocSection title="Fees & limits">
        <P2pDocList
          items={[
            "OpenPay Pro charges 0 platform trading fee on P2P orders unless we announce otherwise.",
            "Bank, e-wallet, and blockchain network fees are paid by the parties as they arise.",
            "Per-order caps apply (currently 5,000 OUSD or $5,000 notional).",
          ]}
        />
      </P2pDocSection>

      <P2pDocSection title="No financial advice">
        <p>
          Crypto and fiat exchange rates change. P2P prices are set by users. OpenPay Pro does not guarantee
          any rate, liquidity, or counterparty performance beyond escrow mechanics described in the User Agreement.
        </p>
      </P2pDocSection>

      <P2pDocSection title="Liability">
        <P2pDocList
          items={[
            "We are not liable for losses from paying the wrong account, off-platform deals, or ignored timers.",
            "Escrow tools reduce — but cannot eliminate — fraud risk. Follow Safety & protection guidance.",
            "Service may be interrupted for maintenance, force majeure, or compliance holds.",
          ]}
        />
      </P2pDocSection>

      <div className="mx-4 flex flex-col gap-2 md:mx-6">
        <Button asChild variant="outline" className="h-11 rounded-[8px] font-bold">
          <Link to="/terms">Main Terms of Service ›</Link>
        </Button>
        <Button asChild className="h-11 rounded-[8px] bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]">
          <Link to="/p2p/privacy">P2P privacy ›</Link>
        </Button>
      </div>
    </P2pDocLayout>
  );
}
