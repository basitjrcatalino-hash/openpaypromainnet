import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Clock3, ReceiptText } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { formatNumber, formatUSD } from "@/lib/wallet-utils";

const searchSchema = z.object({
  amount: z.coerce.number().positive().catch(0),
  asset: z.string().trim().min(1).catch("OUSD"),
  method: z.string().trim().min(1).catch("Payment"),
  type: z.enum(["topup", "buy"]).catch("topup"),
  reference: z.string().optional(),
  quantity: z.coerce.number().positive().optional(),
});

export const Route = createFileRoute("/_authenticated/payment-success")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Payment Complete — OpenPay Pro" },
      { name: "description", content: "Your OpenPay Pro payment has been completed." },
      { property: "og:title", content: "Payment Complete — OpenPay Pro" },
      { property: "og:description", content: "Your OpenPay Pro payment has been completed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentSuccessPage,
});

function PaymentSuccessPage() {
  const { amount, asset, method, type, reference, quantity } = Route.useSearch();
  const shownAmount = quantity && asset !== "OUSD"
    ? `${formatNumber(quantity, quantity < 1 ? 6 : 4)} ${asset}`
    : `${formatUSD(amount)} ${asset}`;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-xl items-center px-4 py-8">
      <section className="w-full text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 ring-8 ring-emerald-500/5">
          <Check className="h-10 w-10 text-emerald-500" strokeWidth={3} />
        </div>

        <p className="mt-7 text-sm font-semibold text-emerald-500">Payment successful</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          {type === "buy" ? "Purchase complete" : "Top up complete"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {type === "buy" ? `${asset} has been added to your wallet.` : "Your wallet balance has been updated."}
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card text-left">
          <div className="border-b border-border/70 px-5 py-6 text-center">
            <p className="text-xs font-medium text-muted-foreground">You received</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{shownAmount}</p>
            {asset !== "OUSD" ? (
              <p className="mt-1 text-xs text-muted-foreground">Paid {formatUSD(amount)}</p>
            ) : null}
          </div>
          <dl className="divide-y divide-border/70 px-5 text-sm">
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-muted-foreground">Payment method</dt>
              <dd className="font-semibold text-foreground">{method}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="inline-flex items-center gap-1.5 font-semibold text-emerald-500">
                <Check className="h-4 w-4" /> Completed
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-muted-foreground">Date</dt>
              <dd className="inline-flex items-center gap-1.5 text-foreground">
                <Clock3 className="h-4 w-4 text-muted-foreground" /> Just now
              </dd>
            </div>
            {reference ? (
              <div className="flex items-center justify-between gap-4 py-4">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="max-w-[60%] truncate font-mono text-xs text-foreground">{reference}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button asChild variant="outline" className="h-12 rounded-full">
            <Link to="/activity"><ReceiptText className="mr-2 h-4 w-4" /> View activity</Link>
          </Button>
          <Button asChild className="h-12 rounded-full font-bold">
            <Link to="/dashboard">Done</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}