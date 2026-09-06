import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Grouped white card with hairline dividers between rows. */
export function IosSettingsGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[16px] bg-ios-card [&>*+*]:border-t [&>*+*]:border-ios-separator",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Uppercase section label above a group. */
export function IosSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-ios-secondary">
      {children}
    </p>
  );
}

export const iosRowClass =
  "ios-active flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ios-fill";

/** Chevron row: icon + title/subtitle + chevron. */
export function IosSettingsRow({
  icon,
  title,
  subtitle,
  right,
  onClick,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={cn(iosRowClass, className)}>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-semibold text-ios-label">{title}</div>
        {subtitle ? (
          <div className="mt-0.5 text-[12px] leading-snug text-ios-secondary">{subtitle}</div>
        ) : null}
      </div>
      {right ?? <ChevronRight className="h-5 w-5 shrink-0 text-ios-tertiary" />}
    </button>
  );
}

/** iOS segmented control. */
export function IosSegmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-1 rounded-[9px] bg-ios-track p-0.5", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "ios-active rounded-[7px] py-1.5 text-[13px] font-semibold transition",
            value === o.id
              ? "bg-ios-pill text-ios-label shadow-sm dark:text-white"
              : "text-ios-secondary",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
