import { useEffect, useState } from "react";

const SESSION_KEY = "openpay_splash_shown";

export function SplashScreen() {
  // Always start false on server + first client paint to avoid hydration mismatch.
  const [shown, setShown] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    setShown(true);
    const t1 = setTimeout(() => setFading(true), 280);
    const t2 = setTimeout(() => setShown(false), 480);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!shown) return null;

  return (
    <div
      aria-hidden
      style={{ transition: "opacity 200ms ease" }}
      className={`fixed inset-0 z-100 grid place-items-center bg-background bg-hero-glow ${fading ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <div className="text-xl font-bold tracking-tight">OpenPay Pro</div>
          <div className="mt-1 text-xs uppercase tracking-[0.4em] text-muted-foreground">
            Wallet
          </div>
        </div>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 rounded-full bg-gradient-primary animate-splash-bar" />
        </div>
      </div>
    </div>
  );
}
