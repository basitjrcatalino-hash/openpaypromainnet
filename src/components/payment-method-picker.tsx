import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type PaymentMethodOption<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
  desc: string;
};

export function PaymentMethodPicker<T extends string>({
  methods,
  value,
  onChange,
  className,
}: {
  methods: PaymentMethodOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** @deprecated Ignored — picker follows app light/dark theme tokens */
  variant?: "default" | "dark";
}) {
  return (
    <div className={className}>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Payment method
      </div>
      <div className="space-y-2">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all",
              value === m.id
                ? "border-primary bg-primary/5 shadow-glow"
                : "border-border hover:bg-muted/50",
            )}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
              <m.icon className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">{m.label}</div>
              <div className="text-xs text-muted-foreground">{m.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
