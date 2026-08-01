import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { P2pMenuCard, P2pSubpageHeader } from "@/components/p2p/P2pSubpage";

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
    d: "Filter by Buy/Sell, asset, amount, and payment method. Check merchant orders, completion %, and pay window.",
  },
  {
    t: "2. Escrow locks crypto",
    d: "When a trade opens, seller crypto is locked in escrow. Buyers only pay after seeing the merchant receive details.",
  },
  {
    t: "3. Pay with local rails",
    d: "Send fiat via GCash, bank, PIX, UPI, etc. Upload payment proof in the trade room — never leave the app.",
  },
  {
    t: "4. Confirm & release",
    d: "Seller verifies funds arrived, then releases escrow. Buyer receives crypto. Disputes go to Support if needed.",
  },
];

const TIPS = [
  "Platform trading fee is 0 — only bank/network fees may apply.",
  "Max size is 5,000 OUSD (or $5,000 notional) per trade.",
  "Sell ads need a funded merchant wallet + receive accounts.",
  "Never release escrow before money clears in your own account.",
];

function GuidePage() {
  return (
    <div>
      <P2pSubpageHeader title="How P2P works" />

      <p className="px-4 py-3 text-sm text-muted-foreground md:px-6">
        OpenPay Pro P2P matches you with other users. We hold crypto in escrow until fiat payment is confirmed —
        the same safety model as OKX P2P.
      </p>

      <P2pMenuCard className="mb-3">
        {STEPS.map((s) => (
          <div key={s.t} className="border-b border-border/40 px-4 py-3.5 last:border-b-0">
            <p className="text-sm font-bold">{s.t}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </P2pMenuCard>

      <h2 className="mx-4 mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground md:mx-6">
        Good to know
      </h2>
      <P2pMenuCard className="mb-4">
        {TIPS.map((t) => (
          <p key={t} className="border-b border-border/40 px-4 py-3 text-[13px] last:border-b-0">
            {t}
          </p>
        ))}
      </P2pMenuCard>

      <div className="mx-4 mb-8 flex flex-col gap-2 md:mx-6">
        <Button asChild className="h-11 rounded-[8px] bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]">
          <Link to="/p2p">Browse marketplace</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-[8px] font-bold">
          <Link to="/p2p/express">Try Express</Link>
        </Button>
      </div>
    </div>
  );
}
