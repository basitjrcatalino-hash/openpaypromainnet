import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — OpenPay Pro" },
      {
        name: "description",
        content:
          "The terms that govern your use of the OpenPay Pro wallet, transfers, tokens, and NFT features.",
      },
      { property: "og:title", content: "Terms of Service — OpenPay Pro" },
      {
        property: "og:description",
        content: "The terms governing use of the OpenPay Pro wallet, transfers, tokens, and NFTs.",
      },
      { property: "og:url", content: "https://openpaypro.space/terms" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          to="/authpi"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div className="rounded-3xl bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last updated: July 28, 2026</p>

          <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">1. Agreement</h2>
              <p>
                By accessing or using OpenPay Pro (“the App”), you agree to these Terms of Service.
                If you do not agree, do not use the App.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">2. The service</h2>
              <p>
                OpenPay Pro is a web3 wallet experience for OUSD, OpenToken assets, NFTs, and related
                features. Sign-in is provided through OpenPay. Some features depend on third-party
                networks and services that we do not control.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">3. Eligibility & accounts</h2>
              <p>
                You must be able to form a binding contract in your jurisdiction. You are responsible
                for activity under your OpenPay-linked account and for keeping access credentials
                secure.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">4. Acceptable use</h2>
              <p>
                You agree not to misuse the App, including attempts to disrupt service, exploit bugs,
                launder funds, violate sanctions, or infringe others’ rights. We may suspend or
                restrict access for abuse or legal risk.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">5. Digital assets & risk</h2>
              <p>
                Cryptocurrency and token balances can lose value, become illiquid, or be lost due to
                user error, market moves, or technical failure. OpenToken launches, swaps, and NFT
                actions are experimental and may involve fees. Nothing in the App is investment,
                legal, or tax advice.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">6. Fees</h2>
              <p>
                Certain actions (for example OpenDEX swaps or token launches) may charge platform
                fees disclosed in the App. Network or partner fees may apply separately.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">7. Disclaimers</h2>
              <p>
                The App is provided “as is” without warranties of any kind. To the fullest extent
                permitted by law, we disclaim liability for indirect, incidental, or consequential
                damages arising from your use of the App.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">8. Changes</h2>
              <p>
                We may update these Terms. Continued use after changes means you accept the updated
                Terms. Material changes may be noted by updating the date above.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">9. Contact</h2>
              <p>
                Questions about these Terms:{" "}
                <a
                  href="mailto:support@openpy.space"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  support@openpy.space
                </a>
                . Related OpenPay policies may also apply when you use OpenPay sign-in or payments.
              </p>
            </section>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            See also our{" "}
            <Link to="/privacy" className="font-medium text-primary underline-offset-2 hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              to="/regulatory"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Regulatory Status
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
