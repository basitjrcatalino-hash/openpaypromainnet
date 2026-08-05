import { Link } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  ArrowDownToLine,
  CreditCard,
  Users,
  Wallet,
  ChevronRight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** OKX-style fund / transfer bottom sheet from Available (+). */
export function FundAccountSheet({
  open,
  onOpenChange,
  asset = "USDT",
  mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset?: string;
  mode: "spot" | "futures";
}) {
  const toBucket = mode === "futures" ? "trading" : "spot";

  const items = [
    {
      icon: ArrowLeftRight,
      title: "Transfer funds",
      desc: "Transfer funds between funding and trading accounts.",
      to: "/transfer" as const,
      search: { from: "funding" as const, to: toBucket, asset },
    },
    {
      icon: ArrowDownToLine,
      title: "Deposit crypto",
      desc: "Transfer crypto from an on-chain wallet or exchange.",
      to: "/deposit" as const,
      search: undefined,
    },
    {
      icon: Users,
      title: "P2P trading",
      desc: "Buy/sell with zero fees via 100+ payment methods.",
      to: "/p2p" as const,
      search: undefined,
    },
    {
      icon: CreditCard,
      title: "Buy crypto",
      desc: "Buy crypto using your preferred payment method.",
      to: "/topup" as const,
      search: undefined,
    },
    {
      icon: Wallet,
      title: "Open wallet",
      desc: "View balances across Funding, Spot, Futures, and P2P.",
      to: "/wallet" as const,
      search: undefined,
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl border-border/50 px-0 pb-8 pt-3">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <SheetHeader className="px-4 pb-2 text-left">
          <SheetTitle className="text-base font-bold">Add funds</SheetTitle>
        </SheetHeader>
        <ul className="divide-y divide-border/40">
          {items.map((item) => (
            <li key={item.title}>
              <Link
                to={item.to}
                search={item.search}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-3 px-4 py-3.5 press hover:bg-muted/30"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted/60">
                  <item.icon className="h-4.5 w-4.5 text-foreground" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {item.desc}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </Link>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
