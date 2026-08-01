import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { P2pDocLayout, P2pDocList, P2pDocSection } from "@/components/p2p/P2pDocLayout";
import { P2pActionRow, P2pMenuCard } from "@/components/p2p/P2pSubpage";

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

function SecurityPage() {
  return (
    <P2pDocLayout
      title="Safety & protection"
      dek="Escrow protects crypto. These habits protect your fiat and identity — the same notes OKX / Bitget surface before you trade."
      active="/p2p/security"
    >
      <div className="mx-4 rounded-2xl border border-[#11C66D]/25 bg-[#11C66D]/8 p-4 md:mx-6">
        <p className="inline-flex items-center gap-1.5 text-sm font-bold text-[#11C66D]">
          <ShieldCheck className="h-4 w-4" /> Escrow protected
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Crypto stays locked until the seller confirms payment or Support resolves a dispute. Fiat moves on
          your bank / e-wallet — verify carefully.
        </p>
      </div>

      <P2pDocSection title="Buyer protection">
        <P2pDocList
          items={[
            "Only pay the account snapshot in the trade room for this order.",
            "Keep the pay timer visible; don’t mark Paid until the transfer is done.",
            "Upload clear proof (amount, time, account digits). Blurry edits look like fraud.",
            "If the seller asks you to cancel after you paid — open a dispute immediately.",
            "Prefer merchants with Verified / Super badges and high positive review %.",
          ]}
        />
      </P2pDocSection>

      <P2pDocSection title="Seller / merchant protection">
        <P2pDocList
          items={[
            "Release only after funds settle in your own account — not on a chat promise.",
            "Reject third-party payments if your ad terms require same-name transfers.",
            "Never share “alternative” receive accounts outside the saved payment methods.",
            "If a buyer’s proof doesn’t match, don’t release — ask for clarification or dispute.",
          ]}
        />
      </P2pDocSection>

      <P2pDocSection title="Common scams">
        <P2pDocList
          items={[
            "Fake Support accounts DMing you to “unlock” escrow off-app.",
            "QR codes or links that drain wallets or steal bank sessions.",
            "Chargebacks / recall after you already released crypto.",
            "Impersonation: “I’m the merchant’s friend, pay this other account.”",
          ]}
        />
      </P2pDocSection>

      <P2pMenuCard className="mb-1">
        <P2pActionRow to="/p2p/rules" title="Trading rules" desc="Full do’s and don’ts" />
        <P2pActionRow to="/p2p/agreement" title="User agreement" desc="Escrow & ratings contract" />
        <P2pActionRow to="/settings" title="App lock & biometrics" desc="Secure the whole OpenPay Pro app" />
        <P2pActionRow to="/p2p/support" title="Report a problem" desc="Disputes & support" />
      </P2pMenuCard>

      <div className="mx-4 md:mx-6">
        <Button asChild className="h-11 w-full rounded-[8px] bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]">
          <Link to="/p2p">Back to marketplace</Link>
        </Button>
      </div>
    </P2pDocLayout>
  );
}
