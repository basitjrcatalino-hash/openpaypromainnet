import { cn } from "@/lib/utils";
import { OT_CATEGORIES, OT_CATEGORY_LABELS, type OtCategory } from "@/lib/opentoken/bonding-curve";

const FILTERS = ["all", "trending", "new", "verified", "graduated", ...OT_CATEGORIES] as const;
export type OtFilter = (typeof FILTERS)[number];

export function CategoryPills({
  value,
  onChange,
}: {
  value: OtFilter;
  onChange: (v: OtFilter) => void;
}) {
  const items: { id: OtFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "trending", label: "Movers" },
    { id: "new", label: "New" },
    { id: "verified", label: "Verified" },
    { id: "graduated", label: "Graduated" },
    ...OT_CATEGORIES.map((c) => ({ id: c as OtFilter, label: OT_CATEGORY_LABELS[c as OtCategory] })),
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
            value === item.id
              ? "bg-gradient-primary text-primary-foreground shadow-glow"
              : "border border-border/60 bg-card/60 text-muted-foreground hover:bg-accent/50",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
