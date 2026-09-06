import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Sticky liquid-glass header + large title, iOS style. */
export function IosPageShell({
  title,
  subtitle,
  onBack,
  backLabel = "Back",
  headerRight,
  children,
  className,
}: Props) {
  return (
    <div className={cn("min-h-[70vh] bg-ios-bg pb-16", className)}>
      <div className="ios-liquid-header sticky top-0 z-30 border-b border-ios-separator">
        <div className="mx-auto flex h-12 w-full max-w-lg items-center justify-between px-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="ios-active -ml-1.5 inline-flex items-center gap-0.5 text-[17px] font-medium text-ios-blue"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
              {backLabel}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3 text-ios-blue">{headerRight}</div>
        </div>
      </div>

      <div className="ios-page-enter mx-auto w-full max-w-lg px-4 pt-3">
        <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-0.03em] text-ios-label sm:text-[40px]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-[15px] text-ios-secondary">{subtitle}</p> : null}
        <div className="mt-4 space-y-5">{children}</div>
      </div>
    </div>
  );
}
