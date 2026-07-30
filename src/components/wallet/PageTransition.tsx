import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/**
 * Phantom-style page enter: soft fade + rise on every route change.
 * Animation class is cleared on end so transform does not stick and break
 * position:fixed sheets / docks inside the page.
 */
export function PageTransition({
  children,
  className,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  /** Skip animation (e.g. full-screen scan). */
  disabled?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const routeKey = `${pathname}${search}`;
  const [enter, setEnter] = useState(!disabled);

  useEffect(() => {
    if (disabled) {
      setEnter(false);
      return;
    }
    setEnter(true);
    // Land at the top of the new page without a jarring jump.
    if (typeof window !== "undefined") {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    }
  }, [routeKey, disabled]);

  if (disabled) {
    return <div className={cn("min-h-0", className)}>{children}</div>;
  }

  return (
    <div
      key={routeKey}
      className={cn("min-h-0", enter && "ph-route-enter", className)}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        setEnter(false);
      }}
    >
      {children}
    </div>
  );
}
