import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, ShieldAlert } from "lucide-react";

import { P2pActionRow, P2pHubLayout, P2pHubPill, P2pMenuCard } from "@/components/p2p/P2pSubpage";
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
    <P2pHubLayout
      title="Customer support"
      dek="Trade-room chat first. Keep payment talk inside OpenPay Pro — never move to WhatsApp or Telegram mid-trade."
      crumb="Help"
      eyebrow="Support · Disputes"
      hero={{ from: "#ddd6fe", to: "#a7f3d0", glyph: "?" }}
      actions={
        <>
          <P2pHubPill to="/p2p/messages" primary>
            Open messages
          </P2pHubPill>
          <P2pHubPill to="/p2p/orders">Go to orders</P2pHubPill>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-accent p-5">
          <p className="inline-flex items-center gap-1.5 text-base font-bold">
            <MessageSquare className="h-4 w-4" /> Trade room chat first
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Most issues resolve in the order chat. Escrow stays locked until you confirm or Support
            decides.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="inline-flex items-center gap-1.5 text-base font-bold text-foreground">
            <ShieldAlert className="h-4 w-4" /> Disputes
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            From an active order, tap Dispute and attach proof. Support reviews escrow, chat, and
            payment evidence.
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold tracking-tight">Common questions</h2>
        <P2pMenuCard className="mt-4">
          {FAQS.map((f) => (
            <div key={f.q} className="border-b border-border px-5 py-4 last:border-b-0">
              <p className="text-base font-bold tracking-tight">{f.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </P2pMenuCard>
      </div>

      <P2pMenuCard>
        <P2pActionRow to="/p2p/guide" title="How to use" desc="Step-by-step escrow guide" />
        <P2pActionRow
          to="/p2p/rules"
          title="Trading rules"
          desc="Payment notes & prohibited acts"
        />
        <P2pActionRow
          to="/p2p/security"
          title="Safety & protection"
          desc="Buyer / seller scam notes"
        />
        <P2pActionRow
          to="/p2p/agreement"
          title="Agreement · Terms · Privacy"
          desc="P2P legal pack"
        />
        {roleQ.data?.admin || roleQ.data?.mod ? (
          <P2pActionRow to="/p2p/admin" title="Support console" desc="Disputes & payment methods" />
        ) : null}
        <P2pActionRow to="/chat" title="In-app help chat" desc="General OpenPay assistance" />
      </P2pMenuCard>
    </P2pHubLayout>
  );
}
