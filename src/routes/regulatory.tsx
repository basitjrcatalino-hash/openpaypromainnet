import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalDocLayout, LegalSection } from "@/components/legal-doc-layout";

export const Route = createFileRoute("/regulatory")({
  head: () => ({
    meta: [
      { title: "Regulatory Status — OpenPay Pro" },
      {
        name: "description",
        content:
          "Important disclosures about OpenPay and third-party providers — regulatory status, disclaimer, and pricing data feeds.",
      },
      { property: "og:title", content: "Regulatory Status — OpenPay Pro" },
      {
        property: "og:description",
        content: "Disclosures on OpenPay's regulatory status, third-party providers, and price feeds.",
      },
      { property: "og:url", content: "https://openpaypro.space/regulatory" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/regulatory" }],
  }),
  component: RegulatoryPage,
});

const REGULATORY_SPEECH = `
Regulatory Status for OpenPay Pro. Last updated July 30, 2026. Important disclosures about OpenPay and third-party providers.

Regulatory Status. OpenPay is a technology platform developed and operated by Mrwain Organization. OpenPay is not a registered broker-dealer, investment adviser, exchange, custodian, bank, money transmitter, or financial institution, and is not subject to regulation as such in any jurisdiction unless explicitly stated otherwise.

OpenPay does not directly offer, solicit, arrange, execute, clear, or settle securities, digital asset trades, or other regulated financial transactions. OpenPay does not provide brokerage, custody, investment advisory, or banking services.

Any regulated services, including but not limited to payments, digital asset transactions, on-ramps, off-ramps, custody, or financial settlement, may be provided exclusively by independent third-party providers that integrate with the OpenPay platform. These providers are solely responsible for their own licensing, regulatory compliance, and legal obligations within the jurisdictions in which they operate.

Nothing on the OpenPay website, APIs, merchant portal, or mobile applications constitutes, or should be interpreted as, an offer to sell or a solicitation to buy any security, digital asset, financial product, or regulated instrument. Any such offer may only be made by the applicable third-party provider and only in jurisdictions where such offers are legally permitted.

Disclaimer. Information available through the OpenPay platform, website, APIs, and mobile applications is provided for general informational and technological purposes only and does not constitute financial, investment, legal, tax, or professional advice.

OpenPay and Mrwain Organization do not endorse, control, verify, or guarantee any third-party providers, merchants, applications, integrations, tools, or services that may interact with the OpenPay ecosystem.

OpenPay is not responsible for transactions, payments, losses, disputes, or outcomes resulting from interactions between users and third-party providers, merchants, or integrated services.

All services are provided on an as is and as available basis without warranties of any kind, whether express or implied, including but not limited to warranties of accuracy, reliability, availability, security, merchantability, or fitness for a particular purpose.

Users should carefully review the OpenPay Terms of Service and Privacy Policy for additional disclosures, limitations of liability, and user responsibilities.

Pricing and Data Feeds. Any prices, exchange rates, token values, yields, availability, transaction fees, or market data displayed within OpenPay — including information related to OpenUSD, Pi Network integrations, or other supported assets — may be provided by third-party data providers or external services.

Such information may be delayed, incomplete, inaccurate, or subject to change without notice. OpenPay does not independently verify pricing data and makes no representations or warranties regarding the accuracy, timeliness, or completeness of such information.

Users should independently verify all pricing, fees, and data before making decisions or initiating any payment or transaction.

All pricing data may be indicative only and may not reflect final or executable transaction prices. Use of pricing information and data feeds is entirely at the user’s own risk.
`.trim();

const TOC = [
  { id: "status", label: "Regulatory Status" },
  { id: "disclaimer", label: "Disclaimer" },
  { id: "pricing", label: "Pricing & Data Feeds" },
];

function RegulatoryPage() {
  return (
    <LegalDocLayout
      navKey="regulatory"
      title="Regulatory Status"
      dek="Important disclosures about OpenPay, third-party providers, and pricing data."
      updated="July 30, 2026"
      speechId="page:regulatory"
      speechText={REGULATORY_SPEECH}
      hero={{ from: "#93c5fd", to: "#a78bfa", glyph: "⚖" }}
      toc={TOC}
    >
      <LegalSection id="status" heading="Regulatory Status">
        <p>
          OpenPay is a technology platform developed and operated by Mrwain Organization. OpenPay is
          not a registered broker-dealer, investment adviser, exchange, custodian, bank, money
          transmitter, or financial institution, and is not subject to regulation as such in any
          jurisdiction unless explicitly stated otherwise.
        </p>
        <p>
          OpenPay does not directly offer, solicit, arrange, execute, clear, or settle securities,
          digital asset trades, or other regulated financial transactions. OpenPay does not provide
          brokerage, custody, investment advisory, or banking services.
        </p>
        <p>
          Any regulated services, including but not limited to payments, digital asset transactions,
          on-ramps, off-ramps, custody, or financial settlement, may be provided exclusively by
          independent third-party providers that integrate with the OpenPay platform. These providers
          are solely responsible for their own licensing, regulatory compliance, and legal obligations
          within the jurisdictions in which they operate.
        </p>
        <blockquote className="rounded-2xl border-l-4 border-[var(--primary)] bg-[var(--accent)] px-6 py-5 text-lg font-medium leading-relaxed">
          Nothing on the OpenPay website, APIs, merchant portal, or mobile applications constitutes,
          or should be interpreted as, an offer to sell or a solicitation to buy any security,
          digital asset, financial product, or regulated instrument.
        </blockquote>
        <p>
          Any such offer may only be made by the applicable third-party provider and only in
          jurisdictions where such offers are legally permitted.
        </p>
      </LegalSection>

      <LegalSection id="disclaimer" heading="Disclaimer">
        <p>
          Information available through the OpenPay platform, website, APIs, and mobile applications
          is provided for general informational and technological purposes only and does not
          constitute financial, investment, legal, tax, or professional advice.
        </p>
        <p>
          OpenPay and Mrwain Organization do not endorse, control, verify, or guarantee any
          third-party providers, merchants, applications, integrations, tools, or services that may
          interact with the OpenPay ecosystem.
        </p>
        <p>
          OpenPay is not responsible for transactions, payments, losses, disputes, or outcomes
          resulting from interactions between users and third-party providers, merchants, or
          integrated services.
        </p>
        <p>
          All services are provided on an “as is” and “as available” basis without warranties of any
          kind, whether express or implied, including but not limited to warranties of accuracy,
          reliability, availability, security, merchantability, or fitness for a particular purpose.
        </p>
        <p>
          Users should carefully review the OpenPay{" "}
          <Link to="/terms" className="font-semibold underline underline-offset-2">
            Terms of Service
          </Link>
          ,{" "}
          <Link to="/privacy" className="font-semibold underline underline-offset-2">
            Privacy Policy
          </Link>
          , and{" "}
          <Link to="/legal" className="font-semibold underline underline-offset-2">
            Software License
          </Link>{" "}
          for additional disclosures, limitations of liability, and user responsibilities.
        </p>
      </LegalSection>

      <LegalSection id="pricing" heading="Pricing & Data Feeds">
        <p>
          Any prices, exchange rates, token values, yields, availability, transaction fees, or market
          data displayed within OpenPay — including information related to OpenUSD, Pi Network
          integrations, or other supported assets — may be provided by third-party data providers or
          external services.
        </p>
        <p>
          Such information may be delayed, incomplete, inaccurate, or subject to change without
          notice. OpenPay does not independently verify pricing data and makes no representations or
          warranties regarding the accuracy, timeliness, or completeness of such information.
        </p>
        <ul className="space-y-3 pl-1">
          {[
            "Independently verify all pricing, fees, and data before deciding or paying.",
            "Pricing may be indicative only and may not reflect final executable prices.",
            "Use of pricing information and data feeds is entirely at your own risk.",
          ].map((item) => (
            <li key={item} className="flex gap-3 text-lg leading-relaxed">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </LegalSection>
    </LegalDocLayout>
  );
}
