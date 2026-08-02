import { useEffect, useState } from "react";

/** Hide chrome when scrolling down; show when scrolling up, near top, or near bottom (so tab bar stays reachable). */
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
        const nearBottom = y + window.innerHeight >= doc.scrollHeight - 80;

        if (y < 32 || nearBottom) {
          // Keep header/tab bar reachable on short pages and at page end (Trade, etc.)
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
