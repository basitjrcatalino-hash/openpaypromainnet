import { Link } from "@tanstack/react-router";
import { Star, BadgeCheck, Radio } from "lucide-react";
import { formatNumber, formatUSD, timeAgo } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";
import { curveFromTokenRow, curveProgress, OT_CATEGORY_LABELS, type OtCategory } from "@/lib/opentoken/bonding-curve";
import { GraduationBadge } from "./GraduationBadge";

export type OtTokenCardData = {
  id: string;
  name: string;
  symbol: string;
  logo_url?: string | null;
  description?: string | null;
  market_cap?: number | null;
  volume_24h?: number | null;
  change_24h?: number | null;
  price_usd?: number | null;
  category?: string | null;
  status?: string | null;
  is_featured?: boolean | null;
  is_verified?: boolean | null;
  created_at?: string | null;
  curve_reserve_pi?: number | null;
  graduation_target_pi?: number | null;
  curve_virtual_pi?: number | null;
  curve_virtual_tokens?: number | null;
  curve_supply_sold?: number | null;
  total_supply?: number | null;
  holder_count?: number | null;
};

export function TokenCard({ token, compact }: { token: OtTokenCardData; compact?: boolean }) {
  const curve = curveFromTokenRow(token);
  const progress = curveProgress(curve);
  const change = Number(token.change_24h ?? 0);
  const cat = (token.category as OtCategory) || "meme";

  return (
    <Link
      to="/opentoken/$tokenId"
      params={{ tokenId: token.id }}
      className={cn(
        "group block overflow-hidden rounded-2xl border border-border/60 bg-card/70 transition hover:border-primary/40 hover:bg-card",
        compact ? "p-3" : "p-0",
      )}
    >
      {!compact && (
        <div className="relative aspect-square overflow-hidden bg-muted/40">
          {token.logo_url ? (
            <img src={token.logo_url} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
          ) : (
            <div className="grid h-full place-items-center bg-gradient-primary text-3xl font-bold text-primary-foreground">
              {token.symbol.slice(0, 3)}
            </div>
          )}
          <div className="absolute left-2 top-2 flex gap-1">
            {token.status === "graduated" && <GraduationBadge size="sm" />}
            {token.status === "curve" && progress > 0.05 && (
              <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                {(progress * 100).toFixed(0)}%
              </span>
            )}
          </div>
          {token.is_featured && (
            <span className="absolute right-2 top-2 rounded-full bg-warning/90 p-1 text-warning-foreground">
              <Star className="h-3 w-3 fill-current" />
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-3 pb-2 pt-8">
            <div className="text-xs font-semibold text-white/90">{formatUSD(token.market_cap, { compact: true })} MC</div>
          </div>
        </div>
      )}
      <div className={cn(compact ? "" : "p-3")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1 truncate text-sm font-semibold">
              {token.name}
              {token.is_verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </div>
            <div className="text-xs text-muted-foreground">${token.symbol}</div>
          </div>
          {!compact && (
            <div className={cn("text-xs font-medium tabular-nums", change >= 0 ? "text-success" : "text-destructive")}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}%
            </div>
          )}
        </div>
        {!compact && token.description && (
          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{token.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span className="rounded-full border border-border/60 px-1.5 py-0.5">{OT_CATEGORY_LABELS[cat] ?? cat}</span>
          <span>{formatUSD(token.volume_24h, { compact: true })} vol</span>
          {token.created_at && <span>{timeAgo(token.created_at)}</span>}
          {token.status === "curve" && (
            <span className="inline-flex items-center gap-0.5 text-primary">
              <Radio className="h-2.5 w-2.5" /> live
            </span>
          )}
        </div>
        {compact && (
          <div className="mt-1 text-xs tabular-nums text-muted-foreground">
            {formatUSD(token.market_cap, { compact: true })} · {formatNumber(token.price_usd, 6)}
          </div>
        )}
      </div>
    </Link>
  );
}
