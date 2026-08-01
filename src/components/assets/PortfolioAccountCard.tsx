import { Link } from "@tanstack/react-router";
import { Briefcase, Landmark, Users, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCOUNT_LABELS, type AccountId } from "@/lib/account-transfer";

const ICONS: Record<AccountId, LucideIcon> = {
  funding: Briefcase,
  trading: Landmark,
  p2p: Users,
};

export function PortfolioAccountCard({
  account,
  valueLabel,
  hideBalance,
  className,
}: {
  account: AccountId;
  valueLabel: string;
  hideBalance?: boolean;
  className?: string;
}) {
  const Icon = ICONS[account];
  return (
    <Link
      to="/assets/$account"
      params={{ account }}
      className={cn(
        "flex min-w-[9.5rem] flex-1 flex-col gap-2 rounded-2xl border border-border/60 bg-card/80 px-3.5 py-3 press hover:bg-muted/40",
        className,
      )}
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="text-xs font-semibold text-muted-foreground">{ACCOUNT_LABELS[account]}</span>
      <span className="text-sm font-bold tabular-nums tracking-tight">
        {hideBalance ? "••••" : valueLabel}
      </span>
    </Link>
  );
}

export function PortfolioAccountRow({
  account,
  valueLabel,
  hideBalance,
}: {
  account: AccountId;
  valueLabel: string;
  hideBalance?: boolean;
}) {
  const Icon = ICONS[account];
  return (
    <Link
      to="/assets/$account"
      params={{ account }}
      className="flex items-center gap-3 px-4 py-3.5 press hover:bg-muted/40"
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">{ACCOUNT_LABELS[account]}</span>
        <span className="block text-sm text-muted-foreground">
          {hideBalance ? "••••" : valueLabel}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
