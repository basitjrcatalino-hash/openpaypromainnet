import { BadgeCheck } from "lucide-react";
import { OT_CATEGORY_LABELS, type OtCategory } from "@/lib/opentoken/bonding-curve";

export type LivePreviewProps = {
  name: string;
  symbol: string;
  description?: string;
  logo_url?: string;
  category?: OtCategory | string;
};

export function LivePreview({ name, symbol, description, logo_url, category = "meme" }: LivePreviewProps) {
  const cat = (category as OtCategory) in OT_CATEGORY_LABELS ? (category as OtCategory) : "meme";
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-border/50 bg-background/40">
        <div className="aspect-square bg-muted/40">
          {logo_url ? (
            <img src={logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Token artwork appears here
            </div>
          )}
        </div>
        <div className="p-3">
          <div className="flex items-center gap-1 text-sm font-semibold">
            {name || "Token name"}
            <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground/40" />
          </div>
          <div className="text-xs text-muted-foreground">${symbol || "TICKER"}</div>
          <p className="mt-2 line-clamp-3 text-[11px] text-muted-foreground">
            {description || "A preview of how your coin will look on OpenToken."}
          </p>
          <div className="mt-2 text-[10px] text-muted-foreground">{OT_CATEGORY_LABELS[cat]}</div>
        </div>
      </div>
    </div>
  );
}
