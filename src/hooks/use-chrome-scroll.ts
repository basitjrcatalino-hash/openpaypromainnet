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
        if (y < 32) {
          setVisible(true);
        } else if (dy > threshold) {
          setVisible(false);
        } else if (dy < -threshold) {
          setVisible(true);
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
