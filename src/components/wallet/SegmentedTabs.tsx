import { cn } from "@/lib/utils";

type Tab<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  tabs: Tab<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
};

/** Phantom-style segmented control — active = white pill, bold label. */
export function SegmentedTabs<T extends string>({ tabs, value, onChange, className }: Props<T>) {
  return (
    <div
      className={cn(
        "flex rounded-full bg-muted/70 p-1",
        className,
      )}
      role="tablist"
    >
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex-1 rounded-full px-4 py-2 text-[13px] font-bold tracking-tight transition-colors press",
              active
                ? "bg-foreground text-background shadow-sm dark:bg-white dark:text-black"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
