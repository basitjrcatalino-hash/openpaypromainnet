import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Clock3, ExternalLink, ReceiptText, Wallet } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { OusdIcon } from "@/components/ousd-icon";
import { formatNumber } from "@/lib/wallet-utils";
import { piTxExplorerUrl } from "@/lib/pi-payout";

const searchSchema = z.object({
  amount: z.coerce.number().positive().catch(0),
  to: z.string().trim().catch(""),
  txid: z.string().trim().optional(),
  horizon: z.string().trim().optional(),
});

export const Route = createFileRoute("/_authenticated/pi-send-success")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Sent to Pi Wallet — OpenPay Pro" },
      { name: "description", content: "Your OpenUSD transfer to a Pi Wallet has been completed." },
      { property: "og:title", content: "Sent to Pi Wallet — OpenPay Pro" },
      { property: "og:description", content: "Your OpenUSD transfer to a Pi Wallet has been completed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PiSendSuccessPage,
});

function PiSendSuccessPage() {
  const { amount, to, txid, horizon } = Route.useSearch();
  const explorerUrl = txid ? piTxExplorerUrl(txid, horizon) : "";

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-xl items-center px-4 py-8">
      <section className="w-full text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 ring-8 ring-emerald-500/5">
          <Check className="h-10 w-10 text-emerald-500" strokeWidth={3} />
        </div>

        <p className="mt-7 text-sm font-semibold text-emerald-500">Payment successful</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Sent to Pi Wallet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          OpenUSD was delivered on the Pi blockchain.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card text-left">
          <div className="border-b border-border/70 px-5 py-6 text-center">
            <p className="text-xs font-medium text-muted-foreground">You sent</p>
            <p className="mt-1 inline-flex items-center gap-2 text-3xl font-bold tabular-nums text-foreground">
              <OusdIcon className="h-7 w-7" />
              {formatNumber(amount, 2)} OUSD
            </p>
          </div>
          <dl className="divide-y divide-border/70 px-5 text-sm">
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-muted-foreground">Recipient</dt>
              <dd className="max-w-[60%] truncate font-mono text-xs font-semibold text-foreground">
                {to || "Pi Wallet"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-muted-foreground">Network</dt>
              <dd className="font-semibold text-foreground">
                Pi {/testnet/i.test(String(horizon || "")) ? "Testnet" : "Mainnet"}
              </dd>
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
            {txid ? (
              <div className="flex items-center justify-between gap-4 py-4">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="max-w-[60%] truncate font-mono text-xs text-foreground">{txid}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {explorerUrl ? (
          <Button asChild variant="outline" className="mt-4 h-12 w-full rounded-full">
            <a href={explorerUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> View on Pi Block Explorer
            </a>
          </Button>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Button asChild variant="outline" className="h-12 rounded-full">
            <Link to="/activity"><ReceiptText className="mr-2 h-4 w-4" /> View activity</Link>
          </Button>
          <Button asChild className="h-12 rounded-full font-bold">
            <Link to="/dashboard"><Wallet className="mr-2 h-4 w-4" /> Done</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
