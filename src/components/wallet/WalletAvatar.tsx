import { cn } from "@/lib/utils";
import { walletGradient } from "@/lib/wallet-portfolio";

type Props = {
  address?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
  active?: boolean;
  className?: string;
};

const SIZE = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-11 w-11 text-sm",
} as const;

export function WalletAvatar({
  address,
  name,
  size = "md",
  active = false,
  className,
}: Props) {
  const safeAddress = address ?? "";
  const [from, to] = walletGradient(safeAddress);
  const initial = (name?.trim()?.[0] || safeAddress.slice(2, 3) || "W").toUpperCase();

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full font-bold text-white shadow-sm",
        SIZE[size],
        active && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
      }}
      aria-hidden
    >
      {initial}
    </span>
  );
}
