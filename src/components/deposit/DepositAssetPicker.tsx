import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { logoUrlForTokenSymbol } from "@/lib/token-logos";
import { cn } from "@/lib/utils";

export type DepositTokenRow = {
  id: string;
  chain_id: string;
  symbol: string;
  name?: string | null;
  deposit_enabled?: boolean;
  status?: string;
  min_deposit?: number | string;
  max_deposit?: number | string | null;
  deposit_fee_bps?: number | string | null;
  contract_address?: string | null;
  credit_symbol?: string | null;
  sort_order?: number;
};

export type DepositAssetGroup = {
  symbol: string;
  name: string;
  logoUrl: string | null;
  tokenIds: string[];
  chainIds: string[];
};

export function groupDepositAssets(tokens: DepositTokenRow[]): DepositAssetGroup[] {
  const map = new Map<string, DepositAssetGroup>();
  for (const t of tokens) {
    const symbol = String(t.symbol || "").toUpperCase();
    if (!symbol) continue;
    const existing = map.get(symbol);
    if (existing) {
      if (!existing.tokenIds.includes(t.id)) existing.tokenIds.push(t.id);
      if (!existing.chainIds.includes(t.chain_id)) existing.chainIds.push(t.chain_id);
      continue;
    }
    map.set(symbol, {
      symbol,
      name: t.name?.trim() || symbol,
      logoUrl: logoUrlForTokenSymbol(symbol),
      tokenIds: [t.id],
      chainIds: [t.chain_id],
    });
  }
  return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function DepositAssetPicker({
  tokens,
  recentSymbols,
  onSelect,
}: {
  tokens: DepositTokenRow[];
  recentSymbols: string[];
  onSelect: (symbol: string) => void;
}) {
  const [q, setQ] = useState("");
  const assets = useMemo(() => groupDepositAssets(tokens), [tokens]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return assets;
    return assets.filter(
      (a) =>
        a.symbol.toLowerCase().includes(needle) || a.name.toLowerCase().includes(needle),
    );
  }, [assets, q]);

  const recent = useMemo(() => {
    const set = new Set(assets.map((a) => a.symbol));
    return recentSymbols
      .map((s) => s.toUpperCase())
      .filter((s, i, arr) => set.has(s) && arr.indexOf(s) === i)
      .slice(0, 8);
  }, [assets, recentSymbols]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by crypto"
          className="h-11 rounded-2xl border-border/60 bg-muted/40 pl-10"
        />
      </div>

      {recent.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent deposit
          </p>
          <div className="flex flex-wrap gap-2">
            {recent.map((symbol) => {
              const asset = assets.find((a) => a.symbol === symbol);
              return (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => onSelect(symbol)}
                  className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 text-sm font-semibold press hover:bg-muted/50"
                >
                  <AssetMark symbol={symbol} logoUrl={asset?.logoUrl} className="h-5 w-5" />
                  {symbol}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Crypto
        </p>
        {!filtered.length ? (
          <p className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No deposit tokens are enabled yet. Ask an admin to add tokens in Admin → Deposits.
          </p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/70">
            {filtered.map((asset, i) => (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => onSelect(asset.symbol)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3.5 text-left press hover:bg-muted/40",
                  i < filtered.length - 1 && "border-b border-border/50",
                )}
              >
                <AssetMark symbol={asset.symbol} logoUrl={asset.logoUrl} className="h-10 w-10" />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold tracking-tight">{asset.symbol}</span>
                  <span className="block truncate text-sm text-muted-foreground">{asset.name}</span>
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {asset.chainIds.length} net
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AssetMark({
  symbol,
  logoUrl,
  className,
}: {
  symbol: string;
  logoUrl?: string | null;
  className?: string;
}) {
  const src = logoUrl || logoUrlForTokenSymbol(symbol);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn("rounded-full bg-muted object-cover", className)}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className={cn(
        "grid place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground",
        className,
      )}
    >
      {symbol.slice(0, 3)}
    </span>
  );
}
