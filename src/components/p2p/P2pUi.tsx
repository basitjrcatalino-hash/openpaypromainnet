import { cn } from "@/lib/utils";
import { P2pPayIcon } from "@/components/p2p/P2pPayIcon";

/** OKX-style Buy / Sell text tabs (green buy · red sell). */
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
    <div className={cn("inline-flex items-center gap-5", className)}>
      {(["buy", "sell"] as const).map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={cn(
              "relative pb-1 text-[17px] font-extrabold capitalize tracking-tight transition-colors",
              active
                ? s === "buy"
                  ? "text-[#11C66D]"
                  : "text-[#F04438]"
                : "text-muted-foreground/70",
            )}
          >
            {s}
            {active ? (
              <span
                className={cn(
                  "absolute inset-x-0 -bottom-0.5 mx-auto h-[2px] w-5 rounded-full",
                  s === "buy" ? "bg-[#11C66D]" : "bg-[#F04438]",
                )}
              />
            ) : null}
          </button>
        );
      })}
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
        "flex items-center gap-1.5 overflow-x-auto scrollbar-none [-webkit-overflow-scrolling:touch]",
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
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-[4px] px-2 text-xs font-semibold transition-colors",
        active
          ? "bg-foreground/[0.08] text-foreground"
          : "text-muted-foreground hover:bg-foreground/[0.04]",
      )}
    >
      {icon}
      <span className="max-w-[7.5rem] truncate">{label}</span>
      <span className="text-[9px] opacity-50">▾</span>
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
    <div className="grid place-items-center gap-3 px-6 py-20 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-muted/50 text-lg font-bold text-muted-foreground">
        —
      </div>
      <p className="text-[15px] font-bold text-foreground">{title}</p>
      {description ? <p className="max-w-xs text-xs text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

const AVATAR_TONES = [
  "from-[#3B82F6] to-[#1D4ED8]",
  "from-[#8B5CF6] to-[#6D28D9]",
  "from-[#14B8A6] to-[#0F766E]",
  "from-[#F59E0B] to-[#D97706]",
  "from-[#EC4899] to-[#BE185D]",
  "from-[#10B981] to-[#047857]",
];

function avatarTone(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}

export function MerchantAvatar({
  name,
  size = "sm",
  online,
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
  className?: string;
}) {
  const initial = (name.trim()[0] || "T").toUpperCase();
  const dim =
    size === "lg"
      ? "h-14 w-14 text-lg"
      : size === "md"
        ? "h-9 w-9 text-sm"
        : "h-7 w-7 text-[11px]";
  const dot = size === "lg" ? "h-3.5 w-3.5" : "h-2.5 w-2.5";
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-full bg-gradient-to-br font-bold text-white",
          dim,
          avatarTone(name),
        )}
      >
        {initial}
      </span>
      {online ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background bg-[#11C66D]",
            dot,
          )}
        />
      ) : null}
    </span>
  );
}

/** OKX-style merchant meta: orders | completion% · positive% · response time */
export function MerchantStatLine({
  completed,
  completionRate,
  positiveRate,
  online,
  responseMin,
  compact,
}: {
  completed?: number;
  completionRate?: number | null;
  positiveRate?: number | null;
  online?: boolean;
  responseMin?: number | null;
  compact?: boolean;
}) {
  const bits: string[] = [];
  if (completed != null) bits.push(`${completed.toLocaleString()} orders`);
  if (completionRate != null && Number.isFinite(completionRate)) {
    bits.push(`${completionRate.toFixed(2)}%`);
  }
  if (positiveRate != null && Number.isFinite(positiveRate)) {
    bits.push(`${positiveRate.toFixed(positiveRate >= 100 ? 0 : 1)}% positive`);
  }
  if (responseMin != null) bits.push(`${responseMin} min`);

  if (compact) {
    return (
      <p className="truncate text-[11px] leading-tight text-muted-foreground">
        {bits.length ? bits.join(" · ") : "New advertiser"}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
      {online ? (
        <span className="inline-flex items-center gap-1 font-semibold text-[#11C66D]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#11C66D]" />
          Online
        </span>
      ) : null}
      <span>{bits.length ? bits.join(" · ") : "New advertiser"}</span>
    </div>
  );
}

/** Compact OKX payment method tags (logo + short name). */
export function PaymentMethodTags({
  codes,
  labels,
  max = 3,
}: {
  codes: string[];
  labels: Record<string, string>;
  max?: number;
}) {
  const shown = codes.slice(0, max);
  const extra = codes.length - shown.length;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {shown.map((code) => (
        <span
          key={code}
          className="inline-flex h-[18px] max-w-[5.5rem] items-center gap-1 rounded-[2px] bg-foreground/[0.06] px-1 text-[10px] font-medium text-muted-foreground"
          title={labels[code] ?? code}
        >
          <P2pPayIcon code={code} name={labels[code]} size="xs" className="!h-3.5 !w-3.5 !rounded-[2px]" />
          <span className="truncate">{labels[code] ?? code}</span>
        </span>
      ))}
      {extra > 0 ? (
        <span className="text-[10px] font-semibold text-muted-foreground">+{extra}</span>
      ) : null}
    </div>
  );
}

export function TradeCta({
  side,
  onClick,
  className,
  label,
}: {
  side: "buy" | "sell";
  onClick?: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 min-w-[4.75rem] shrink-0 rounded-[6px] px-3.5 text-[13px] font-bold text-white press",
        side === "buy"
          ? "bg-[#11C66D] hover:bg-[#0FB461]"
          : "bg-[#F04438] hover:bg-[#DE3A2F]",
        className,
      )}
    >
      {label ?? (side === "buy" ? "Buy" : "Sell")}
    </button>
  );
}
