import { cn } from "@/lib/utils";

export function BuySellToggle({
  value,
  onChange,
  className,
}: {
  value: "buy" | "sell";
  onChange: (v: "buy" | "sell") => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-full bg-muted/80 p-0.5", className)}>
      {(["buy", "sell"] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={cn(
            "h-8 min-w-[4.5rem] rounded-full px-4 text-sm font-bold capitalize transition-colors",
            value === s
              ? "bg-secondary text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function FilterChipRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto scrollbar-none [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FilterChip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold",
        active ? "bg-secondary text-foreground" : "text-muted-foreground",
      )}
    >
      {icon}
      {label}
      <span className="text-[10px] opacity-60">▾</span>
    </button>
  );
}

export function P2pEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-3 px-6 py-24 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-border/60 bg-muted/40 text-2xl text-muted-foreground">
        !
      </div>
      <p className="text-base font-bold text-foreground">{title}</p>
      {description ? <p className="max-w-xs text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

export function MerchantStatLine({
  completed,
  completionRate,
  online,
}: {
  completed?: number;
  completionRate?: number | null;
  online?: boolean;
}) {
  const parts: string[] = [];
  if (completed != null) {
    parts.push(`${completed.toLocaleString()} transactions`);
  }
  if (completionRate != null && Number.isFinite(completionRate)) {
    parts.push(`${completionRate.toFixed(2)}% completion`);
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
      {online ? (
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Online
        </span>
      ) : null}
      {parts.length ? <span>{parts.join(" · ")}</span> : <span>New trader</span>}
    </div>
  );
}
