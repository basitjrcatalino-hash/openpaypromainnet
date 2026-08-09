import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, Compass, LayoutGrid, Orbit, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/dashboard", label: "Home", icon: LayoutGrid },
  { to: "/exchange/explore", label: "Explore", icon: Compass },
  { to: "/exchange/orbit", label: "Orbit", icon: Orbit },
  { to: "/assets", label: "Assets", icon: PieChart },
] as const;

/**
 * OKX-style exchange tabbar: four destinations around a raised centre
 * Trade action. Rendered only while the app is in Exchange mode.
 */
export function ExchangeTabBar({
  pathname,
  hidden,
}: {
  pathname: string;
  hidden: boolean;
}) {
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  return (
    <nav
      className={cn(
        "ph-tabbar fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-out md:hidden",
        hidden ? "pointer-events-none translate-y-full" : "translate-y-0",
      )}
      aria-label="Exchange"
      aria-hidden={hidden}
    >
      <div
        className="relative mx-auto flex max-w-md items-center justify-around px-1"
        style={{ height: "var(--ph-tabbar-content)" }}
      >
        {left.map((t) => (
          <TabLink key={t.to} {...t} active={isActive(t.to)} />
        ))}

        <div className="flex h-full min-w-0 flex-1 items-start justify-center">
          <Link
            to="/trade"
            preload="intent"
            aria-label="Trade"
            className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 press"
          >
            <ArrowLeftRight className="h-6 w-6" strokeWidth={2.25} />
          </Link>
        </div>

        {right.map((t) => (
          <TabLink key={t.to} {...t} active={isActive(t.to)} />
        ))}
      </div>
    </nav>
  );
}

function TabLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof Compass;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      preload="intent"
      className={cn(
        "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 ph-tab-label press",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon
        className={cn("h-5 w-5 transition-[filter,opacity]", active && "ph-tab-icon-active")}
        strokeWidth={active ? 2.25 : 1.75}
      />
      <span className="px-0.5">{label}</span>
    </Link>
  );
}
