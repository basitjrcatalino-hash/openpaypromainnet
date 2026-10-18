import { createFileRoute, Link } from "@tanstack/react-router";
import { copyText } from "@/lib/clipboard";
import { toast } from "sonner";

import { P2pHubLayout, P2pHubPill, P2pMenuCard } from "@/components/p2p/P2pSubpage";

export const Route = createFileRoute("/_authenticated/p2p_/api")({
  head: () => ({
    meta: [
      { title: "P2P / Ledger API — OpenPay Pro" },
      { name: "description", content: "Developer entry points for ledger and partner integrations." },
      { property: "og:title", content: "P2P / Ledger API — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApiPage,
});

const ENDPOINTS = [
  {
    name: "Public Ledger API",
    path: "/api/public/ledger",
    desc: "Balances and ledger movements for partner apps.",
  },
  {
    name: "OpenPay Connect",
    path: "/docs/openpay",
    desc: "OAuth connect + OpenPay Balance payments.",
  },
  {
    name: "Partner transfer docs",
    path: "/docs/openpay",
    desc: "Transfer and settlement guides for merchants.",
  },
];

function ApiPage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://openpaypro.space";

  return (
    <P2pHubLayout
      title="P2P / Ledger API"
      dek="Build on OpenPay Pro balances and partner rails. P2P escrow RPCs stay authenticated inside the app; public ledger endpoints are for partners."
      crumb="Developers"
      eyebrow="API · Partners"
      hero={{ from: "#e9d5ff", to: "#bfdbfe", glyph: "{ }" }}
      actions={
        <>
          <P2pHubPill to="/ledger" primary>
            Open ledger
          </P2pHubPill>
          <P2pHubPill to="/docs/openpay">Developer docs</P2pHubPill>
        </>
      }
    >
      <P2pMenuCard>
        {ENDPOINTS.map((e) => (
          <div key={e.name} className="border-b border-[var(--border)] px-5 py-4 last:border-b-0">
            <p className="text-lg font-bold tracking-tight">{e.name}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{e.desc}</p>
            <button
              type="button"
              className="mt-3 break-all text-left font-mono text-xs font-semibold text-[var(--primary)]"
              onClick={async () => {
                const url = e.path.startsWith("http") ? e.path : `${origin}${e.path}`;
                try {
                  await copyText(url);
                  toast.success("Copied");
                } catch {
                  toast.error("Copy failed");
                }
              }}
            >
              {e.path.startsWith("http") ? e.path : `${origin}${e.path}`}
            </button>
          </div>
        ))}
      </P2pMenuCard>

      <p className="text-sm text-[var(--muted-foreground)]">
        Need escrow help instead?{" "}
        <Link to="/p2p/guide" className="font-semibold text-[var(--foreground)] underline-offset-2 hover:underline">
          Read how P2P works
        </Link>
        .
      </p>
    </P2pHubLayout>
  );
}
