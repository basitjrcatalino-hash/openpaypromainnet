import { ExternalLink, Image as ImageIcon, Loader2, Link2 } from "lucide-react";
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
          // Prefer a non-empty result; otherwise keep trying UUID fallbacks
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

function CollectibleCard({ c }: { c: OpenNftCollectible }) {
  const img = openNftImageSrc(c.item);
  const href = c.item.permalink || `${OPENPAY_NFT_MARKET_URL}/${c.item.id}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group overflow-hidden rounded-xl border border-border/60 bg-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {img ? (
          <img
            src={img}
            alt={c.item.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        {c.quantity > 1 && (
          <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold tabular-nums shadow">
            ×{c.quantity}
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-2.5">
        <div className="truncate text-xs font-semibold">{c.item.name}</div>
        {c.item.store?.handle && (
          <div className="truncate text-[10px] text-muted-foreground">@{c.item.store.handle}</div>
        )}
        <div className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
          View on OpenPay <ExternalLink className="h-2.5 w-2.5" />
        </div>
      </div>
    </a>
  );
}

export function OpenNftCollectiblesPanel({
  userId,
  limit = 12,
  compact = false,
  className,
}: {
  userId: string;
  limit?: number;
  compact?: boolean;
  className?: string;
}) {
  const { linked, handle, collectibles, loading, error, linkLoading } = useOpenPayCollectibles(
    userId,
    limit,
  );

  if (linkLoading || loading) {
    return (
      <div className={cn("flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading OpenNFTs…
      </div>
    );
  }

  if (!linked) {
    return (
      <div className={cn("flex flex-col items-center gap-3 py-6 text-center", className)}>
        <div className="text-base font-semibold">Connect OpenPay for collectibles</div>
        <p className="max-w-70 text-sm text-muted-foreground">
          Link your OpenPay account to show OpenNFTs you own.
        </p>
        <Button asChild className="rounded-full bg-primary text-primary-foreground">
          <Link to="/settings">
            <Link2 className="mr-1.5 h-3.5 w-3.5" /> Connect OpenPay
          </Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center gap-2 py-6 text-center", className)}>
        <div className="text-sm font-semibold">Couldn’t load OpenNFTs</div>
        <p className="max-w-70 text-xs text-muted-foreground">{error.message}</p>
        <a
          href={OPENPAY_NFT_MARKET_URL}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-primary hover:underline"
        >
          Open OpenPay NFT marketplace
        </a>
      </div>
    );
  }

  if (collectibles.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-3 py-6 text-center", className)}>
        <div className="text-base font-semibold">No OpenNFTs yet</div>
        <p className="max-w-70 text-sm text-muted-foreground">
          Collectibles for @{handle} will appear here once you own OpenNFTs.
        </p>
        <a
          href={OPENPAY_NFT_MARKET_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Browse OpenPay NFTs
        </a>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          OpenNFTs for <span className="font-semibold text-foreground">@{handle}</span>
        </p>
      )}
      <div
        className={cn(
          "grid gap-3",
          compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
        )}
      >
        {collectibles.map((c) => (
          <CollectibleCard key={`${c.item.id}-${c.quantity}`} c={c} />
        ))}
      </div>
    </div>
  );
}
