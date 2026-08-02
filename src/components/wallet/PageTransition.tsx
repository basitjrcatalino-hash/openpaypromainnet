import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/**
 * Phantom-style page enter: soft fade + rise on pathname change only.
 * Search-param updates (e.g. Trade ?market=&mode=) must NOT remount or re-animate,
 * or transforms stick and break fixed chrome / navigation.
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
  const [enter, setEnter] = useState(!disabled);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (disabled) {
      setEnter(false);
      prevPath.current = pathname;
      return;
    }
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    setEnter(true);
    if (typeof window !== "undefined") {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    }
    // Failsafe: never leave enter class stuck if animationend is skipped
    const t = window.setTimeout(() => setEnter(false), 500);
    return () => window.clearTimeout(t);
  }, [pathname, disabled]);

  if (disabled) {
    return <div className={cn("min-h-0", className)}>{children}</div>;
  }

  return (
    <div
      key={pathname}
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
