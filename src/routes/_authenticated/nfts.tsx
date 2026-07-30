import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
  MoreHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/wallet/PageHeader";
import { formatNumber } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import {
  NftSearchBar,
  OpenNftCollectiblesPanel,
  PhantomNftTile,
} from "@/components/open-nft-collectibles";
import {
  OPENPAY_NFT_MARKET_URL,
  OPENPAY_PRO_STORE_URL,
  OPENPAY_NFT_API_DOCS_URL,
  openNftImageSrc,
  fetchOpenNftStats,
  fetchOpenNftActivity,
  fetchOpenNftCollections,
  type OpenNftMarketplaceCollection,
  type OpenNftMarketplaceItem,
  type OpenNftMarketplaceStats,
} from "@/lib/openpay-nft";

export const Route = createFileRoute("/_authenticated/nfts")({
  head: () => ({
    meta: [
      { title: "Collectibles — OpenPay Pro" },
      {
        name: "description",
        content: "View your NFT collectibles and browse the OpenPay Pro NFT marketplace.",
      },
      { property: "og:title", content: "Collectibles — OpenPay Pro" },
      {
        property: "og:description",
        content: "Your NFT collectibles and the OpenPay Pro NFT marketplace.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "NFT collectibles on OpenPay Pro",
          description: "NFT collectibles and marketplace listings in the OpenPay Pro wallet.",
        }),
      },
    ],
  }),
  component: NFTPage,
});

type Tab = "collectibles" | "marketplace";

function NFTPage() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<Tab>("collectibles");
  const [q, setQ] = useState("");
  const [linksOpen, setLinksOpen] = useState(false);

  const statsQuery = useQuery<OpenNftMarketplaceStats>({
    queryKey: ["openpay-nft-stats", "v1"],
    staleTime: 15_000,
    enabled: tab === "marketplace",
    queryFn: () => fetchOpenNftStats(),
  });

  const collectionsQuery = useQuery<OpenNftMarketplaceCollection[]>({
    queryKey: ["openpay-nft-collections", "v5"],
    staleTime: 60_000,
    retry: 1,
    enabled: tab === "marketplace",
    queryFn: () => fetchOpenNftCollections({ limit: 12 }),
  });

  const activityQuery = useQuery<OpenNftMarketplaceItem[]>({
    queryKey: ["openpay-nft-activity-mints", "v2"],
    staleTime: 60_000,
    retry: 1,
    enabled: tab === "marketplace",
    queryFn: () => fetchOpenNftActivity("mints", { limit: 12 }),
  });

  const stats = statsQuery.data;
  const collections = collectionsQuery.data ?? [];
  const marketItems = activityQuery.data ?? [];

  const filteredMarket = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return marketItems;
    return marketItems.filter((n) => {
      const name = (n.name || "").toLowerCase();
      const handle = (n.store?.handle || "").toLowerCase();
      return name.includes(s) || handle.includes(s);
    });
  }, [marketItems, q]);

  const filteredCollections = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return collections;
    return collections.filter((c) => {
      const name = (c.name || "").toLowerCase();
      return name.includes(s) || (c.description || "").toLowerCase().includes(s);
    });
  }, [collections, q]);

  return (
    <div className="ot-phantom ph-page space-y-4 pb-10 md:max-w-3xl">
      <PageHeader
        title="Collectibles"
        backTo="/dashboard"
        right={
          <div className="relative flex items-center gap-1">
            <Button
              asChild
              size="icon"
              className="h-9 w-9 rounded-full bg-primary text-primary-foreground"
            >
              <Link to="/nfts/mint" aria-label="Mint OpenNFT">
                <Plus className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full text-muted-foreground"
              aria-label="More"
              onClick={() => setLinksOpen((v) => !v)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {linksOpen ? (
              <div className="absolute right-0 top-11 z-20 min-w-44 overflow-hidden rounded-2xl bg-card py-1 shadow-lg ring-1 ring-border/60">
                <a
                  href={OPENPAY_NFT_MARKET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/60"
                  onClick={() => setLinksOpen(false)}
                >
                  Marketplace <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-50" />
                </a>
                <a
                  href={OPENPAY_PRO_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/60"
                  onClick={() => setLinksOpen(false)}
                >
                  Pro store <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-50" />
                </a>
                <a
                  href={OPENPAY_NFT_API_DOCS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/60"
                  onClick={() => setLinksOpen(false)}
                >
                  API docs <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-50" />
                </a>
              </div>
            ) : null}
          </div>
        }
      />

      <NftSearchBar
        value={q}
        onChange={setQ}
        placeholder={tab === "collectibles" ? "Search collectibles" : "Search marketplace"}
      />

      {/* Phantom segmented control */}
      <div className="flex rounded-full bg-muted/70 p-1">
        {(
          [
            { id: "collectibles", label: "Collectibles" },
            { id: "marketplace", label: "Marketplace" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-semibold press",
              tab === t.id
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "collectibles" ? (
        <OpenNftCollectiblesPanel userId={user.id} limit={48} search={q} />
      ) : (
        <div className="space-y-6">
          {/* Compact live strip — not boxy cards */}
          {statsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading market…
            </div>
          ) : stats ? (
            <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <LiveChip label="Collections" value={formatNumber(stats.collections, 0)} />
              <LiveChip label="Items" value={formatNumber(stats.active_items, 0)} />
              <LiveChip label="Listings" value={formatNumber(stats.active_listings, 0)} />
              <LiveChip
                label="Volume"
                value={`${formatNumber(stats.total_volume_ousd, 0)} OUSD`}
              />
            </div>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-sm font-semibold">Collections</h2>
              <a
                href={stats?.marketplace_url || OPENPAY_NFT_MARKET_URL}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-primary"
              >
                See all
              </a>
            </div>
            {collectionsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : filteredCollections.length === 0 ? (
              <EmptyMarket
                title="No collections"
                href={OPENPAY_NFT_MARKET_URL}
              />
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {filteredCollections.map((c) => (
                  <PhantomNftTile
                    key={c.id}
                    href={c.permalink || OPENPAY_NFT_MARKET_URL}
                    imageUrl={c.cover_url}
                    title={c.name}
                    subtitle={
                      c.floor_price != null
                        ? `Floor ${formatNumber(c.floor_price, 2)} OUSD`
                        : "Collection"
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-sm font-semibold">Recent mints</h2>
              <Link to="/nfts/mint" className="text-xs font-semibold text-primary">
                Mint
              </Link>
            </div>
            {activityQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : filteredMarket.length === 0 ? (
              <EmptyMarket title="No recent mints" href={OPENPAY_NFT_MARKET_URL} />
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                {filteredMarket.map((n) => (
                  <PhantomNftTile
                    key={n.id}
                    href={n.permalink || `${OPENPAY_NFT_MARKET_URL}/${n.id}`}
                    imageUrl={openNftImageSrc(n)}
                    title={n.name || "OpenNFT"}
                    subtitle={
                      n.price != null
                        ? `${formatNumber(n.price, 2)} ${n.currency || "OUSD"}`
                        : n.store?.handle
                          ? `@${n.store.handle}`
                          : "Mint"
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function LiveChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="shrink-0 rounded-2xl bg-muted/60 px-3.5 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function EmptyMarket({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl bg-muted/40 px-4 py-10 text-center">
      <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
      <p className="text-sm font-medium">{title}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-semibold text-primary"
      >
        Open marketplace
      </a>
    </div>
  );
}
