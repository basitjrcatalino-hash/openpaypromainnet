import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_MQ = `(min-width: ${MOBILE_BREAKPOINT}px)`;

/**
 * True when viewport is below `md` (768px).
 * Note: returns `false` before hydration — prefer `useIsDesktopViewport` for
 * surfaces that must never flash a mobile sheet on desktop.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/**
 * True at `md+` (768px). Defaults to `true` so desktop UIs (centered dialogs)
 * never flash a mobile bottom sheet before the media query resolves.
 */
export function useIsDesktopViewport() {
  const [isDesktop, setIsDesktop] = React.useState(true);

  React.useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MQ);
    const sync = () => setIsDesktop(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}
