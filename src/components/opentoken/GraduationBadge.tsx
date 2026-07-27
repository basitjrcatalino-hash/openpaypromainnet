import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function GraduationBadge({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/90 font-semibold text-primary-foreground",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <BadgeCheck className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      Graduated
    </span>
  );
}
