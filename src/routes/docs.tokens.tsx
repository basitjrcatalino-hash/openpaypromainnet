import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsCode, DocsSection, DocsShell } from "@/components/docs/DocsShell";
import { Card } from "@/components/ui/card";
import { DOCS_BASE, LEDGER_API_BASE, PARTNER_API } from "@/lib/docs-nav";

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

const SPEECH = `
Tokens and assets docs.
OUSD is OpenPay's ledger dollar on the open network — list it via Partner Transfer and Ledger.
Majors live on the Pro ledger beside OUSD. OpenToken community coins trade against OUSD in-app.
OpenNFT partner mint HTTP is not public yet — deep-link users into Pro collectibles.
`.trim();

const ASSET_CODES: { code: string; cls: string; api: string }[] = [
  { code: "OUSD", cls: "Network ledger dollar", api: "Yes — transfers and charges" },
  { code: "BTC / ETH / SOL / PI", cls: "Pro majors", api: "Deep-link / Ledger only" },
  { code: "USDC / USDT / ...", cls: "Pro stables", api: "Deep-link / Ledger only" },
  { code: "OpenToken symbols", cls: "Bonding-curve coins", api: "Deep-link / Ledger only" },
];

function TokensDocsPage() {
  const ledgerFilter = `${LEDGER_API_BASE}?asset=USDC`;
  const openTokenLinks = [
    `${DOCS_BASE}/opentoken          # discover and trade`,
    `${DOCS_BASE}/opentoken/create   # launch a coin`,
    `${DOCS_BASE}/opentoken/$tokenId # token page + live chat`,
  ].join("\n");

  return (
    <DocsShell
      title="Tokens & assets"
      description="OUSD, majors (BTC, ETH, SOL, PI, USDC, USDT, ...), OpenToken bonding curves, and OpenNFT — how partners should treat each asset class."
      pathname="/docs/tokens"
      eyebrow="Core guides"
      speechText={SPEECH}
    >
      <Card className="rounded-2xl border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
        Partner APIs move <strong className="text-foreground">OUSD</strong> on OpenPay. Pro wallets
        also hold majors and OpenTokens on the Pro ledger. Use the{" "}
        <Link to="/docs/exchange" className="font-semibold text-primary hover:underline">
          Exchange guide
        </Link>{" "}
        when listing OUSD like a network asset.
      </Card>

      <DocsSection id="ousd" eyebrow="01" title="OUSD (OpenUSD)">
        <p className="text-sm leading-relaxed text-muted-foreground">
          OpenPay&apos;s <strong className="text-foreground">$1 ledger dollar</strong> on the open
          network ledger — not a public ERC-20/SPL mint. Treat it like listing a network asset via
          REST.
        </p>
        <DocsCode>{`{
  "symbol": "OUSD",
  "name": "OpenUSD",
  "network_id": "openpay",
  "decimals": 8,
  "display_decimals": 2,
  "peg": "USD",
  "contract": null,
  "explorer": "${DOCS_BASE}/ledger"
}`}</DocsCode>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            Deposit / withdraw for exchanges:{" "}
            <Link to="/docs/exchange" className="font-semibold text-primary hover:underline">
              /docs/exchange
            </Link>
          </li>
          <li>
            Partner send / charges:{" "}
            <Link to="/docs/api" className="font-semibold text-primary hover:underline">
              /docs/api
            </Link>
          </li>
          <li>No public EVM/SPL contract address — balances are API / ledger based.</li>
        </ul>
      </DocsSection>

      <DocsSection id="majors" eyebrow="02" title="Major assets on Pro">
        <p className="text-sm leading-relaxed text-muted-foreground">
          OpenPay Pro wallets hold majors beside OUSD on the Pro ledger. Partners usually integrate{" "}
          <strong className="text-foreground">OUSD</strong> via Partner Transfer; majors are
          in-app/ledger unless you deep-link users into Pro.
        </p>
        <DocsCode>{`Common ledger / UI codes
OUSD, BTC, ETH, SOL, PI, USDC, USDT, PYUSD, USDG, USD1, CASH, EURC`}</DocsCode>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            Deep-link holdings: <code className="text-foreground">{DOCS_BASE}/assets</code>
          </li>
          <li>
            Trade / swap UI: <code className="text-foreground">{DOCS_BASE}/trade</code> ·{" "}
            <code className="text-foreground">{DOCS_BASE}/swap</code>
          </li>
          <li>
            Ledger filter: <code className="text-foreground">{ledgerFilter}</code>
          </li>
          <li>
            Spot account transfers (Funding / Spot / Futures / P2P) are in-app only — see Transfer
            in Pro.
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="opentoken" eyebrow="03" title="OpenToken lifecycle">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Community coins on bonding curves, minted and traded against OUSD inside Pro. There is{" "}
          <strong className="text-foreground">no separate partner mint HTTP API</strong> — send
          users to Pro surfaces:
        </p>
        <DocsCode>{openTokenLinks}</DocsCode>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Create</strong> — creator sets name/symbol/logo;
            bonding curve starts against OUSD.
          </li>
          <li>
            <strong className="text-foreground">Buy / sell</strong> — in-app TradePanel; platform
            fee credits the fee wallet.
          </li>
          <li>
            <strong className="text-foreground">Ledger</strong> — mint / swap / send / receive rows
            appear with the OpenToken symbol on the Public Ledger.
          </li>
          <li>
            <strong className="text-foreground">Holdings</strong> — show under Assets / OpenToken
            portfolio for the signed-in user.
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="nft" eyebrow="04" title="OpenNFT">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Collectibles linked to the OpenPay network. A public{" "}
          <strong className="text-foreground">nft-partner-api</strong> HTTP surface is{" "}
          <strong className="text-foreground">not deployed yet</strong> — do not invent mint
          endpoints. End users browse and mint in Pro after linking OpenPay (Connect).
        </p>
        <DocsCode>{`${DOCS_BASE}/nfts
${DOCS_BASE}/nfts/mint
# Partner notes: /docs/openpay#nft`}</DocsCode>
      </DocsSection>

      <DocsSection id="asset-codes" eyebrow="05" title="Asset codes cheat sheet">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Use these symbols consistently in Ledger filters, Partner Transfer{" "}
          <code className="text-foreground">currency</code> (OUSD), and deep links.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Class</th>
                <th className="px-3 py-2 font-semibold">Partner API</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              {ASSET_CODES.map((row) => (
                <tr key={row.code}>
                  <td className="px-3 py-2 font-medium text-foreground">{row.code}</td>
                  <td className="px-3 py-2">{row.cls}</td>
                  <td className="px-3 py-2">{row.api}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocsSection>

      <DocsSection id="resolve" eyebrow="06" title="Resolve accounts before send">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Before sending OUSD, resolve the destination:
        </p>
        <DocsCode>{`curl -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  ${PARTNER_API}/accounts/@satoshi`}</DocsCode>
      </DocsSection>
    </DocsShell>
  );
}
