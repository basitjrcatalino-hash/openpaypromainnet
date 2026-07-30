import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

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

function PrivacyPage() {
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
          <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last updated: July 28, 2026</p>

          <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">1. Overview</h2>
              <p>
                This Privacy Policy explains how OpenPay Pro (“we”, “the App”) handles information
                when you use the wallet. Sign-in and some payment features are provided by OpenPay
                (openpy.space); their policies may also apply to that data.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">2. Information we process</h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <span className="font-medium text-foreground">Account identifiers</span> — such as
                  your OpenPay-linked user id, username, and session tokens after you sign in.
                </li>
                <li>
                  <span className="font-medium text-foreground">Wallet & transaction data</span> —
                  balances, transfers, swaps, OpenToken activity, and related ledger records needed
                  to run the product.
                </li>
                <li>
                  <span className="font-medium text-foreground">Device & usage</span> — basic
                  technical logs (for example errors, approximate region, or browser type) used to
                  keep the App secure and reliable.
                </li>
                <li>
                  <span className="font-medium text-foreground">Preferences</span> — settings you
                  choose in the App (theme, chart mode, and similar).
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">3. How we use information</h2>
              <p>
                We use this information to authenticate you, operate wallet features, prevent fraud
                and abuse, improve reliability, and comply with legal obligations. We do not sell
                your personal information.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">4. Sharing</h2>
              <p>
                We may share data with infrastructure providers (for example hosting, auth, and
                database services), with OpenPay when you use Connect or payments, and when required
                by law or to protect rights and safety. Public blockchain or on-app activity you
                initiate may be visible to others by design.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">5. Retention & security</h2>
              <p>
                We retain account and transaction records as long as needed to provide the service
                and meet legal or accounting requirements. We use reasonable technical and
                organizational measures, but no system is perfectly secure.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">6. Your choices</h2>
              <p>
                You can sign out at any time. Depending on your region, you may have rights to
                access, correct, or delete certain personal data. Contact us to make a request; we
                may need to verify your identity first.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">7. Children</h2>
              <p>
                The App is not directed to children under 13 (or the minimum age required in your
                country). We do not knowingly collect personal information from children.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">8. Changes</h2>
              <p>
                We may update this Privacy Policy and will revise the date above when we do.
                Continued use of the App after an update means you acknowledge the revised policy.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">9. Contact</h2>
              <p>
                Privacy requests:{" "}
                <a
                  href="mailto:support@openpy.space"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  support@openpy.space
                </a>
                .
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
