import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/**
 * Slim top progress bar shown while a route is loading / transitioning.
 * Keeps navigation feeling instant even when a loader is slow.
 */
export function RouteProgress() {
  const status = useRouterState({ select: (s) => s.status });
  const isPending = useRouterState({ select: (s) => s.isLoading || s.isTransitioning });
  const active = isPending || status === "pending";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      const show = window.setTimeout(() => setVisible(true), 90);
      return () => window.clearTimeout(show);
    }
    const hide = window.setTimeout(() => setVisible(false), 220);
    return () => window.clearTimeout(hide);
  }, [active]);

  if (!visible && !active) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
    >
      <div
        className={cn(
          "h-full w-full origin-left bg-gradient-to-r from-primary via-primary/70 to-accent",
          visible && active ? "ph-progress-run" : "ph-progress-done",
        )}
      />
    </div>
  );
}
