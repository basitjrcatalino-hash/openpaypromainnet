/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  Shield,
  CreditCard,
  ArrowLeftRight,
  Compass,
  Plus,
  Sparkles,
  MessageCircle,
  Star,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ExploreDock } from "@/components/wallet/ExploreDock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/opentoken")({
  head: () => ({ meta: [{ title: "Home — OpenPay Pro" }] }),
  component: OpenTokenHome,
});

type TopTab = "home" | "trade" | "explore";

const TOP_TABS: { id: TopTab; label: string; icon?: LucideIcon }[] = [
  { id: "home", label: "Home" },
  { id: "trade", label: "Trade", icon: ArrowLeftRight },
  { id: "explore", label: "Explore", icon: Compass },
];

function OpenTokenHome() {
  const { user } = Route.useRouteContext();
  const [topTab, setTopTab] = useState<TopTab>("home");
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: isStaff } = useQuery({
    queryKey: ["ot-is-staff", user.id],
    queryFn: async () => {
      const [{ data: a }, { data: m }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "moderator" }),
      ]);
      return !!(a || m);
    },
  });

  return (
    <div className="ot-phantom relative mx-auto flex w-full max-w-lg flex-col md:max-w-2xl">
      {/* Header — pill tabs only */}
      <div className="ph-header sticky top-0 z-30 -mx-4 px-3 pb-3 pt-2 md:mx-0 md:rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <Link
            to="/dashboard"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground press"
            aria-label="Wallet"
          >
            <CreditCard className="h-4 w-4" />
          </Link>

          {TOP_TABS.map((tab) => {
            const active = topTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTopTab(tab.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold press",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
                {tab.label}
              </button>
            );
          })}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link
              to="/opentoken/terminal"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground press"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Terminal
            </Link>
            <Link
              to="/opentoken/portfolio"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground press"
              aria-label="Portfolio"
            >
              <Wallet className="h-4 w-4" />
            </Link>
            {isStaff && (
              <Link
                to="/opentoken/admin"
                className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground press"
                aria-label="Admin"
              >
                <Shield className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Body — buttons only (no token cards / list rows) */}
      <div className="flex flex-1 flex-col justify-center gap-3 px-1 pb-28 pt-6">
        {topTab === "home" && (
          <>
            <p className="mb-2 text-center text-sm text-muted-foreground">
              OpenToken · pick an action
            </p>
            <ActionButton to="/topup" label="Add Funds" primary />
            <ActionButton to="/swap" label="OpenDEX Swap" icon={ArrowLeftRight} />
            <ActionButton to="/opentoken/create" label="Create coin" icon={Plus} />
            <ActionButton to="/opentoken/terminal" label="Terminal" icon={Sparkles} />
            <ActionButton to="/opentoken/portfolio" label="Portfolio" icon={Wallet} />
            <ActionButton to="/watchlist" label="Watchlist" icon={Star} />
            <ActionButton to="/chat" label="Live Chat" icon={MessageCircle} />
          </>
        )}

        {topTab === "trade" && (
          <>
            <p className="mb-2 text-center text-sm text-muted-foreground">Trade</p>
            <ActionButton to="/opentoken/terminal" label="Open Terminal" primary icon={Sparkles} />
            <ActionButton to="/swap" label="OpenDEX Swap" icon={ArrowLeftRight} />
            <ActionButton to="/opentoken/create" label="Create coin" icon={Plus} />
            <ActionButton to="/opentoken/portfolio" label="Portfolio" icon={Wallet} />
          </>
        )}

        {topTab === "explore" && (
          <>
            <p className="mb-2 text-center text-sm text-muted-foreground">Explore</p>
            <ActionButton to="/opentoken/terminal" label="Browse Terminal" primary icon={Compass} />
            <ActionButton to="/watchlist" label="Watchlist" icon={Star} />
            <ActionButton to="/chat" label="Live Chat" icon={MessageCircle} />
            <ActionButton to="/wiki" label="OpenPay Wiki" icon={Compass} />
          </>
        )}
      </div>

      {/* Footer dock — search + mint (buttons, not cards) */}
      <ExploreDock
        query={q}
        onQueryChange={setQ}
        searchOpen={searchOpen}
        onSearchOpenChange={setSearchOpen}
      />
    </div>
  );
}

function ActionButton({
  to,
  label,
  primary,
  icon: Icon,
}: {
  to: string;
  label: string;
  primary?: boolean;
  icon?: LucideIcon;
}) {
  const topupSearch =
    to === "/topup"
      ? {
          openpay_charge: undefined,
          openpay_ref: undefined,
          openpay_tx: undefined,
          openpay_return: undefined,
          openpay_cancel: undefined,
        }
      : undefined;

  return (
    <Link
      to={to}
      search={topupSearch}
      className={cn(
        "flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-bold press",
        primary
          ? "bg-primary text-primary-foreground shadow-[0_12px_32px_-16px_hsl(var(--primary))]"
          : "bg-muted text-foreground hover:bg-muted/80",
      )}
    >
      {Icon ? <Icon className="h-5 w-5" strokeWidth={2.1} /> : null}
      {label}
    </Link>
  );
}
