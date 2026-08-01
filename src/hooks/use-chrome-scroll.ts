import { useEffect, useState } from "react";

/** Hide chrome when scrolling down; show when scrolling up or near top. */
export function useChromeScroll(threshold = 10, resetKey?: string) {
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
        const doc = document.documentElement;
        const nearBottom =
          y + window.innerHeight >= doc.scrollHeight - 48;

        if (y < 32) {
          setVisible(true);
        } else if (dy < -threshold) {
          setVisible(true);
        } else if (dy > threshold || (nearBottom && dy >= 0)) {
          // Hide on scroll-down, or while resting near page end (keep CTAs clear)
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
