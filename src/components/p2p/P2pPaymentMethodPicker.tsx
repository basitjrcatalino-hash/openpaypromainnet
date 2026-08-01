import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { P2pPayIcon } from "@/components/p2p/P2pPayIcon";
import { cn } from "@/lib/utils";
import type { P2PPaymentMethod } from "@/lib/p2p";

const REGION_TABS = [
  "All",
  "Popular",
  "Global",
  "Americas",
  "Europe",
  "Asia",
  "Middle East",
  "Africa",
  "Oceania",
] as const;

type RegionTab = (typeof REGION_TABS)[number];

function matchesQuery(m: P2PPaymentMethod, q: string) {
  if (!q) return true;
  const hay = `${m.name} ${m.code} ${m.region ?? ""} ${m.keywords ?? ""}`.toLowerCase();
  return hay.includes(q);
}

export function P2pPaymentMethodPicker({
  methods,
  mode = "single",
  value,
  values,
  onSelect,
  onToggle,
  showAllOption,
  onSelectAll,
  className,
  maxHeightClass = "max-h-72",
}: {
  methods: P2PPaymentMethod[];
  mode?: "single" | "multi";
  /** Selected code (single mode) */
  value?: string | null;
  /** Selected codes (multi mode) */
  values?: string[];
  onSelect?: (code: string) => void;
  onToggle?: (code: string) => void;
  showAllOption?: boolean;
  onSelectAll?: () => void;
  className?: string;
  maxHeightClass?: string;
}) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<RegionTab>("All");
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return methods
      .filter((m) => m.is_active)
      .filter((m) => {
        if (region === "All") return true;
        if (region === "Popular") {
          return (
            m.region === "Popular" ||
            ["bank_transfer", "paypal", "wise", "gcash", "maya", "upi", "pix", "zelle", "sepa", "openpay"].includes(
              m.code,
            )
          );
        }
        return (m.region || "Global") === region;
      })
      .filter((m) => matchesQuery(m, q));
  }, [methods, q, region]);

  const selectedSet = useMemo(() => new Set(values ?? []), [values]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GCash, PIX, UPI, Zelle…"
          className="h-10 rounded-xl pl-9"
          autoFocus={false}
        />
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-none">
        {REGION_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setRegion(tab)}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-[11px] font-semibold",
              region === tab
                ? "border-foreground bg-secondary text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {showAllOption && onSelectAll ? (
        <button
          type="button"
          className="h-10 w-full rounded-xl border border-border text-sm font-semibold"
          onClick={onSelectAll}
        >
          All payment methods
        </button>
      ) : null}

      <div className={cn("overflow-y-auto pr-0.5", maxHeightClass)}>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No methods match your search</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filtered.map((m) => {
              const on =
                mode === "multi" ? selectedSet.has(m.code) : value === m.code;
              return (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => {
                    if (mode === "multi") onToggle?.(m.code);
                    else onSelect?.(m.code);
                  }}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold",
                    on
                      ? "border-foreground bg-secondary text-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <P2pPayIcon code={m.code} name={m.name} size="sm" />
                  {m.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {mode === "multi" && selectedSet.size > 0 ? (
        <p className="text-[11px] text-muted-foreground">{selectedSet.size} selected</p>
      ) : null}
    </div>
  );
}
