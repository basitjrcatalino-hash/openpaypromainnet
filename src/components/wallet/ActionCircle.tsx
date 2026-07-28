import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  icon?: LucideIcon;
  logoUrl?: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
};

export function ActionCircle({ label, icon: Icon, logoUrl, to, href, onClick, className }: Props) {
  const inner = (
    <>
      <span className={cn("ph-action-icon", logoUrl && "overflow-hidden p-0")}>
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : Icon ? (
          <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={1.75} />
        ) : null}
      </span>
      <span>{label}</span>
    </>
  );

  const cls = cn("ph-action", className);

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls} onClick={onClick}>
        {inner}
      </a>
    );
  }
  if (to) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (
      <Link to={to as any} search={{} as any} className={cls} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
