import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export type TradingViewWidgetKind = "advanced-chart" | "technical-analysis" | "timeline" | "symbol-info";

const SCRIPT_SRC: Record<TradingViewWidgetKind, string> = {
  "advanced-chart":
    "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js",
  "technical-analysis":
    "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js",
  timeline: "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js",
  "symbol-info": "https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js",
};

type Props = {
  kind: TradingViewWidgetKind;
  symbol: string;
  /** Chart interval for advanced-chart */
  interval?: string;
  height?: number | string;
  className?: string;
  /** Hide TradingView "allow symbol change" on chart */
  allowSymbolChange?: boolean;
};

/**
 * Client-only TradingView embed. Remounts when symbol / theme / interval change.
 * @see https://www.tradingview.com/widget-docs/
 */
export function TradingViewEmbed({
  kind,
  symbol,
  interval = "15",
  height = 320,
  className,
  allowSymbolChange = false,
}: Props) {
  const { theme } = useTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const reactId = useId().replace(/:/g, "");
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!ready || !hostRef.current) return;
    const host = hostRef.current;
    host.innerHTML = "";

    const widgetMount = document.createElement("div");
    widgetMount.className = "tradingview-widget-container__widget";
    widgetMount.style.height = typeof height === "number" ? `${height}px` : height;
    widgetMount.style.width = "100%";
    host.appendChild(widgetMount);

    const colorTheme = theme === "light" ? "light" : "dark";
    let config: Record<string, unknown>;

    if (kind === "advanced-chart") {
      config = {
        autosize: true,
        symbol,
        interval,
        timezone: "Etc/UTC",
        theme: colorTheme,
        style: "1",
        locale: "en",
        backgroundColor: colorTheme === "dark" ? "#0a0a0a" : "#ffffff",
        gridColor: colorTheme === "dark" ? "rgba(242, 242, 242, 0.06)" : "rgba(0,0,0,0.06)",
        hide_top_toolbar: false,
        hide_legend: false,
        withdateranges: true,
        hide_side_toolbar: true,
        allow_symbol_change: allowSymbolChange,
        calendar: false,
        support_host: "https://www.tradingview.com",
        container_id: `tv_${kind}_${reactId}`,
      };
    } else if (kind === "technical-analysis") {
      config = {
        interval: "1h",
        width: "100%",
        isTransparent: true,
        height: typeof height === "number" ? height : 400,
        symbol,
        showIntervalTabs: true,
        displayMode: "single",
        locale: "en",
        colorTheme,
      };
    } else if (kind === "timeline") {
      config = {
        feedMode: "symbol",
        symbol,
        colorTheme,
        isTransparent: true,
        displayMode: "regular",
        width: "100%",
        height: typeof height === "number" ? height : 420,
        locale: "en",
      };
    } else {
      config = {
        symbol,
        width: "100%",
        locale: "en",
        colorTheme,
        isTransparent: true,
      };
    }

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = SCRIPT_SRC[kind];
    script.async = true;
    script.innerHTML = JSON.stringify(config);
    host.appendChild(script);

    return () => {
      host.innerHTML = "";
    };
  }, [ready, kind, symbol, interval, theme, height, allowSymbolChange, reactId]);

  const h = typeof height === "number" ? height : undefined;

  if (!ready) {
    return (
      <div
        className={cn("animate-pulse rounded-2xl bg-muted/40", className)}
        style={{ height: h ?? 280 }}
      />
    );
  }

  return (
    <div
      className={cn("tradingview-widget-container overflow-hidden rounded-2xl", className)}
      style={{ height: h, width: "100%" }}
    >
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
