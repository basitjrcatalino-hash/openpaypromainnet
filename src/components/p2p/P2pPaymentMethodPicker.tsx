import { useMemo, useState, type ReactNode } from "react";
import { Check, Layers, Search } from "lucide-react";

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

const POPULAR_CODES = [
  "bank_transfer",
  "paypal",
  "wise",
  "gcash",
  "maya",
  "upi",
  "pix",
  "zelle",
  "sepa",
  "openpay",
  "revolut",
  "alipay",
];

function matchesQuery(m: P2PPaymentMethod, q: string) {
  if (!q) return true;
  const hay = `${m.name} ${m.code} ${m.region ?? ""} ${m.keywords ?? ""}`.toLowerCase();
  return hay.includes(q);
}

function MethodRow({
  code,
  name,
  selected,
  onClick,
  subtitle,
  leading,
}: {
  code?: string;
  name: string;
  selected: boolean;
  onClick: () => void;
  subtitle?: string;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors press",
        selected
          ? "bg-[#11C66D]/12"
          : "hover:bg-foreground/[0.04] active:bg-foreground/[0.06]",
      )}
    >
      {leading ??
        (code ? <P2pPayIcon code={code} name={name} size="lg" className="shadow-sm" /> : null)}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[14px] font-semibold leading-tight",
            selected ? "text-foreground" : "text-foreground/90",
          )}
        >
          {name}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
          selected
            ? "border-[#11C66D] bg-[#11C66D] text-white"
            : "border-border/80 bg-transparent",
        )}
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
    </button>
  );
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
  maxHeightClass = "max-h-[min(58dvh,28rem)]",
}: {
  methods: P2PPaymentMethod[];
  mode?: "single" | "multi";
  value?: string | null;
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
          return m.region === "Popular" || POPULAR_CODES.includes(m.code);
        }
        return (m.region || "Global") === region;
      })
      .filter((m) => matchesQuery(m, q));
  }, [methods, q, region]);

  const grouped = useMemo(() => {
    if (region !== "All" || q) {
      return [{ title: null as string | null, items: filtered }];
    }
    const order = [
      "Popular",
      "Global",
      "Americas",
      "Europe",
      "Asia",
      "Middle East",
      "Africa",
      "Oceania",
    ];
    const map = new Map<string, P2PPaymentMethod[]>();
    for (const m of filtered) {
      const key =
        POPULAR_CODES.includes(m.code) || m.region === "Popular"
          ? "Popular"
          : m.region || "Global";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    const popularIds = new Set((map.get("Popular") ?? []).map((m) => m.code));
    for (const [key, list] of [...map.entries()]) {
      if (key === "Popular") continue;
      map.set(
        key,
        list.filter((m) => !popularIds.has(m.code)),
      );
    }
    return order
      .filter((t) => (map.get(t)?.length ?? 0) > 0)
      .map((t) => ({ title: t, items: map.get(t)! }));
  }, [filtered, q, region]);

  const selectedSet = useMemo(() => new Set(values ?? []), [values]);
  const allSelected = mode === "single" && !value && !!showAllOption;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search PayPal, GCash, PIX…"
          className="h-11 rounded-xl border-0 bg-muted/50 pl-9 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-foreground/20"
        />
      </div>

      <div className="-mx-0.5 flex gap-1 overflow-x-auto px-0.5 pb-0.5 scrollbar-none">
        {REGION_TABS.map((tab) => {
          const active = region === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setRegion(tab)}
              className={cn(
                "h-8 shrink-0 rounded-full px-3 text-[12px] font-semibold transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "overflow-y-auto overscroll-contain rounded-xl border border-border/40 bg-card/40",
          maxHeightClass,
        )}
      >
        {showAllOption && onSelectAll && !q ? (
          <div className="border-b border-border/40 px-1 py-1">
            <MethodRow
              name="All payment methods"
              subtitle="Show every advertiser"
              selected={allSelected}
              onClick={onSelectAll}
              leading={
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground/10 text-foreground">
                  <Layers className="h-4 w-4" />
                </span>
              }
            />
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No methods match your search
          </p>
        ) : (
          <div className="px-1 py-1">
            {grouped.map((group) => (
              <div key={group.title ?? "list"} className="mb-1">
                {group.title ? (
                  <p className="sticky top-0 z-[1] bg-background/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                    {group.title}
                  </p>
                ) : null}
                <div className="space-y-0.5">
                  {group.items.map((m) => {
                    const on =
                      mode === "multi" ? selectedSet.has(m.code) : value === m.code;
                    return (
                      <MethodRow
                        key={m.code}
                        code={m.code}
                        name={m.name}
                        subtitle={
                          m.region && m.region !== "Popular" ? m.region : undefined
                        }
                        selected={on}
                        onClick={() => {
                          if (mode === "multi") onToggle?.(m.code);
                          else onSelect?.(m.code);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {mode === "multi" ? (
        <p className="text-center text-[12px] text-muted-foreground">
          {selectedSet.size === 0
            ? "Select one or more methods"
            : `${selectedSet.size} method${selectedSet.size === 1 ? "" : "s"} selected`}
        </p>
      ) : null}
    </div>
  );
}
