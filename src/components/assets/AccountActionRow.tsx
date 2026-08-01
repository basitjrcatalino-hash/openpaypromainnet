import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AccountAction = {
  label: string;
  icon: LucideIcon;
  to?: string;
  search?: Record<string, string>;
  onClick?: () => void;
};

export function AccountActionRow({ actions, className }: { actions: AccountAction[]; className?: string }) {
  return (
    <div className={cn("flex justify-around gap-2 px-1", className)}>
      {actions.map((a) => {
        const Icon = a.icon;
        const inner = (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Icon className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="text-xs font-semibold">{a.label}</span>
          </>
        );
        if (a.to) {
          return (
            <Link
              key={a.label}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to={a.to as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              search={(a.search ?? {}) as any}
              className="flex flex-col items-center gap-1.5 press"
            >
              {inner}
            </Link>
          );
        }
        return (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className="flex flex-col items-center gap-1.5 press"
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
