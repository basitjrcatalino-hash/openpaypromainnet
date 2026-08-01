import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { P2pActionRow, P2pMenuCard, P2pSubpageHeader } from "@/components/p2p/P2pSubpage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/p2p_/support")({
  head: () => ({
    meta: [
      { title: "P2P Support — OpenPay Pro" },
      { name: "description", content: "Get help with P2P orders, disputes, and escrow." },
      { property: "og:title", content: "P2P Support — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});

const FAQS = [
  {
    q: "Buyer paid but seller won’t release",
    a: "Open the order, upload proof if you haven’t, then start a dispute. Support can freeze escrow and review chat + proof.",
  },
  {
    q: "I released crypto but didn’t get fiat",
    a: "Only confirm payment received after money is in your account. If you released early, open a dispute immediately with bank evidence.",
  },
  {
    q: "Order expired / cancelled",
    a: "Unpaid orders expire after the pay window. Crypto returns to the seller automatically when escrow refunds.",
  },
  {
    q: "Wrong payment details",
    a: "Update receive accounts in Payment methods, then edit or recreate your sell ad so new orders snapshot the correct details.",
  },
];

function SupportPage() {
  const roleQ = useQuery({
    queryKey: ["my-roles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { admin: false, mod: false };
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const roles = new Set((data ?? []).map((r) => r.role));
      return { admin: roles.has("admin"), mod: roles.has("moderator") };
    },
  });

  return (
    <div>
      <P2pSubpageHeader title="Customer support" />

      <div className="mx-4 mt-4 space-y-3 md:mx-6">
        <div className="rounded-2xl border border-[#11C66D]/25 bg-[#11C66D]/8 p-4">
          <p className="text-sm font-bold">Trade room chat first</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Most issues resolve in the order chat. Keep all payment talk inside OpenPay Pro — never move to WhatsApp or Telegram mid-trade.
          </p>
          <Button asChild className="mt-3 h-10 rounded-[8px] bg-[#11C66D] font-bold text-white hover:bg-[#0FB461]">
            <Link to="/p2p/messages">
              <MessageSquare className="mr-1.5 h-4 w-4" /> Open messages
            </Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
          <p className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-500">
            <ShieldAlert className="h-4 w-4" /> Disputes
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            From an active order, tap Dispute and attach proof. Support reviews escrow, chat, and payment evidence.
          </p>
          <Button asChild variant="outline" className="mt-3 h-10 rounded-[8px] font-bold">
            <Link to="/p2p/orders">Go to orders</Link>
          </Button>
        </div>
      </div>

      <h2 className="mx-4 mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground md:mx-6">
        Common questions
      </h2>
      <P2pMenuCard className="mb-3">
        {FAQS.map((f) => (
          <div key={f.q} className="border-b border-border/40 px-4 py-3.5 last:border-b-0">
            <p className="text-sm font-semibold">{f.q}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{f.a}</p>
          </div>
        ))}
      </P2pMenuCard>

      <P2pMenuCard className="mb-8">
        <P2pActionRow to="/p2p/guide" title="How to use" desc="Step-by-step escrow guide" />
        <P2pActionRow to="/p2p/rules" title="Trading rules" desc="Payment notes & prohibited acts" />
        <P2pActionRow to="/p2p/security" title="Safety & protection" desc="Buyer / seller scam notes" />
        <P2pActionRow to="/p2p/agreement" title="Agreement · Terms · Privacy" desc="P2P legal pack" />
        {roleQ.data?.admin || roleQ.data?.mod ? (
          <P2pActionRow to="/p2p/admin" title="Support console" desc="Disputes & payment methods" />
        ) : null}
        <P2pActionRow to="/chat" title="In-app help chat" desc="General OpenPay assistance" />
      </P2pMenuCard>
    </div>
  );
}
