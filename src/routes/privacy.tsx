import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalDocLayout, LegalSection } from "@/components/legal-doc-layout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — OpenPay Pro" },
      {
        name: "description",
        content:
          "How OpenPay Pro collects, uses, and protects your wallet, payment, and account data.",
      },
      { property: "og:title", content: "Privacy Policy — OpenPay Pro" },
      {
        property: "og:description",
        content: "How OpenPay Pro collects, uses, and protects your wallet and account data.",
      },
      { property: "og:url", content: "https://openpaypro.space/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/privacy" }],
  }),
  component: PrivacyPage,
});

const PRIVACY_SPEECH = `
Privacy Policy for OpenPay Pro. Last updated July 28, 2026.

1. Overview. This Privacy Policy explains how OpenPay Pro handles information when you use the wallet. Sign-in and some payment features are provided by OpenPay at openpy.space; their policies may also apply to that data.

2. Information we process. Account identifiers such as your OpenPay-linked user id, username, and session tokens after you sign in. Wallet and transaction data including balances, transfers, swaps, OpenToken activity, and related ledger records needed to run the product. Device and usage logs used to keep the App secure and reliable. Preferences such as theme and chart mode.

3. How we use information. We use this information to authenticate you, operate wallet features, prevent fraud and abuse, improve reliability, and comply with legal obligations. We do not sell your personal information.

4. Sharing. We may share data with infrastructure providers, with OpenPay when you use Connect or payments, and when required by law or to protect rights and safety. Public blockchain or on-app activity you initiate may be visible to others by design.

5. Retention and security. We retain account and transaction records as long as needed to provide the service and meet legal or accounting requirements. We use reasonable technical and organizational measures, but no system is perfectly secure.

6. Your choices. You can sign out at any time. Depending on your region, you may have rights to access, correct, or delete certain personal data. Contact us to make a request; we may need to verify your identity first.

7. Children. The App is not directed to children under 13, or the minimum age required in your country. We do not knowingly collect personal information from children.

8. Changes. We may update this Privacy Policy and will revise the date above when we do. Continued use of the App after an update means you acknowledge the revised policy.

9. Contact. Privacy requests: support at openpy.space.
`.trim();

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "information", label: "Information we process" },
  { id: "use", label: "How we use information" },
  { id: "sharing", label: "Sharing" },
  { id: "retention", label: "Retention & security" },
  { id: "choices", label: "Your choices" },
  { id: "children", label: "Children" },
  { id: "changes", label: "Changes" },
  { id: "contact", label: "Contact" },
];

function PrivacyPage() {
  return (
    <LegalDocLayout
      navKey="privacy"
      title="Privacy Policy"
      dek="How OpenPay Pro collects, uses, and protects wallet, payment, and account data — written clearly, designed like our Blog and Wiki."
      updated="July 28, 2026"
      speechId="page:privacy"
      speechText={PRIVACY_SPEECH}
      hero={{ from: "#a5b4fc", to: "#c4b5fd", glyph: "◎" }}
      toc={TOC}
    >
      <LegalSection id="overview" heading="1. Overview">
        <p>
          This Privacy Policy explains how OpenPay Pro (“we”, “the App”) handles information when you
          use the wallet. Sign-in and some payment features are provided by OpenPay (openpy.space);
          their policies may also apply to that data.
        </p>
      </LegalSection>

      <LegalSection id="information" heading="2. Information we process">
        <ul className="space-y-3 pl-1">
          {[
            {
              title: "Account identifiers",
              body: "OpenPay-linked user id, username, and session tokens after you sign in.",
            },
            {
              title: "Wallet & transaction data",
              body: "Balances, transfers, swaps, OpenToken activity, and related ledger records needed to run the product.",
            },
            {
              title: "Device & usage",
              body: "Basic technical logs (for example errors, approximate region, or browser type) used to keep the App secure and reliable.",
            },
            {
              title: "Preferences",
              body: "Settings you choose in the App (theme, chart mode, and similar).",
            },
          ].map((item) => (
            <li key={item.title} className="flex gap-3 text-lg leading-relaxed">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
              <span>
                <span className="font-semibold text-[var(--foreground)]">{item.title}</span> —{" "}
                {item.body}
              </span>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="use" heading="3. How we use information">
        <p>
          We use this information to authenticate you, operate wallet features, prevent fraud and
          abuse, improve reliability, and comply with legal obligations. We do not sell your personal
          information.
        </p>
      </LegalSection>

      <LegalSection id="sharing" heading="4. Sharing">
        <p>
          We may share data with infrastructure providers (for example hosting, auth, and database
          services), with OpenPay when you use Connect or payments, and when required by law or to
          protect rights and safety. Public blockchain or on-app activity you initiate may be visible
          to others by design.
        </p>
      </LegalSection>

      <LegalSection id="retention" heading="5. Retention & security">
        <p>
          We retain account and transaction records as long as needed to provide the service and meet
          legal or accounting requirements. We use reasonable technical and organizational measures,
          but no system is perfectly secure.
        </p>
      </LegalSection>

      <LegalSection id="choices" heading="6. Your choices">
        <p>
          You can sign out at any time. Depending on your region, you may have rights to access,
          correct, or delete certain personal data. Contact us to make a request; we may need to
          verify your identity first.
        </p>
      </LegalSection>

      <LegalSection id="children" heading="7. Children">
        <p>
          The App is not directed to children under 13 (or the minimum age required in your country).
          We do not knowingly collect personal information from children.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="8. Changes">
        <p>
          We may update this Privacy Policy and will revise the date above when we do. Continued use
          of the App after an update means you acknowledge the revised policy.
        </p>
      </LegalSection>

      <LegalSection id="contact" heading="9. Contact">
        <p>
          Privacy requests:{" "}
          <a
            href="mailto:support@openpy.space"
            className="font-semibold text-[var(--foreground)] underline underline-offset-2"
          >
            support@openpy.space
          </a>
          . See also our{" "}
          <Link to="/terms" className="font-semibold underline underline-offset-2">
            Terms of Service
          </Link>
          ,{" "}
          <Link to="/legal" className="font-semibold underline underline-offset-2">
            Software License
          </Link>
          , and{" "}
          <Link to="/regulatory" className="font-semibold underline underline-offset-2">
            Regulatory Status
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDocLayout>
  );
}
