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
}: {
  markets: ReactNode;
  chart: (height: number) => ReactNode;
  book: ReactNode;
  trades: ReactNode;
  form: ReactNode;
  dock: ReactNode;
  periods?: ReactNode;
  className?: string;
}) {
  const chartHost = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(420);

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
        "grid h-full min-h-0 grid-cols-[240px_minmax(0,1fr)_290px_320px] gap-px bg-border/40",
        className,
      )}
    >
      <aside className="flex min-h-0 flex-col overflow-hidden bg-background">
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
        <div ref={chartHost} className="min-h-[240px] flex-[1.6]">
          {chart(chartHeight)}
        </div>
        <div className="flex min-h-[180px] flex-1 flex-col overflow-hidden border-t border-border/40">
          {dock}
        </div>
      </section>

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background">
        <div className="min-h-0 flex-[1.25] overflow-hidden p-1.5">{book}</div>
        <div className="min-h-0 flex-1 overflow-hidden border-t border-border/40 p-1.5">
          <p className="pb-1 text-[11px] font-semibold text-muted-foreground">Recent trades</p>
          <div className="h-[calc(100%-1.25rem)] overflow-hidden">{trades}</div>
        </div>
      </section>

      <aside className="min-h-0 overflow-y-auto overscroll-contain bg-background px-2 py-2">
        {form}
      </aside>
    </div>
  );
}
