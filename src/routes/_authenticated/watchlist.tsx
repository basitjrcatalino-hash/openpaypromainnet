import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/wallet/PageHeader";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";
import { formatTokenPrice, useCurrency } from "@/lib/currency";
import { MAJOR_TOKENS, fetchMajorMarkets, majorMarketById } from "@/lib/major-tokens";
import { OUSD_LOGO_URL, PI_NETWORK_LOGO_URL } from "@/lib/token-logos";
import {
  majorWatchKey,
  ousdWatchKey,
  parseWatchKey,
  tokenWatchKey,
  useWatchlist,
} from "@/lib/watchlist";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({ meta: [{ title: "Watchlist — OpenPay Pro" }] }),
  component: WatchlistPage,
});

type Row = {
  key: string;
  name: string;
  symbol: string;
  priceUsd: number;
  change24h: number;
  logoUrl: string | null;
  href: string;
};

function WatchlistPage() {
  const { user } = Route.useRouteContext();
  const { code: currency } = useCurrency();
  const watch = useWatchlist(user.id);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data: majorMarkets } = useQuery({
    queryKey: ["major-markets-watch"],
    queryFn: () => fetchMajorMarkets(),
    staleTime: 60_000,
  });

  const tokenIds = useMemo(
    () =>
      watch.items
        .map((i) => parseWatchKey(i.asset_key))
        .filter((p) => p.kind === "token" && p.id)
        .map((p) => p.id!),
    [watch.items],
  );

  const { data: tokens = [] } = useQuery({
    queryKey: ["watchlist-tokens", tokenIds.join(",")],
    enabled: tokenIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("id, name, symbol, price_usd, change_24h, logo_url")
        .in("id", tokenIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const item of watch.items) {
      const parsed = parseWatchKey(item.asset_key);
      if (parsed.kind === "ousd") {
        out.push({
          key: ousdWatchKey(),
          name: "OpenPay USD",
          symbol: "OUSD",
          priceUsd: 1,
          change24h: 0,
          logoUrl: OUSD_LOGO_URL,
          href: "/ousd",
        });
        continue;
      }
      if (parsed.kind === "major" && parsed.id) {
        const def = MAJOR_TOKENS[parsed.id as keyof typeof MAJOR_TOKENS];
        if (!def) continue;
        const m = majorMarketById(majorMarkets, parsed.id as never);
        out.push({
          key: majorWatchKey(parsed.id),
          name: def.name,
          symbol: def.symbol,
          priceUsd: m?.price ?? 0,
          change24h: m?.change24h ?? 0,
          logoUrl: parsed.id === "pi" ? PI_NETWORK_LOGO_URL : def.logoUrl,
          href: `/asset/${parsed.id}`,
        });
        continue;
      }
      if (parsed.kind === "token" && parsed.id) {
        const t = tokens.find((x) => x.id === parsed.id);
        if (!t) continue;
        out.push({
          key: tokenWatchKey(t.id),
          name: t.name,
          symbol: t.symbol,
          priceUsd: Number(t.price_usd ?? 0),
          change24h: Number(t.change_24h ?? 0),
          logoUrl: t.logo_url,
          href: `/opentoken/${t.id}`,
        });
      }
    }
    return out;
  }, [watch.items, tokens, majorMarkets]);

  async function onToggle(key: string) {
    setBusyKey(key);
    try {
      const next = await watch.toggleWatch(key);
      toast.success(next ? "Added to watchlist" : "Removed from watchlist");
    } catch (e) {
      toast.error((e as Error).message || "Could not update watchlist");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="ot-phantom ph-page space-y-4 pb-10">
      <PageHeader title="Watchlist" backTo="/dashboard" />
      <p className="px-1 text-sm text-muted-foreground">
        Tokens you star across OpenPay Pro. Tap a row to open the asset.
      </p>

      {watch.loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border px-6 py-14 text-center">
          <Star className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-semibold text-foreground">No watched tokens yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Star assets from a token page or the dashboard to track them here.
          </p>
          <Link
            to="/tokens"
            className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Browse tokens
          </Link>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-border bg-card divide-y divide-border">
          {rows.map((r) => {
            const parsed = parseWatchKey(r.key);
            return (
            <li key={r.key}>
              <div className="flex items-center gap-3 px-4 py-3">
                {parsed.kind === "ousd" ? (
                  <Link
                    to="/asset/$tokenId"
                    params={{ tokenId: "ousd" }}
                    search={{}}
                    className="flex min-w-0 flex-1 items-center gap-3 press"
                  >
                    <WatchRowInner r={r} currency={currency} />
                  </Link>
                ) : parsed.kind === "major" && parsed.id ? (
                  <Link
                    to="/asset/$tokenId"
                    params={{ tokenId: parsed.id }}
                    search={{}}
                    className="flex min-w-0 flex-1 items-center gap-3 press"
                  >
                    <WatchRowInner r={r} currency={currency} />
                  </Link>
                ) : (
                  <Link
                    to="/opentoken/$tokenId"
                    params={{ tokenId: parsed.id! }}
                    className="flex min-w-0 flex-1 items-center gap-3 press"
                  >
                    <WatchRowInner r={r} currency={currency} />
                  </Link>
                )}
                <button
                  type="button"
                  disabled={busyKey === r.key}
                  onClick={() => void onToggle(r.key)}
                  className="grid h-10 w-10 place-items-center rounded-full text-amber-400 hover:bg-muted press"
                  aria-label="Remove from watchlist"
                >
                  {busyKey === r.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Star className="h-4 w-4 fill-amber-400" />
                  )}
                </button>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function WatchRowInner({
  r,
  currency,
}: {
  r: Row;
  currency: string;
}) {
  return (
    <>
      {r.logoUrl ? (
        <img src={r.logoUrl} alt="" className="h-10 w-10 rounded-full bg-muted object-cover" />
      ) : (
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {r.symbol.slice(0, 2)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{r.symbol}</div>
        <div className="truncate text-xs text-muted-foreground">{r.name}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold tabular-nums">
          {formatTokenPrice(r.priceUsd, currency)}
        </div>
        <div
          className={cn(
            "text-xs font-medium tabular-nums",
            r.change24h >= 0 ? "text-emerald-500" : "text-red-400",
          )}
        >
          {r.change24h >= 0 ? "+" : ""}
          {formatNumber(r.change24h, 2)}%
        </div>
      </div>
    </>
  );
}
