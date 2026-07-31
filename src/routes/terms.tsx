import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalDocLayout, LegalSection } from "@/components/legal-doc-layout";

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

const TERMS_SPEECH = `
Terms of Service for OpenPay Pro. Last updated July 28, 2026.

1. Agreement. By accessing or using OpenPay Pro, the App, you agree to these Terms of Service. If you do not agree, do not use the App.

2. The service. OpenPay Pro is a web3 wallet experience for OUSD, OpenToken assets, NFTs, and related features. Sign-in is provided through OpenPay. Some features depend on third-party networks and services that we do not control.

3. Eligibility and accounts. You must be able to form a binding contract in your jurisdiction. You are responsible for activity under your OpenPay-linked account and for keeping access credentials secure.

4. Acceptable use. You agree not to misuse the App, including attempts to disrupt service, exploit bugs, launder funds, violate sanctions, or infringe others’ rights. We may suspend or restrict access for abuse or legal risk.

5. Digital assets and risk. Cryptocurrency and token balances can lose value, become illiquid, or be lost due to user error, market moves, or technical failure. OpenToken launches, swaps, and NFT actions are experimental and may involve fees. Nothing in the App is investment, legal, or tax advice.

6. Fees. Certain actions, for example OpenDEX swaps or token launches, may charge platform fees disclosed in the App. Network or partner fees may apply separately.

7. Disclaimers. The App is provided as is without warranties of any kind. To the fullest extent permitted by law, we disclaim liability for indirect, incidental, or consequential damages arising from your use of the App.

8. Changes. We may update these Terms. Continued use after changes means you accept the updated Terms. Material changes may be noted by updating the date above.

9. Contact. Questions about these Terms: support at openpy.space. Related OpenPay policies may also apply when you use OpenPay sign-in or payments.
`.trim();

const TOC = [
  { id: "agreement", label: "Agreement" },
  { id: "service", label: "The service" },
  { id: "eligibility", label: "Eligibility" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "risk", label: "Digital assets & risk" },
  { id: "fees", label: "Fees" },
  { id: "disclaimers", label: "Disclaimers" },
  { id: "changes", label: "Changes" },
  { id: "contact", label: "Contact" },
];

function TermsPage() {
  return (
    <LegalDocLayout
      navKey="terms"
      title="Terms of Service"
      dek="The rules for using OpenPay Pro — wallet, transfers, OpenTokens, NFTs, and related features."
      updated="July 28, 2026"
      speechId="page:terms"
      speechText={TERMS_SPEECH}
      hero={{ from: "#c4b5fd", to: "#ab9ff2", glyph: "§" }}
      toc={TOC}
    >
      <LegalSection id="agreement" heading="1. Agreement">
        <p>
          By accessing or using OpenPay Pro (“the App”), you agree to these Terms of Service. If you
          do not agree, do not use the App.
        </p>
      </LegalSection>

      <LegalSection id="service" heading="2. The service">
        <p>
          OpenPay Pro is a web3 wallet experience for OUSD, OpenToken assets, NFTs, and related
          features. Sign-in is provided through OpenPay. Some features depend on third-party networks
          and services that we do not control.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" heading="3. Eligibility & accounts">
        <p>
          You must be able to form a binding contract in your jurisdiction. You are responsible for
          activity under your OpenPay-linked account and for keeping access credentials secure.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" heading="4. Acceptable use">
        <p>
          You agree not to misuse the App, including attempts to disrupt service, exploit bugs,
          launder funds, violate sanctions, or infringe others’ rights. We may suspend or restrict
          access for abuse or legal risk.
        </p>
      </LegalSection>

      <LegalSection id="risk" heading="5. Digital assets & risk">
        <p>
          Cryptocurrency and token balances can lose value, become illiquid, or be lost due to user
          error, market moves, or technical failure. OpenToken launches, swaps, and NFT actions are
          experimental and may involve fees. Nothing in the App is investment, legal, or tax advice.
        </p>
      </LegalSection>

      <LegalSection id="fees" heading="6. Fees">
        <p>
          Certain actions (for example OpenDEX swaps or token launches) may charge platform fees
          disclosed in the App. Network or partner fees may apply separately.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" heading="7. Disclaimers">
        <p>
          The App is provided “as is” without warranties of any kind. To the fullest extent permitted
          by law, we disclaim liability for indirect, incidental, or consequential damages arising
          from your use of the App.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="8. Changes">
        <p>
          We may update these Terms. Continued use after changes means you accept the updated Terms.
          Material changes may be noted by updating the date above.
        </p>
      </LegalSection>

      <LegalSection id="contact" heading="9. Contact">
        <p>
          Questions about these Terms:{" "}
          <a
            href="mailto:support@openpy.space"
            className="font-semibold text-[var(--foreground)] underline underline-offset-2"
          >
            support@openpy.space
          </a>
          . Related OpenPay policies may also apply when you use OpenPay sign-in or payments. See
          also our{" "}
          <Link to="/privacy" className="font-semibold underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link to="/regulatory" className="font-semibold underline underline-offset-2">
            Regulatory Status
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDocLayout>
  );
}
