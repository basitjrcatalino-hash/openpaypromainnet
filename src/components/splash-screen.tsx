import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";

const SESSION_KEY = "openpay_splash_shown";

export function SplashScreen() {
  const [shown, setShown] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem(SESSION_KEY);
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!shown) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    const t1 = setTimeout(() => setFading(true), 900);
    const t2 = setTimeout(() => setShown(false), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [shown]);

  if (!shown) return null;

  return (
    <div
      aria-hidden
      style={{ transition: "opacity 600ms ease" }}
      className={`fixed inset-0 z-[100] grid place-items-center bg-background bg-hero-glow ${fading ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-primary text-primary-foreground shadow-glow">
          <Wallet className="h-9 w-9" strokeWidth={2.4} />
        </div>
        <div className="text-center">
          <div className="text-xl font-bold tracking-tight">
            OpenPay <span className="text-gradient">Pro</span>
          </div>
          <div className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Wallet</div>
        </div>
        <div className="mt-3 h-1 w-40 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 rounded-full bg-gradient-primary animate-splash-bar" />
        </div>
      </div>
    </div>
  );
}
