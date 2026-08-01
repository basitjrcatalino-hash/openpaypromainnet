import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { P2pDocLayout, P2pDocList, P2pDocSection } from "@/components/p2p/P2pDocLayout";
import { P2pMenuCard } from "@/components/p2p/P2pSubpage";

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
    t: "1. Pick an ad",
    d: "Filter by Buy/Sell, asset, amount, and payment method. Check merchant badges, orders, completion %, and positive reviews.",
  },
  {
    t: "2. Escrow locks crypto",
    d: "When a trade opens, seller crypto is locked in escrow. Buyers only pay after seeing the merchant receive details in the trade room.",
  },
  {
    t: "3. Pay with local rails",
    d: "Send fiat via GCash, bank, PIX, UPI, etc. Upload payment proof — never leave the app for “better rates.”",
  },
  {
    t: "4. Confirm & release",
    d: "Seller verifies funds arrived, then releases escrow. Buyer receives crypto. Disputes go to Support if needed.",
  },
  {
    t: "5. Rate your counterparty",
    d: "After completion, leave a 1–5★ rating (like OKX / Bitget). Positive reviews help good merchants rank trust.",
  },
];

function GuidePage() {
  return (
    <P2pDocLayout
      title="How to use"
      dek="OpenPay Pro P2P matches you with other users. We hold crypto in escrow until fiat payment is confirmed — the same safety model as OKX / Bitget P2P."
      active="/p2p/guide"
    >
      <P2pMenuCard className="mb-1">
        {STEPS.map((s) => (
          <div key={s.t} className="border-b border-border/40 px-4 py-3.5 last:border-b-0">
            <p className="text-sm font-bold text-foreground">{s.t}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </P2pMenuCard>

      <P2pDocSection title="Good to know">
        <P2pDocList
          items={[
            "Platform trading fee is 0 — only bank/network fees may apply.",
            "Max size is 5,000 OUSD (or $5,000 notional) per trade.",
            "Sell ads need a funded merchant wallet + receive accounts.",
            "Never release escrow before money clears in your own account.",
            "Read Trading rules and Safety before your first large trade.",
          ]}
        />
      </P2pDocSection>

      <div className="mx-4 mb-2 flex flex-col gap-2 md:mx-6">
        <Button asChild className="h-11 rounded-[8px] bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]">
          <Link to="/p2p">Browse marketplace</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-[8px] font-bold">
          <Link to="/p2p/rules">Trading rules ›</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-[8px] font-bold">
          <Link to="/p2p/express">Try Express</Link>
        </Button>
      </div>
    </P2pDocLayout>
  );
}
