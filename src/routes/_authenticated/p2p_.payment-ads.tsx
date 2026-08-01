import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, Megaphone } from "lucide-react";

import { P2pHubLayout, P2pHubPill } from "@/components/p2p/P2pSubpage";

export const Route = createFileRoute("/_authenticated/p2p_/payment-ads")({
  head: () => ({
    meta: [
      { title: "Payment / Ads — OpenPay Pro P2P" },
      { name: "description", content: "Manage receive methods and your P2P advertisements." },
      { property: "og:title", content: "Payment / Ads — OpenPay Pro P2P" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentAdsHub,
});

function PaymentAdsHub() {
  return (
    <P2pHubLayout
      title="Payment / Ads"
      dek="Two separate tools — payment methods for receiving fiat, and ads for publishing offers."
      crumb="Profile"
      eyebrow="Merchant tools"
      hero={{ from: "#bbf7d0", to: "#ddd6fe", glyph: "₿" }}
      actions={
        <>
          <P2pHubPill to="/p2p/payments" primary>
            Manage payments
          </P2pHubPill>
          <P2pHubPill to="/p2p/create">My ads</P2pHubPill>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/p2p/payments"
          className="group flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:border-[var(--primary)]"
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent)] text-[var(--foreground)]">
            <CreditCard className="h-5 w-5" />
          </span>
          <span className="mt-4 text-xl font-bold tracking-tight group-hover:underline">
            Payment methods
          </span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Add GCash, bank, PIX, UPI, and more. Required for sell ads.
          </span>
          <span className="mt-5 text-sm font-semibold text-[var(--primary)]">Manage payments →</span>
        </Link>

        <Link
          to="/p2p/create"
          className="group flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:border-[var(--primary)]"
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent)] text-[var(--foreground)]">
            <Megaphone className="h-5 w-5" />
          </span>
          <span className="mt-4 text-xl font-bold tracking-tight group-hover:underline">
            My advertisements
          </span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Publish buy or sell offers. Escrow locks crypto when a trade starts.
          </span>
          <span className="mt-5 text-sm font-semibold text-[var(--primary)]">Open ads →</span>
        </Link>
      </div>
    </P2pHubLayout>
  );
}
