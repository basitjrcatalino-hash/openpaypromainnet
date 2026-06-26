import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";

export function SplashScreen() {
  const [hidden, setHidden] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1100);
    const t2 = setTimeout(() => setHidden(true), 1700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (hidden) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] grid place-items-center bg-background bg-hero-glow transition-opacity duration-500 ${fading ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <div className="flex flex-col items-center gap-5 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-3xl bg-gradient-primary opacity-40" />
          <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-primary text-primary-foreground shadow-glow animate-scale-in">
            <Wallet className="h-9 w-9" strokeWidth={2.4} />
          </div>
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
