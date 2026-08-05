import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  logoUrl?: string | null;
  name?: string | null;
  symbol?: string | null;
  verified?: boolean | null;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Token logo with an explicit loading shimmer — avoids the Avatar "?" flash
 * while remote logos resolve.
 */
export function TokenAvatar({
  logoUrl,
  name,
  symbol,
  verified,
  size = "md",
  className,
}: Props) {
  const dim = size === "sm" ? "h-10 w-10" : "h-11 w-11";
  const badge = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const initials = (symbol || name || "?").slice(0, 3).toUpperCase();

  return (
    <div className={cn("relative shrink-0", dim, className)}>
      {logoUrl ? (
        <TokenAvatarImage
          key={logoUrl}
          logoUrl={logoUrl}
          name={name}
          initials={initials}
          dim={dim}
        />
      ) : (
        <div
          className={cn(
            "grid place-items-center overflow-hidden rounded-full bg-primary/20 text-[10px] font-bold text-primary",
            dim,
          )}
        >
          <span className="select-none">{initials}</span>
        </div>
      )}
      {verified && (
        <BadgeCheck
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full bg-background text-primary",
            badge,
          )}
        />
      )}
    </div>
  );
}

function TokenAvatarImage({
  logoUrl,
  name,
  initials,
  dim,
}: {
  logoUrl: string;
  name?: string | null;
  initials: string;
  dim: string;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  if (status === "error") {
    return (
      <div
        className={cn(
          "grid place-items-center overflow-hidden rounded-full bg-primary/20 text-[10px] font-bold text-primary",
          dim,
        )}
      >
        <span className="select-none">{initials}</span>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-full bg-muted", dim)}>
      {status === "loading" && (
        <Skeleton className="absolute inset-0 rounded-full" aria-hidden />
      )}
      <img
        src={logoUrl}
        alt={name || initials}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-200",
          status === "loaded" ? "opacity-100" : "opacity-0",
        )}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </div>
  );
}
