import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, Megaphone } from "lucide-react";

import { P2pSubpageHeader } from "@/components/p2p/P2pSubpage";

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
    <div>
      <P2pSubpageHeader title="Payment / Ads" />

      <p className="px-4 py-3 text-xs text-muted-foreground md:px-6">
        Two separate tools — payment methods for receiving fiat, and ads for publishing offers.
      </p>

      <div className="mx-4 space-y-3 md:mx-6">
        <Link
          to="/p2p/payments"
          className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card/40 p-4 hover:bg-muted/30"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#11C66D]/15 text-[#11C66D]">
            <CreditCard className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold">Payment methods</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Add GCash, bank, PIX, UPI, and more. Required for sell ads.
            </span>
            <span className="mt-3 inline-flex h-9 items-center rounded-[8px] bg-[#11C66D] px-4 text-xs font-bold text-white">
              Manage payments
            </span>
          </span>
        </Link>

        <Link
          to="/p2p/create"
          className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card/40 p-4 hover:bg-muted/30"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-500/15 text-sky-400">
            <Megaphone className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold">My ads</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Publish buy/sell offers, set price, limits, and pay window.
            </span>
            <span className="mt-3 inline-flex h-9 items-center rounded-[8px] border border-border px-4 text-xs font-bold">
              Manage ads
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
