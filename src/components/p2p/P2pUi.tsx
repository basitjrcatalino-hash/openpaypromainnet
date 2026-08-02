import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { P2pPayIcon } from "@/components/p2p/P2pPayIcon";
import { P2P_ASSETS, isP2pStableAsset } from "@/lib/p2p";
import { logoUrlForTokenSymbol } from "@/lib/token-logos";

/** Bitget-style Buy / Sell pill toggle. */
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
    <div
      className={cn(
        "inline-flex h-9 items-center rounded-full bg-muted/90 p-1 dark:bg-muted/60",
        className,
      )}
    >
      {(["buy", "sell"] as const).map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={cn(
              "h-7 min-w-[4.25rem] rounded-full px-4 text-[13px] font-bold capitalize tracking-tight transition-colors press",
              active
                ? s === "buy"
                  ? "bg-[#11C66D] text-white shadow-sm"
                  : "bg-[#FF2D55] text-white shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {s}
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
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition-colors",
        active ? "bg-foreground/8 text-foreground" : "text-muted-foreground hover:bg-foreground/4",
      )}
    >
      {icon}
      <span className="max-w-30 truncate">{label}</span>
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
  action?: ReactNode;
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
    size === "lg" ? "h-14 w-14 text-lg" : size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-[11px]";
  const dot = size === "lg" ? "h-3.5 w-3.5" : "h-2.5 w-2.5";
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-full bg-linear-to-br font-bold text-white",
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

/** Bitget-style: `59(100%) · 4 min` */
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
  if (compact) {
    const orders = completed != null ? completed.toLocaleString() : "0";
    const pct =
      completionRate != null && Number.isFinite(completionRate)
        ? `(${Math.round(completionRate)}%)`
        : "";
    const time = responseMin != null ? `${responseMin} min` : null;
    return (
      <p className="truncate text-[11px] leading-tight text-muted-foreground tabular-nums">
        <span>
          {orders}
          {pct}
        </span>
        {time ? <span> · {time}</span> : null}
      </p>
    );
  }

  const bits: string[] = [];
  if (completed != null) bits.push(`${completed.toLocaleString()} orders`);
  if (completionRate != null && Number.isFinite(completionRate)) {
    bits.push(`${completionRate.toFixed(2)}%`);
  }
  if (positiveRate != null && Number.isFinite(positiveRate)) {
    bits.push(`${positiveRate.toFixed(positiveRate >= 100 ? 0 : 1)}% positive`);
  }
  if (responseMin != null) bits.push(`${responseMin} min`);

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

/** Compact payment method tags with colored square markers (Bitget-style). */
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
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {shown.map((code) => (
        <span
          key={code}
          className="inline-flex h-5 max-w-28 items-center gap-1 text-[11px] font-medium text-muted-foreground"
          title={labels[code] ?? code}
        >
          <P2pPayIcon
            code={code}
            name={labels[code]}
            size="xs"
            className="h-3.5! w-3.5! rounded-[2px]!"
          />
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
        "h-8 min-w-[4.75rem] shrink-0 rounded-lg px-3.5 text-[13px] font-bold text-white press",
        side === "buy" ? "bg-[#11C66D] hover:bg-[#0FB461]" : "bg-[#FF2D55] hover:bg-[#E8254A]",
        className,
      )}
    >
      {label ?? (side === "buy" ? "Buy" : "Sell")}
    </button>
  );
}

export function P2pAssetIcon({ asset, className }: { asset: string; className?: string }) {
  const logo = logoUrlForTokenSymbol(asset);
  if (logo) {
    return <img src={logo} alt="" className={cn("h-6 w-6 rounded-full object-cover", className)} />;
  }
  return (
    <span
      className={cn(
        "grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-[9px] font-bold text-primary",
        className,
      )}
    >
      {asset.slice(0, 2)}
    </span>
  );
}

/** Select-crypto grid: all P2P stables + majors with logos. */
export function P2pAssetPickerGrid({
  value,
  onSelect,
  assets = P2P_ASSETS,
}: {
  value?: string;
  onSelect: (asset: string) => void;
  assets?: readonly string[];
}) {
  const stables = assets.filter((a) => isP2pStableAsset(a));
  const majors = assets.filter((a) => !isP2pStableAsset(a));

  function Row({ list }: { list: string[] }) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {list.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onSelect(a)}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold press",
              value === a ? "border-foreground bg-secondary" : "border-border hover:bg-muted/50",
            )}
          >
            <P2pAssetIcon asset={a} className="h-5 w-5" />
            {a}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stables.length ? (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Stablecoins
          </p>
          <Row list={[...stables]} />
        </div>
      ) : null}
      {majors.length ? (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Crypto
          </p>
          <Row list={[...majors]} />
        </div>
      ) : null}
    </div>
  );
}
