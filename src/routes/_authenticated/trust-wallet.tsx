import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/wallet/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNumber, formatUSD } from "@/lib/wallet-utils";
import {
  twListings,
  twSearch,
  twStatus,
  twValidate,
  twRiskLabel,
  type TwListingDoc,
  type TwSearchDoc,
} from "@/lib/trustwallet-client";
import { trustWalletAssetDeepLink } from "@/lib/trustwallet-deeplinks";

export const Route = createFileRoute("/_authenticated/trust-wallet")({
  head: () => ({
    meta: [
      { title: "Trust Wallet — OpenPay Pro" },
      {
        name: "description",
        content:
          "Trust Wallet market data, token search, and address safety inside OpenPay Pro.",
      },
    ],
  }),
  component: TrustWalletHubPage,
});

type Tab = "trending" | "search" | "safety";

const CATEGORIES = [
  { id: "trending", label: "Trending" },
  { id: "memes", label: "Memes" },
  { id: "ai", label: "AI" },
  { id: "layer_1", label: "L1" },
  { id: "defi-2", label: "DeFi" },
  { id: "solana-ecosystem", label: "Solana" },
] as const;

function TrustWalletHubPage() {
  const [tab, setTab] = useState<Tab>("trending");
  const [category, setCategory] = useState<string>("trending");
  const [q, setQ] = useState("");
  const [addr, setAddr] = useState("");
  const [checkAddr, setCheckAddr] = useState("");

  const { data: status } = useQuery({
    queryKey: ["tw-status"],
    staleTime: 60_000,
    queryFn: twStatus,
  });

  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["tw-listings", category],
    enabled: tab === "trending" && !!status?.configured,
    staleTime: 60_000,
    queryFn: () => twListings({ category_id: category, limit: 40 }),
  });

  const debouncedQ = useDebounced(q, 400);
  const { data: searchDocs = [], isFetching: searching } = useQuery({
    queryKey: ["tw-search", debouncedQ],
    enabled: tab === "search" && debouncedQ.trim().length >= 2 && !!status?.configured,
    staleTime: 30_000,
    queryFn: () => twSearch(debouncedQ, { limit: 25 }),
  });

  const { data: risk, isFetching: validating } = useQuery({
    queryKey: ["tw-validate", checkAddr],
    enabled: tab === "safety" && checkAddr.length >= 8 && !!status?.configured,
    staleTime: 30_000,
    queryFn: () => twValidate(checkAddr),
  });

  return (
    <div className="ot-phantom mx-auto max-w-lg animate-page-in space-y-4 pb-28 pt-1">
      <PageHeader title="Trust Wallet" backTo="/tokens" />

      <div className="rounded-3xl bg-card p-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          Trust Wallet data
          <span
            className={cn(
              "ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
              status?.configured
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/15 text-amber-600",
            )}
          >
            {status?.configured ? "Live" : "Not configured"}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Market prices, trending tokens, search, and address checks from{" "}
          <span className="font-semibold text-foreground">tws.trustwallet.com</span>.
          Buys and swaps still settle on your OpenPay Pro ledger.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="https://trustwallet.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
          >
            Open Trust Wallet
            <ExternalLink className="h-3 w-3" />
          </a>
          <Link to="/tokens" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Browse Tokens
          </Link>
          <Link to="/swap" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            OpenDEX Swap
          </Link>
        </div>
      </div>

      <div className="flex gap-1 rounded-full bg-muted/60 p-1">
        {(
          [
            { id: "trending" as const, label: "Trending", icon: TrendingUp },
            { id: "search" as const, label: "Search", icon: Search },
            { id: "safety" as const, label: "Safety", icon: ShieldCheck },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-full py-2 text-sm font-semibold press",
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {!status?.configured && (
        <p className="rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          Set TW_ACCESS_ID and TW_HMAC_SECRET on the server to enable live data.
        </p>
      )}

      {tab === "trending" && (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold press",
                  category === c.id
                    ? "bg-foreground text-background"
                    : "bg-muted/70 text-muted-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <ul className="overflow-hidden rounded-3xl bg-card">
            {listingsLoading ? (
              <li className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading Trust Wallet markets…
              </li>
            ) : listings.length === 0 ? (
              <li className="py-12 text-center text-sm text-muted-foreground">
                No listings right now
              </li>
            ) : (
              listings.map((doc, i) => <ListingRow key={doc.asset?.asset_id ?? i} doc={doc} />)
            )}
          </ul>
        </>
      )}

      {tab === "search" && (
        <>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, symbol, or contract…"
            className="h-12 rounded-2xl"
            autoFocus
          />
          <ul className="overflow-hidden rounded-3xl bg-card">
            {searching ? (
              <li className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </li>
            ) : debouncedQ.trim().length < 2 ? (
              <li className="py-10 text-center text-sm text-muted-foreground">
                Type at least 2 characters
              </li>
            ) : searchDocs.length === 0 ? (
              <li className="py-10 text-center text-sm text-muted-foreground">No results</li>
            ) : (
              searchDocs.map((doc, i) => <SearchRow key={doc.asset_id ?? i} doc={doc} />)
            )}
          </ul>
        </>
      )}

      {tab === "safety" && (
        <div className="space-y-3">
          <Input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="Paste wallet address to check…"
            className="h-12 rounded-2xl font-mono text-sm"
          />
          <Button
            className="h-12 w-full rounded-full"
            disabled={addr.trim().length < 8 || validating}
            onClick={() => setCheckAddr(addr.trim())}
          >
            {validating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Check with Trust Wallet
          </Button>
          {risk && !risk.error && (
            <RiskCard risk={risk} address={checkAddr} />
          )}
          {risk?.error && (
            <p className="text-xs text-destructive">{risk.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ListingRow({ doc }: { doc: TwListingDoc }) {
  const asset = doc.asset;
  const price = Number(doc.price?.price ?? 0);
  const change = Number(
    doc.price?.percent_change_24h ?? doc.price?.change_24h ?? 0,
  );
  const up = change >= 0;
  const assetId = asset?.asset_id;
  return (
    <li className="flex items-center gap-3 border-b border-border/40 px-4 py-3 last:border-0">
      {asset?.icon_url ? (
        <img src={asset.icon_url} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-xs font-bold">
          {(asset?.symbol ?? "?").slice(0, 2)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">
          {asset?.name ?? "Token"}{" "}
          <span className="text-muted-foreground">{asset?.symbol}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {asset?.is_verified ? "Verified · " : ""}
          {assetId}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold">
          {price > 0 ? formatUSD(price) : "—"}
        </div>
        <div
          className={cn(
            "text-[11px] font-semibold",
            up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
          )}
        >
          {change ? `${up ? "+" : ""}${formatNumber(change, 2)}%` : "—"}
        </div>
      </div>
      {assetId && (
        <a
          href={trustWalletAssetDeepLink(assetId)}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted/80 text-muted-foreground press hover:text-foreground"
          aria-label="Open in Trust Wallet"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </li>
  );
}

function SearchRow({ doc }: { doc: TwSearchDoc }) {
  return (
    <li className="flex items-center gap-3 border-b border-border/40 px-4 py-3 last:border-0">
      {doc.icon_url ? (
        <img src={doc.icon_url} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-xs font-bold">
          {(doc.symbol ?? "?").slice(0, 2)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">
          {doc.name} <span className="text-muted-foreground">{doc.symbol}</span>
        </div>
        <div className="truncate text-[11px] text-muted-foreground">{doc.asset_id}</div>
      </div>
      <div className="text-right text-sm font-semibold">
        {doc.price ? formatUSD(doc.price) : "—"}
      </div>
      {doc.asset_id && (
        <a
          href={trustWalletAssetDeepLink(doc.asset_id)}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted/80"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </li>
  );
}

function RiskCard({
  risk,
  address,
}: {
  risk: NonNullable<Awaited<ReturnType<typeof twValidate>>>;
  address: string;
}) {
  const meta = twRiskLabel(risk.result);
  return (
    <div
      className={cn(
        "rounded-3xl border p-4",
        meta.tone === "ok" && "border-emerald-500/30 bg-emerald-500/10",
        meta.tone === "bad" && "border-destructive/40 bg-destructive/10",
        meta.tone === "warn" && "border-amber-500/40 bg-amber-500/10",
        meta.tone === "neutral" && "border-border bg-card",
      )}
    >
      <div className="mb-1 text-sm font-bold">{meta.label}</div>
      <div className="break-all font-mono text-[11px] text-muted-foreground">{address}</div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Valid</dt>
          <dd className="font-semibold">{risk.valid ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Risk score</dt>
          <dd className="font-semibold">{risk.details?.risk_score ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Contract</dt>
          <dd className="font-semibold">{risk.details?.is_contract ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sanctioned</dt>
          <dd className="font-semibold">{risk.details?.is_sanctioned ? "Yes" : "No"}</dd>
        </div>
      </dl>
    </div>
  );
}

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
