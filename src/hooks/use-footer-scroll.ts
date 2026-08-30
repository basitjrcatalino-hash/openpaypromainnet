import { useEffect, useState } from "react";

/**
 * Footer-only scroll behaviour: hide when scrolling down, show when scrolling up.
 * Unlike the shared chrome hook, the footer stays hidden at the bottom of the
 * page so floating action buttons / selectors / confirm buttons are not covered.
 * It reappears as soon as the user scrolls back up or returns to the top.
 */
export function useFooterScroll(threshold = 6, resetKey?: string) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [resetKey]);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = Math.max(0, window.scrollY);
        const dy = y - lastY;

        if (y < 24) {
          // Always show at the very top
          setVisible(true);
        } else if (dy < -threshold) {
          setVisible(true);
        } else if (dy > threshold) {
          setVisible(false);
        }
        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return visible;
}
