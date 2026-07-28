import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Image as ImageIcon,
  Sparkles,
  TrendingUp,
  ExternalLink,
  Loader2,
  BookOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/wallet-utils";
import { OpenNftCollectiblesPanel } from "@/components/open-nft-collectibles";
import {
  OPENPAY_NFT_MARKET_URL,
  OPENPAY_PRO_STORE_URL,
  OPENPAY_NFT_API_DOCS_URL,
  openNftImageSrc,
  openNftItemUrl,
  fetchOpenNftStats,
  fetchOpenNftActivity,
  fetchOpenNftCollections,
  type OpenNftMarketplaceCollection,
  type OpenNftMarketplaceItem,
  type OpenNftMarketplaceStats,
} from "@/lib/openpay-nft";

export const Route = createFileRoute("/_authenticated/nfts")({
  head: () => ({ meta: [{ title: "OpenNFT — OpenPay Pro Wallet" }] }),
  component: NFTPage,
});

function NFTPage() {
  const { user } = Route.useRouteContext();

  // Docs: https://openpy.space/web3/nft/api — /stats is lightweight; activity for trending
  const statsQuery = useQuery<OpenNftMarketplaceStats>({
    queryKey: ["openpay-nft-stats", "v1"],
    staleTime: 15_000,
    queryFn: () => fetchOpenNftStats(),
  });

  const collectionsQuery = useQuery<OpenNftMarketplaceCollection[]>({
    queryKey: ["openpay-nft-collections", "v4"],
    staleTime: 60_000,
    retry: 1,
    queryFn: () => fetchOpenNftCollections({ limit: 1 }),
  });

  const activityQuery = useQuery<OpenNftMarketplaceItem[]>({
    queryKey: ["openpay-nft-activity-mints", "v1"],
    staleTime: 60_000,
    retry: 1,
    queryFn: () => fetchOpenNftActivity("mints", { limit: 1 }),
  });

  const stats = statsQuery.data;
  const collections: OpenNftMarketplaceCollection[] = collectionsQuery.data ?? [];
  const marketItems: OpenNftMarketplaceItem[] = activityQuery.data ?? [];
  const collectionsLoading = collectionsQuery.isLoading;
  const itemsLoading = activityQuery.isLoading;
  const collectionsError = collectionsQuery.error;
  const itemsError = activityQuery.error;

  return (
    <div className="ph-page space-y-6 md:max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collectibles</h1>
          <p className="text-sm text-muted-foreground">
            OpenNFT marketplace ·{" "}
            <a
              href={OPENPAY_NFT_API_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              API v1.0
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <a href={OPENPAY_NFT_API_DOCS_URL} target="_blank" rel="noreferrer">
              <BookOpen className="mr-1.5 h-4 w-4" /> API docs
            </a>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <a href={OPENPAY_PRO_STORE_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-4 w-4" /> Pro store
            </a>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <a href={OPENPAY_NFT_MARKET_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-4 w-4" /> openpy.space
            </a>
          </Button>
          <Button
            asChild
            className="rounded-full bg-primary text-primary-foreground"
          >
            <Link to="/nfts/mint">
              <Plus className="mr-1.5 h-4 w-4" /> Mint OpenNFT
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="marketplace" className="space-y-4">
        <TabsList className="rounded-full">
          <TabsTrigger value="collectibles" className="rounded-full">
            My OpenNFTs
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="rounded-full">
            Marketplace
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collectibles" className="space-y-4">
          <Card className="rounded-2xl border-0 shadow-none p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                OpenPay Collectibles
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                From your linked OpenPay account · tap to open on openpy.space
              </p>
            </div>
            <OpenNftCollectiblesPanel userId={user.id} limit={48} />
          </Card>
        </TabsContent>

        <TabsContent value="marketplace" className="space-y-4">
          <Card className="rounded-2xl border-0 shadow-none p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Live Marketplace
              </h2>
              <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mint">
                LIVE · v1.0
              </span>
            </div>
            {statsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading /stats…
              </div>
            ) : statsQuery.error ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {(statsQuery.error as Error).message}
              </p>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                <Stat label="Collections" value={stats.collections} />
                <Stat label="Active Items" value={stats.active_items} />
                <Stat label="Recent Mints" value={stats.mints} />
                <Stat label="Recent Sales" value={stats.sales} />
                <Stat label="Listings" value={stats.active_listings} />
                <Stat
                  label="Volume OUSD"
                  value={stats.total_volume_ousd}
                  compact
                />
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" className="rounded-full bg-primary text-primary-foreground">
                <a href={stats?.marketplace_url || OPENPAY_NFT_MARKET_URL} target="_blank" rel="noreferrer">
                  Open marketplace
                </a>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <a href={`${OPENPAY_NFT_API_DOCS_URL}`} target="_blank" rel="noreferrer">
                  Try /stats · /activity
                </a>
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-0 shadow-none p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Featured Collections
              </h2>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            {collectionsLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading collections…
              </div>
            ) : collectionsError && collections.length === 0 ? (
              <div className="space-y-2 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {(collectionsError as Error).message || "Could not load collections"}
                </p>
                <a
                  href={OPENPAY_NFT_MARKET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Browse on openpy.space
                </a>
              </div>
            ) : collections.length === 0 ? (
              <div className="space-y-2 py-6 text-center">
                <p className="text-sm text-muted-foreground">No collections in preview.</p>
                <a
                  href={OPENPAY_NFT_MARKET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Open full marketplace
                </a>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {collections.map((c: OpenNftMarketplaceCollection) => (
                  <a
                    key={c.id}
                    href={c.permalink || OPENPAY_NFT_MARKET_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-2xl border border-border/60 bg-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-primary">
                      {c.cover_url ? (
                        <img
                          src={c.cover_url}
                          alt={c.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="p-4">
                      <div className="text-sm font-semibold">{c.name}</div>
                      {c.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {c.description}
                        </p>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Floor</span>
                        <span className="font-semibold">
                          {c.floor_price != null
                            ? `${formatNumber(c.floor_price, 2)} OUSD`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </Card>

          <Card className="rounded-2xl border-0 shadow-none p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Recent Mints
              </h2>
              <TrendingUp className="h-4 w-4 text-mint" />
            </div>
            {itemsLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading /activity/mints…
              </div>
            ) : itemsError && marketItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="text-sm font-semibold">Couldn’t load activity preview</div>
                <p className="max-w-sm text-xs text-muted-foreground">
                  {(itemsError as Error).message}
                </p>
                <Button
                  asChild
                  size="sm"
                  className="mt-2 rounded-full bg-primary text-primary-foreground"
                >
                  <a href={OPENPAY_NFT_MARKET_URL} target="_blank" rel="noreferrer">
                    Open openpy.space/web3/nft
                  </a>
                </Button>
              </div>
            ) : marketItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                </span>
                <div className="text-sm font-semibold">No recent mints in preview</div>
                <Button asChild size="sm" className="mt-2 rounded-full bg-primary text-primary-foreground">
                  <Link to="/nfts/mint">Mint OpenNFT</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {marketItems.map((n: OpenNftMarketplaceItem) => {
                  const img = openNftImageSrc(n);
                  const href = n.permalink || openNftItemUrl(n.id);
                  return (
                    <a
                      key={n.id}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-2xl border border-border/60 bg-card transition hover:-translate-y-0.5 hover:shadow-glow"
                    >
                      <div className="aspect-square w-full overflow-hidden bg-muted">
                        {img ? (
                          <img
                            src={img}
                            alt={n.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="grid h-full place-items-center bg-primary/80 text-primary-foreground">
                            <ImageIcon className="h-6 w-6 opacity-80" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="truncate text-sm font-semibold">{n.name}</div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {n.activity_type || "mint"}
                          </span>
                          <span className="font-semibold">
                            {n.price != null
                              ? `${formatNumber(n.price, 2)} ${n.currency || "OUSD"}`
                              : "—"}
                          </span>
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                          View on openpy.space <ExternalLink className="h-2.5 w-2.5" />
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label,
  value,
  compact,
}: {
  label: string;
  value: number;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums">
        {compact ? formatNumber(value, 0) : formatNumber(value, 0)}
      </div>
    </div>
  );
}
