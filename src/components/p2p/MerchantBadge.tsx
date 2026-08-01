import { BadgeCheck, Sparkles, Star, Store } from "lucide-react";

import { cn } from "@/lib/utils";
import type { P2PMerchantPublic, P2PMerchantTier } from "@/lib/p2p";

/** Exchange-style merchant badges. */
export function MerchantBadge({
  merchant,
  className,
  size = "sm",
}: {
  merchant?: P2PMerchantPublic | null;
  className?: string;
  size?: "sm" | "md";
}) {
  if (!merchant || merchant.tier === "none") return null;

  const icon = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  const text = size === "md" ? "text-[11px]" : "text-[10px]";
  const pad = size === "md" ? "px-1.5 py-0.5" : "px-1 py-px";
  const verified = !!merchant.has_verified_badge;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {merchant.tier === "super" ? (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-[3px] bg-amber-500/15 font-bold text-amber-500",
            pad,
            text,
          )}
          title="Super Merchant"
        >
          <Sparkles className={icon} />
          Super
        </span>
      ) : verified ? (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-[3px] bg-sky-500/15 font-bold text-sky-400",
            pad,
            text,
          )}
          title="Verified Merchant — 30 days continuous on P2P"
        >
          <BadgeCheck className={icon} />
          Verified
        </span>
      ) : (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-[3px] bg-emerald-500/15 font-bold text-emerald-500",
            pad,
            text,
          )}
          title="Approved Merchant"
        >
          <Store className={icon} />
          Merchant
        </span>
      )}
      {merchant.is_featured ? (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-[3px] bg-[#11C66D]/15 font-bold text-[#11C66D]",
            pad,
            text,
          )}
          title="Featured merchant"
        >
          <Star className={icon} fill="currentColor" />
          Featured
        </span>
      ) : null}
      {merchant.badge_label ? (
        <span
          className={cn(
            "inline-flex items-center rounded-[3px] bg-muted font-bold text-muted-foreground",
            pad,
            text,
          )}
        >
          {merchant.badge_label}
        </span>
      ) : null}
    </span>
  );
}

export function MerchantTierLabel(
  tier: P2PMerchantTier | null | undefined,
  opts?: { hasVerifiedBadge?: boolean },
) {
  if (tier === "super") return "Super Merchant";
  if (tier === "verified") {
    if (opts?.hasVerifiedBadge) return "Verified Merchant";
    return "Approved Merchant";
  }
  return "Not approved";
}
