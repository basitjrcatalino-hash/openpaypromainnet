import { useMemo } from "react";
import { ExternalLink, Image as ImageIcon, Loader2, Link2, Plus, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getOpenPayLinkStatus } from "@/lib/openpay-pro.functions";
import {
  fetchOpenNftCollectibles,
  openNftImageSrc,
  OPENPAY_NFT_MARKET_URL,
  type OpenNftCollectible,
  type OpenNftItem,
} from "@/lib/openpay-nft";

function resolveOpenPayCandidates(link: {
  linked?: boolean;
  username?: string;
  openpayUserId?: string;
  identifier?: string;
  account_number?: string;
} | null | undefined): string[] {
  if (!link?.linked) return [];
  const raw = [link.username, link.openpayUserId, link.identifier, link.account_number]
    .filter(Boolean)
    .map((s) => String(s).replace(/^@+/, "").trim())
    .filter(Boolean);
  return [...new Set(raw)];
}

export function useOpenPayCollectibles(userId: string, limit = 50) {
  const getLink = useServerFn(getOpenPayLinkStatus);
  const linkQuery = useQuery({
    queryKey: ["openpay-link", userId],
    queryFn: () => getLink(),
  });
  const candidates = resolveOpenPayCandidates(linkQuery.data);
  const handle = candidates[0] ?? null;

  const collectiblesQuery = useQuery({
    queryKey: ["openpay-collectibles", candidates.join("|"), limit],
    enabled: candidates.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      let lastErr: Error | null = null;
      for (const key of candidates) {
        try {
          const res = await fetchOpenNftCollectibles(key, { limit });
          if (res.collectibles.length > 0 || key === candidates[candidates.length - 1]) {
            return { ...res, resolvedAs: key };
          }
        } catch (e) {
          lastErr = e as Error;
        }
      }
      if (lastErr) throw lastErr;
      return {
        owner: handle ?? "",
        collectibles: [],
        source: "collectibles" as const,
        resolvedAs: handle ?? "",
      };
    },
  });

  return {
    link: linkQuery.data,
    handle: collectiblesQuery.data?.resolvedAs || handle,
    linked: candidates.length > 0,
    linkLoading: linkQuery.isLoading,
    collectibles: collectiblesQuery.data?.collectibles ?? [],
    loading: linkQuery.isLoading || (candidates.length > 0 && collectiblesQuery.isLoading),
    error: collectiblesQuery.error as Error | null,
    refetch: collectiblesQuery.refetch,
    source: collectiblesQuery.data?.source,
  };
}

/** Phantom-style NFT tile — image-first, minimal caption */
export function PhantomNftTile({
  href,
  imageUrl,
  title,
  subtitle,
  badge,
  className,
}: {
  href: string;
  imageUrl?: string | null;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group block overflow-hidden rounded-2xl bg-muted/40 press transition hover:opacity-95",
        className,
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <ImageIcon className="h-7 w-7 opacity-50" />
          </div>
        )}
        {badge ? (
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white backdrop-blur">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="space-y-0.5 px-2.5 py-2">
        <div className="truncate text-[13px] font-semibold leading-tight text-foreground">
          {title}
        </div>
        {subtitle ? (
          <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
    </a>
  );
}

function CollectibleCard({ c }: { c: OpenNftCollectible }) {
  const img = openNftImageSrc(c.item);
  const href = c.item.permalink || `${OPENPAY_NFT_MARKET_URL}/${c.item.id}`;
  const title = c.item.name || `#${c.item.id.slice(0, 6)}`;
  const subtitle = c.item.store?.handle ? `@${c.item.store.handle}` : null;
  return (
    <PhantomNftTile
      href={href}
      imageUrl={img}
      title={title}
      subtitle={subtitle}
      badge={c.quantity > 1 ? `×${c.quantity}` : null}
    />
  );
}

export function OpenNftCollectiblesPanel({
  userId,
  limit = 12,
  compact = false,
  className,
  search = "",
}: {
  userId: string;
  limit?: number;
  compact?: boolean;
  className?: string;
  /** Optional client filter (name / handle) */
  search?: string;
}) {
  const { linked, handle, collectibles, loading, error, linkLoading } = useOpenPayCollectibles(
    userId,
    limit,
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return collectibles;
    return collectibles.filter((c) => {
      const name = (c.item.name || "").toLowerCase();
      const handleStr = (c.item.store?.handle || "").toLowerCase();
      return name.includes(q) || handleStr.includes(q) || c.item.id.toLowerCase().includes(q);
    });
  }, [collectibles, search]);

  if (linkLoading || loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading collectibles…
      </div>
    );
  }

  if (!linked) {
    return (
      <div className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}>
        <div className="grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
          <ImageIcon className="h-7 w-7" />
        </div>
        <div className="text-base font-semibold">No collectibles yet</div>
        <p className="max-w-xs text-sm text-muted-foreground">
          Connect OpenPay to show OpenNFTs you own — Phantom-style gallery.
        </p>
        <Button asChild className="mt-1 h-11 rounded-full px-6 font-semibold">
          <Link to="/settings">
            <Link2 className="mr-1.5 h-3.5 w-3.5" /> Connect OpenPay
          </Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center gap-2 py-10 text-center", className)}>
        <div className="text-sm font-semibold">Couldn’t load collectibles</div>
        <p className="max-w-xs text-xs text-muted-foreground">{error.message}</p>
        <a
          href={OPENPAY_NFT_MARKET_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary"
        >
          Open marketplace <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  if (collectibles.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}>
        <div className="grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
          <ImageIcon className="h-7 w-7" />
        </div>
        <div className="text-base font-semibold">No NFTs yet</div>
        <p className="max-w-xs text-sm text-muted-foreground">
          {handle ? `@${handle} doesn’t own OpenNFTs yet.` : "Collectibles will show up here."}
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <Button asChild className="h-11 rounded-full px-5 font-semibold">
            <Link to="/nfts/mint">
              <Plus className="mr-1.5 h-4 w-4" /> Mint
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-11 rounded-full px-5 font-semibold">
            <a href={OPENPAY_NFT_MARKET_URL} target="_blank" rel="noreferrer">
              Browse
            </a>
          </Button>
        </div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <p className={cn("py-10 text-center text-sm text-muted-foreground", className)}>
        No collectibles match “{search.trim()}”
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {!compact && handle ? (
        <p className="px-0.5 text-xs text-muted-foreground">
          {filtered.length} collectible{filtered.length === 1 ? "" : "s"} · @{handle}
        </p>
      ) : null}
      <div
        className={cn(
          "grid gap-2.5",
          compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
        )}
      >
        {filtered.map((c) => (
          <CollectibleCard key={`${c.item.id}-${c.quantity}`} c={c} />
        ))}
      </div>
    </div>
  );
}

/** Search field styled like Phantom collectibles */
export function NftSearchBar({
  value,
  onChange,
  placeholder = "Search collectibles",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-full border-0 bg-muted/70 py-2 pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:bg-muted"
      />
    </div>
  );
}

export function marketplaceItemToTile(n: OpenNftItem & { activity_type?: string | null; price?: number | null; currency?: string | null; permalink?: string | null }) {
  return {
    href: n.permalink || `${OPENPAY_NFT_MARKET_URL}/${n.id}`,
    imageUrl: openNftImageSrc(n),
    title: n.name || "OpenNFT",
    subtitle: n.store?.handle
      ? `@${n.store.handle}`
      : n.activity_type
        ? String(n.activity_type)
        : null,
  };
}
