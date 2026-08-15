import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Full exchange ("Pro") terminal layout — OKX / Bybit style four-column desk.
 * Purely presentational: every pane is a slot filled by the wired trade page,
 * so order routing, depth and positions keep using the same server functions.
 */
export function ExchangeTerminal({
  markets,
  chart,
  book,
  trades,
  form,
  dock,
  periods,
  className,
  dockSize: dockSizeProp,
  onDockSize,
}: {
  markets: ReactNode;
  chart: (height: number) => ReactNode;
  book: ReactNode;
  trades: ReactNode;
  form: ReactNode;
  dock: ReactNode;
  periods?: ReactNode;
  className?: string;
  dockSize?: "sm" | "md" | "full";
  onDockSize?: (s: "sm" | "md" | "full") => void;
}) {
  const chartHost = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(420);
  // OKX-style resizable bottom dock (orders / trades / positions)
  const [dockSizeLocal, setDockSizeLocal] = useState<"sm" | "md" | "full">("md");
  const dockSize = dockSizeProp ?? dockSizeLocal;
  const setDockSize = (s: "sm" | "md" | "full") => {
    setDockSizeLocal(s);
    onDockSize?.(s);
  };

  useEffect(() => {
    const el = chartHost.current;
    if (!el) return;
    const measure = () => setChartHeight(Math.max(260, Math.floor(el.clientHeight)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);


  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-px overflow-y-auto overscroll-contain bg-border/40",
        "xl:grid xl:grid-cols-[240px_minmax(0,1fr)_290px_320px] xl:overflow-hidden",
        className,
      )}
    >
      <aside className="hidden min-h-0 flex-col overflow-hidden bg-background xl:flex">
        <div className="shrink-0 border-b border-border/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Markets
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {markets}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background">
        {periods ? (
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/30 px-2 py-1 scrollbar-none">
            {periods}
          </div>
        ) : null}
        {dockSize !== "full" ? (
          <div
            ref={chartHost}
            className={cn(
              "min-h-[240px] shrink-0 xl:shrink",
              dockSize === "sm" ? "h-[62dvh] xl:h-auto xl:flex-[2.6]" : "h-[42dvh] xl:h-auto xl:flex-[1.15]",
            )}
          >
            {chart(chartHeight)}
          </div>
        ) : null}
        <div
          className={cn(
            "flex min-h-0 flex-col border-t border-border/40",
            dockSize === "full"
              ? "min-h-[60dvh] flex-1"
              : dockSize === "md"
                ? "min-h-[38dvh] flex-1 xl:min-h-0"
                : "h-[132px] shrink-0",
          )}
        >
          <div className="flex shrink-0 items-center justify-end gap-1 px-2 py-1">
            {(["sm", "md", "full"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDockSize(s)}
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-semibold uppercase",
                  dockSize === s
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "sm" ? "Compact" : s === "md" ? "Expanded" : "Full"}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{dock}</div>
        </div>

      </section>


      <section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden bg-background xl:min-h-0">
        <div className="min-h-0 flex-[1.25] overflow-hidden p-1.5">{book}</div>
        <div className="min-h-0 flex-1 overflow-hidden border-t border-border/40 p-1.5">
          <p className="pb-1 text-[11px] font-semibold text-muted-foreground">Recent trades</p>
          <div className="h-[calc(100%-1.25rem)] overflow-hidden">{trades}</div>
        </div>
      </section>

      <aside className="min-h-0 overflow-y-auto overscroll-contain bg-background px-2 py-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {form}
      </aside>
    </div>
  );

}
