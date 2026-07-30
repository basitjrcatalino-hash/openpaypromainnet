import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/regulatory")({
  head: () => ({
    meta: [
      { title: "Regulatory Status — OpenPay Pro" },
      {
        name: "description",
        content:
          "Important disclosures about OpenPay and third-party providers — regulatory status, disclaimer, and pricing data feeds.",
      },
    ],
  }),
  component: RegulatoryPage,
});

function RegulatoryPage() {
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
          <h1 className="text-2xl font-semibold tracking-tight">Regulatory Status</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Important disclosures about OpenPay and third-party providers.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Last updated: July 30, 2026</p>

          <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">Regulatory Status</h2>
              <p>
                OpenPay is a technology platform developed and operated by Mrwain Organization.
                OpenPay is not a registered broker-dealer, investment adviser, exchange, custodian,
                bank, money transmitter, or financial institution, and is not subject to regulation
                as such in any jurisdiction unless explicitly stated otherwise.
              </p>
              <p>
                OpenPay does not directly offer, solicit, arrange, execute, clear, or settle
                securities, digital asset trades, or other regulated financial transactions. OpenPay
                does not provide brokerage, custody, investment advisory, or banking services.
              </p>
              <p>
                Any regulated services, including but not limited to payments, digital asset
                transactions, on-ramps, off-ramps, custody, or financial settlement, may be provided
                exclusively by independent third-party providers that integrate with the OpenPay
                platform. These providers are solely responsible for their own licensing, regulatory
                compliance, and legal obligations within the jurisdictions in which they operate.
              </p>
              <p>
                Nothing on the OpenPay website, APIs, merchant portal, or mobile applications
                constitutes, or should be interpreted as, an offer to sell or a solicitation to buy
                any security, digital asset, financial product, or regulated instrument. Any such
                offer may only be made by the applicable third-party provider and only in
                jurisdictions where such offers are legally permitted.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">Disclaimer</h2>
              <p>
                Information available through the OpenPay platform, website, APIs, and mobile
                applications is provided for general informational and technological purposes only
                and does not constitute financial, investment, legal, tax, or professional advice.
              </p>
              <p>
                OpenPay and Mrwain Organization do not endorse, control, verify, or guarantee any
                third-party providers, merchants, applications, integrations, tools, or services that
                may interact with the OpenPay ecosystem.
              </p>
              <p>
                OpenPay is not responsible for transactions, payments, losses, disputes, or outcomes
                resulting from interactions between users and third-party providers, merchants, or
                integrated services.
              </p>
              <p>
                All services are provided on an &quot;as is&quot; and &quot;as available&quot; basis
                without warranties of any kind, whether express or implied, including but not limited
                to warranties of accuracy, reliability, availability, security, merchantability, or
                fitness for a particular purpose.
              </p>
              <p>
                Users should carefully review the OpenPay{" "}
                <Link
                  to="/terms"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  to="/privacy"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Privacy Policy
                </Link>{" "}
                for additional disclosures, limitations of liability, and user responsibilities.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">Pricing &amp; Data Feeds</h2>
              <p>
                Any prices, exchange rates, token values, yields, availability, transaction fees, or
                market data displayed within OpenPay — including information related to OpenUSD, Pi
                Network integrations, or other supported assets — may be provided by third-party data
                providers or external services.
              </p>
              <p>
                Such information may be delayed, incomplete, inaccurate, or subject to change without
                notice. OpenPay does not independently verify pricing data and makes no
                representations or warranties regarding the accuracy, timeliness, or completeness of
                such information.
              </p>
              <p>
                Users should independently verify all pricing, fees, and data before making decisions
                or initiating any payment or transaction.
              </p>
              <p>
                All pricing data may be indicative only and may not reflect final or executable
                transaction prices. Use of pricing information and data feeds is entirely at the
                user&apos;s own risk.
              </p>
            </section>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            See also our{" "}
            <Link to="/terms" className="font-medium text-primary underline-offset-2 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
