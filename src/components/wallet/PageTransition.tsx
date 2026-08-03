import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/**
 * Phantom-style page enter: soft fade + rise on pathname change.
 * - Never animates during SSR/hydration (avoids markup mismatch + first-paint flash).
 * - Search-param updates (e.g. Trade ?market=&mode=) do NOT remount or re-animate.
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
  const [enter, setEnter] = useState(false);
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (disabled) {
      setEnter(false);
      prevPath.current = pathname;
      return;
    }
    if (prevPath.current === pathname) return;
    const isFirst = prevPath.current === null;
    prevPath.current = pathname;
    setEnter(true);

    if (!isFirst && typeof window !== "undefined") {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      // Instant scroll — smooth scrolling fights the enter animation and looks janky.
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "auto" });
    }

    // Failsafe: never leave the enter class stuck if animationend is skipped.
    const t = window.setTimeout(() => setEnter(false), 600);
    return () => window.clearTimeout(t);
  }, [pathname, disabled]);

  if (disabled) {
    return <div className={cn("min-h-0", className)}>{children}</div>;
  }

  return (
    <div
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
