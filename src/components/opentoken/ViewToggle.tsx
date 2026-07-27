import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export function ViewToggle({
  value,
  onChange,
}: {
  value: "grid" | "table";
  onChange: (v: "grid" | "table") => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border/60 bg-card/60 p-0.5">
      <button
        type="button"
        aria-label="Grid view"
        onClick={() => onChange("grid")}
        className={cn(
          "rounded-full p-1.5",
          value === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
        )}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Table view"
        onClick={() => onChange("table")}
        className={cn(
          "rounded-full p-1.5",
          value === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
        )}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}
