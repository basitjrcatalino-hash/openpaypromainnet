import { Link } from "@tanstack/react-router";
import { formatUSD } from "@/lib/wallet-utils";
import type { OtTokenCardData } from "./TokenCard";

export function TrendingRail({ tokens }: { tokens: OtTokenCardData[] }) {
  if (!tokens.length) return null;
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {tokens.map((t) => (
        <Link
          key={t.id}
          to="/opentoken/$tokenId"
          params={{ tokenId: t.id }}
          className="w-56 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-card/70 transition hover:border-primary/40"
        >
          <div className="relative h-28 bg-muted/40">
            {t.logo_url ? (
              <img src={t.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center bg-gradient-primary text-xl font-bold text-primary-foreground">
                {t.symbol.slice(0, 3)}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 to-transparent px-3 pb-2 pt-6">
              <div className="text-sm font-semibold text-white">{formatUSD(t.market_cap, { compact: true })}</div>
            </div>
          </div>
          <div className="p-3">
            <div className="truncate text-sm font-semibold">{t.name}</div>
            <div className="line-clamp-2 text-[11px] text-muted-foreground">
              {t.description || `$${t.symbol} on OpenToken`}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
