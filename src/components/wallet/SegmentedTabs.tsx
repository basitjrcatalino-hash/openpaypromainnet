import { cn } from "@/lib/utils";

type Tab<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  tabs: Tab<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
};

export function SegmentedTabs<T extends string>({ tabs, value, onChange, className }: Props<T>) {
  return (
    <div
      className={cn(
        "flex rounded-full bg-muted/60 p-1",
        className,
      )}
      role="tablist"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors press",
            value === t.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
