import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export type TradingViewWidgetKind = "advanced-chart" | "technical-analysis" | "timeline" | "symbol-info";

const SCRIPT_SRC: Record<Exclude<TradingViewWidgetKind, "advanced-chart">, string> = {
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
  allowSymbolChange?: boolean;
};

/**
 * Client-only TradingView embed.
 * Advanced chart uses the stable widgetembed iframe (script widgets often render blank in app shells).
 * Widgets are isolated and torn down on unmount so they cannot block other routes.
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
  const pxHeight = typeof height === "number" ? height : 320;

  useEffect(() => setReady(true), []);

  const chartSrc = useMemo(() => {
    if (kind !== "advanced-chart") return "";
    const colorTheme = theme === "light" ? "light" : "dark";
    const params = new URLSearchParams({
      frameElementId: `tv_chart_${reactId}`,
      symbol,
      interval: String(interval),
      hidesidetoolbar: "1",
      hidetoptoolbar: "0",
      symboledit: allowSymbolChange ? "1" : "0",
      saveimage: "0",
      toolbarbg: colorTheme === "dark" ? "0a0a0a" : "ffffff",
      studies: "[]",
      theme: colorTheme,
      style: "1",
      timezone: "Etc/UTC",
      withdateranges: "1",
      hideideas: "1",
      hidevolume: "0",
      locale: "en",
      utm_source: typeof window !== "undefined" ? window.location.hostname : "openpay",
      utm_medium: "widget",
      utm_campaign: "chart",
      utm_term: symbol,
    });
    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [kind, symbol, interval, theme, allowSymbolChange, reactId]);

  useEffect(() => {
    if (!ready || kind === "advanced-chart" || !hostRef.current) return;
    const host = hostRef.current;
    let cancelled = false;
    host.innerHTML = "";

    const widgetMount = document.createElement("div");
    widgetMount.className = "tradingview-widget-container__widget";
    widgetMount.style.height = `${pxHeight}px`;
    widgetMount.style.width = "100%";
    host.appendChild(widgetMount);

    const colorTheme = theme === "light" ? "light" : "dark";
    let config: Record<string, unknown>;

    if (kind === "technical-analysis") {
      config = {
        interval: "1h",
        width: "100%",
        isTransparent: true,
        height: pxHeight,
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
        height: pxHeight,
        locale: "en",
      };
    } else {
      config = {
        symbol,
        width: "100%",
        height: pxHeight,
        locale: "en",
        colorTheme,
        isTransparent: true,
      };
    }

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = SCRIPT_SRC[kind];
    script.async = true;
    script.textContent = JSON.stringify(config);
    if (!cancelled) host.appendChild(script);

    return () => {
      cancelled = true;
      try {
        host.innerHTML = "";
      } catch {
        /* ignore */
      }
    };
  }, [ready, kind, symbol, theme, pxHeight]);

  if (!ready) {
    return (
      <div
        className={cn("animate-pulse rounded-2xl bg-muted/40", className)}
        style={{ height: pxHeight }}
      />
    );
  }

  if (kind === "advanced-chart") {
    return (
      <div
        className={cn(
          "relative isolate overflow-hidden rounded-2xl bg-background [contain:layout_paint]",
          className,
        )}
        style={{ height: pxHeight, width: "100%" }}
      >
        <iframe
          id={`tv_chart_${reactId}`}
          title={`${symbol} chart`}
          src={chartSrc}
          style={{ width: "100%", height: pxHeight, border: 0 }}
          allow="fullscreen"
          loading="lazy"
          referrerPolicy="origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "tradingview-widget-container relative isolate overflow-hidden rounded-2xl [contain:layout_paint]",
        className,
      )}
      style={{ height: pxHeight, width: "100%" }}
    >
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
