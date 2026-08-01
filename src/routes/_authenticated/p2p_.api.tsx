import { createFileRoute, Link } from "@tanstack/react-router";
import { copyText } from "@/lib/clipboard";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { P2pMenuCard, P2pSubpageHeader } from "@/components/p2p/P2pSubpage";

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
    <div>
      <P2pSubpageHeader title="P2P / Ledger API" />

      <p className="px-4 py-3 text-xs text-muted-foreground md:px-6">
        Build on OpenPay Pro balances and partner rails. P2P escrow RPCs stay authenticated inside the app;
        public ledger endpoints are for partners.
      </p>

      <P2pMenuCard className="mb-3">
        {ENDPOINTS.map((e) => (
          <div key={e.name} className="border-b border-border/40 px-4 py-3.5 last:border-b-0">
            <p className="text-sm font-bold">{e.name}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{e.desc}</p>
            <button
              type="button"
              className="mt-2 break-all text-left font-mono text-[11px] text-primary"
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

      <div className="mx-4 mb-8 flex flex-col gap-2 md:mx-6">
        <Button asChild className="h-11 rounded-[8px] font-bold">
          <Link to="/ledger">Open ledger</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-[8px] font-bold">
          <Link to="/docs/openpay">OpenPay developer docs</Link>
        </Button>
      </div>
    </div>
  );
}
