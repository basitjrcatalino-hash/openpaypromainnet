import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { P2pActionRow, P2pMenuCard, P2pSubpageHeader } from "@/components/p2p/P2pSubpage";

export const Route = createFileRoute("/_authenticated/p2p_/security")({
  head: () => ({
    meta: [
      { title: "P2P Security — OpenPay Pro" },
      { name: "description", content: "Stay safe while trading P2P with escrow." },
      { property: "og:title", content: "P2P Security — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SecurityPage,
});

const RULES = [
  "Only pay to the receive account shown in the trade room snapshot.",
  "Never release escrow until fiat has cleared in your own account.",
  "Keep negotiation inside OpenPay chat — ignore off-platform links.",
  "Match the exact amount and reference when paying.",
  "If anything feels wrong, open a dispute before the timer ends.",
];

function SecurityPage() {
  return (
    <div>
      <P2pSubpageHeader title="Security" />

      <div className="mx-4 mt-4 rounded-2xl border border-[#11C66D]/25 bg-[#11C66D]/8 p-4 md:mx-6">
        <p className="inline-flex items-center gap-1.5 text-sm font-bold text-[#11C66D]">
          <ShieldCheck className="h-4 w-4" /> Escrow protected
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Crypto stays locked until the seller confirms payment or Support resolves a dispute.
        </p>
      </div>

      <h2 className="mx-4 mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground md:mx-6">
        Trading rules
      </h2>
      <P2pMenuCard className="mb-3">
        {RULES.map((r, i) => (
          <p key={r} className="border-b border-border/40 px-4 py-3 text-[13px] last:border-b-0">
            <span className="mr-2 font-bold text-muted-foreground">{i + 1}.</span>
            {r}
          </p>
        ))}
      </P2pMenuCard>

      <P2pMenuCard className="mb-4">
        <P2pActionRow to="/settings" title="App lock & biometrics" desc="Secure the whole OpenPay Pro app" />
        <P2pActionRow to="/settings" title="Recovery phrase" desc="Back up before you need it" />
        <P2pActionRow to="/p2p/support" title="Report a problem" desc="Disputes & support" />
      </P2pMenuCard>

      <div className="mx-4 mb-8 md:mx-6">
        <Button asChild className="h-11 w-full rounded-[8px] bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]">
          <Link to="/p2p">Back to marketplace</Link>
        </Button>
      </div>
    </div>
  );
}
