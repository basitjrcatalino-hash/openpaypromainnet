import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsCode, DocsSection, DocsShell } from "@/components/docs/DocsShell";
import { DOCS_BASE, PARTNER_API } from "@/lib/docs-nav";

export const Route = createFileRoute("/docs/tokens")({
  head: () => ({
    meta: [
      { title: "Tokens & Assets Docs — OUSD, Majors, OpenToken" },
      {
        name: "description",
        content:
          "Integrate OpenPay Pro tokens: OUSD ledger dollar, major assets, OpenToken launchpad, and NFTs.",
      },
      { property: "og:url", content: `${DOCS_BASE}/docs/tokens` },
    ],
    links: [{ rel: "canonical", href: `${DOCS_BASE}/docs/tokens` }],
  }),
  component: TokensDocsPage,
});

function TokensDocsPage() {
  return (
    <DocsShell
      title="Tokens & assets"
      description="OUSD, majors (BTC, ETH, SOL, PI, USDC, USDT, …), OpenToken bonding curves, and OpenNFT — how partners should treat each asset class."
      pathname="/docs/tokens"
      eyebrow="Core guides"
    >
      <DocsSection id="ousd" eyebrow="01" title="OUSD (OpenUSD)">
        <p className="text-sm leading-relaxed text-muted-foreground">
          OpenPay’s <strong className="text-foreground">$1 ledger dollar</strong> on the open network
          ledger — not a public ERC-20/SPL mint. Treat it like listing a network asset via REST.
        </p>
        <DocsCode>{`{
  "symbol": "OUSD",
  "name": "OpenUSD",
  "network_id": "openpay",
  "decimals": 8,
  "display_decimals": 2,
  "peg": "USD",
  "explorer": "${DOCS_BASE}/ledger"
}`}</DocsCode>
        <p className="text-sm text-muted-foreground">
          Full exchange listing guide:{" "}
          <Link to="/docs/exchange" className="font-semibold text-primary hover:underline">
            /docs/exchange
          </Link>
        </p>
      </DocsSection>

      <DocsSection id="majors" eyebrow="02" title="Major assets on Pro">
        <p className="text-sm leading-relaxed text-muted-foreground">
          OpenPay Pro wallets hold majors beside OUSD (balances on the Pro ledger): BTC, ETH, SOL, PI,
          USDC, USDT, EURC, CASH, and more. Partners usually integrate{" "}
          <strong className="text-foreground">OUSD</strong> via Partner Transfer; majors are
          in-app/ledger unless you deep-link users into Pro.
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            Deep-link holdings: <code className="text-foreground">{DOCS_BASE}/assets</code>
          </li>
          <li>
            Trade / swap UI: <code className="text-foreground">{DOCS_BASE}/trade</code> ·{" "}
            <code className="text-foreground">{DOCS_BASE}/swap</code>
          </li>
          <li>
            Ledger filter: <code className="text-foreground">?asset=USDC</code> etc.
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="opentoken" eyebrow="03" title="OpenToken">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Community coins on bonding curves, minted and traded against OUSD inside Pro. There is no
          separate partner mint HTTP API — send users to:
        </p>
        <DocsCode>{`${DOCS_BASE}/opentoken
${DOCS_BASE}/opentoken/create`}</DocsCode>
        <p className="text-sm text-muted-foreground">
          Activity appears on the Public Ledger as mint / swap / send / receive with OpenToken
          symbols.
        </p>
      </DocsSection>

      <DocsSection id="nft" eyebrow="04" title="OpenNFT">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Collectibles linked to the OpenPay network. High-level partner notes live in{" "}
          <Link to="/docs/openpay" className="font-semibold text-primary hover:underline">
            Connect & payments → NFT
          </Link>
          . End users browse under Collectibles on Home / Assets.
        </p>
      </DocsSection>

      <DocsSection id="resolve" eyebrow="05" title="Resolve accounts">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Before sending OUSD, resolve the destination:
        </p>
        <DocsCode>{`curl -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  ${PARTNER_API}/accounts/@satoshi`}</DocsCode>
      </DocsSection>
    </DocsShell>
  );
}
