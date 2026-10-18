import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ShieldCheck, Wallet } from "lucide-react";

const TITLE = "How to Transfer Pi Network to Your Pi Wallet — OpenPay Pro";
const DESCRIPTION =
  "Step-by-step guide to transferring Pi Network coins to a Pi wallet, plus which wallets support Pi and how to manage Pi and OUSD in OpenPay Pro.";
const URL = "https://openpaypro.space/guides/transfer-pi";

const STEPS = [
  {
    name: "Complete Pi KYC and mainnet migration",
    text: "Pi can only move on Mainnet after your KYC is approved and your balance has migrated from the Pi app to the Mainnet blockchain. Check Mainnet Checklist in the Pi app first.",
  },
  {
    name: "Open or connect a Pi-compatible wallet",
    text: "Your Pi Wallet passphrase controls your Mainnet keys. Wallets that support Pi include the official Pi Wallet and Pi-integrated apps such as OpenPay Pro, which connects through Pi Sign-In inside Pi Browser.",
  },
  {
    name: "Copy the destination wallet address",
    text: "In OpenPay Pro open Receive and copy your wallet address, or use your @username handle. Always paste — never retype — the address.",
  },
  {
    name: "Send the Pi transfer",
    text: "From your Pi Wallet choose Send, paste the destination address, enter the amount, and confirm with your passphrase. Send a small test amount the first time.",
  },
  {
    name: "Confirm the transaction",
    text: "Mainnet transfers settle in seconds. Open Activity or the public Ledger in OpenPay Pro to confirm the credited amount and view the on-chain record.",
  },
];

export const Route = createFileRoute("/guides/transfer-pi")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "How to Transfer Pi Network to Your Pi Wallet" },
      {
        property: "og:description",
        content:
          "A clear five-step guide to moving Pi Network coins to a Pi-compatible wallet like OpenPay Pro.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to transfer Pi Network coins to your Pi wallet",
          description: DESCRIPTION,
          step: STEPS.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.name,
            text: s.text,
          })),
        }),
      },
    ],
  }),
  component: TransferPiGuide,
});

function TransferPiGuide() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-6">
        <Link
          to="/authpi"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <header className="rounded-3xl bg-card p-6 shadow-card sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Guide</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            How to transfer Pi Network to your Pi wallet
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{DESCRIPTION}</p>
        </header>

        <section className="rounded-3xl bg-card p-6 shadow-card sm:p-8">
          <h2 className="text-base font-semibold">Which wallets support Pi Network?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Pi runs on its own Mainnet, so general-purpose wallets such as MetaMask or Phantom
            cannot hold Pi. You need a Pi-native wallet: the official Pi Wallet, or a Pi-integrated
            app. OpenPay Pro is a Pi-integrated wallet — you sign in with your Pi account, keep Pi
            alongside OUSD and other assets, and every movement is written to a public ledger.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Hold Pi and OUSD in one place, with swaps and payments built in.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Pi Sign-In, KYC status, biometric unlock, and PIN protection.
            </li>
          </ul>
        </section>

        <section className="rounded-3xl bg-card p-6 shadow-card sm:p-8">
          <h2 className="text-base font-semibold">Transfer Pi in five steps</h2>
          <ol className="mt-4 space-y-5">
            {STEPS.map((step, i) => (
              <li key={step.name} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{step.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-3xl bg-card p-6 shadow-card sm:p-8">
          <h2 className="text-base font-semibold">Common issues</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">Transfer not arriving?</strong> Confirm your
              balance actually migrated to Mainnet — unmigrated Pi in the Pi app cannot be sent.
            </p>
            <p>
              <strong className="text-foreground">Wrong address?</strong> Mainnet transfers are
              irreversible. Always test with a small amount before moving a full balance.
            </p>
            <p>
              <strong className="text-foreground">Lost passphrase?</strong> Nobody can restore it,
              including Pi Core Team. Store your recovery phrase offline.
            </p>
          </div>
        </section>

        <Link
          to="/authpi"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          Open OpenPay Pro
          <ArrowRight className="h-4 w-4" />
        </Link>
      </article>
    </div>
  );
}
