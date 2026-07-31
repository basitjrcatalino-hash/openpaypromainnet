import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/wallet/PageHeader";
import { SolanaReceivePanel } from "@/components/solana-receive-panel";

export const Route = createFileRoute("/_authenticated/solana-pay")({
  head: () => ({
    meta: [
      {
        title: "Solana Pay — OpenPay Pro",
      },
      {
        name: "description",
        content:
          "Accept Solana payments with Wallet Standard connect, PaymentButton, and Solana Pay QR.",
      },
    ],
  }),
  component: SolanaPayPage,
});

function SolanaPayPage() {
  return (
    <div className="ot-phantom ph-page space-y-6 pb-10">
      <PageHeader title="Solana Pay" backTo="/dashboard" />

      <div className="rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground">
        Powered by{" "}
        <a
          href="https://solana.com/docs/tools/commerce-kit/quickstart/wallet-connection"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-primary inline-flex items-center gap-1"
        >
          Commerce Kit
          <ExternalLink className="h-3 w-3" />
        </a>
        {" · "}
        wallet connect, PaymentButton, and Solana Pay. This is separate from OpenPay Pro sign-in.
      </div>

      <SolanaReceivePanel />

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          to="/topup"
          search={{
            openpay_charge: undefined,
            openpay_ref: undefined,
            openpay_tx: undefined,
            openpay_return: undefined,
            openpay_cancel: undefined,
          }}
          className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground press"
        >
          Top up OUSD
        </Link>
        <Link
          to="/wallet/receive"
          search={{ network: "openpay", asset: "OUSD" }}
          className="rounded-full border border-border px-4 py-2 font-semibold press"
        >
          Ledger receive
        </Link>
        <a
          href="https://solana.com/docs/tools/commerce-kit/quickstart/payment-button"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 font-semibold"
        >
          PaymentButton docs
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
