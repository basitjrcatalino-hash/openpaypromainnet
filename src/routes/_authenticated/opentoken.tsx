/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  Shield,
  BadgeCheck,
  CreditCard,
  Sparkles,
  ArrowLeftRight,
  Compass,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExploreDock } from "@/components/wallet/ExploreDock";
import { formatCurrency, useCurrency, type CurrencyCode } from "@/lib/currency";
import { formatPct } from "@/lib/wallet-utils";
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
  const { code: currency } = useCurrency();
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

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("wallets")
          .select("ousd_balance")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["ot-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("*")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        const { data: fallback } = await supabase
          .from("tokens")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        return fallback ?? [];
      }
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    let l = tokens as any[];
    if (q) {
      const qq = q.toLowerCase();
      l = l.filter(
        (t) => t.name?.toLowerCase().includes(qq) || t.symbol?.toLowerCase().includes(qq),
      );
    }
    return l;
  }, [tokens, q]);

  const trending = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const volDiff = Number(b.volume_24h ?? 0) - Number(a.volume_24h ?? 0);
      if (volDiff !== 0) return volDiff;
      return Math.abs(Number(b.change_24h ?? 0)) - Math.abs(Number(a.change_24h ?? 0));
    });
  }, [filtered]);

  const majors = useMemo(() => {
    const verified = filtered.filter((t) => t.is_verified || t.status === "graduated");
    const pool = verified.length > 0 ? verified : filtered;
    return [...pool].sort((a, b) => Number(b.market_cap ?? 0) - Number(a.market_cap ?? 0)).slice(0, 12);
  }, [filtered]);

  const exploreList = useMemo(() => {
    return [...filtered].sort((a, b) => Number(b.market_cap ?? 0) - Number(a.market_cap ?? 0));
  }, [filtered]);

  const ousdBal = Number(wallet?.ousd_balance ?? 0);
  const showWelcome = ousdBal <= 0 && !q;

  const listForTab =
    topTab === "home" ? null : topTab === "trade" ? trending : exploreList;

  return (
    <div className="ot-phantom relative mx-auto w-full max-w-lg animate-page-in md:max-w-2xl">
      {/* Phantom-style pill header */}
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

      {/* HOME tab — Phantom Explore Home */}
      {topTab === "home" && (
        <div className="space-y-8">
          {showWelcome && (
            <section className="flex flex-col items-center px-2 pt-4 text-center">
              <div className="relative mb-5 grid h-36 w-36 place-items-center">
                <div className="absolute inset-0 rounded-4xl bg-primary/20 blur-2xl" />
                <div className="relative grid h-28 w-28 place-items-center rounded-3xl bg-linear-to-br from-primary/40 via-primary/25 to-primary/10 shadow-glow">
                  <Sparkles className="h-12 w-12 text-primary" aria-hidden />
                </div>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Welcome to OpenPay Pro</h1>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                Add cash or crypto to start trading
              </p>
              <Button
                asChild
                className="mt-5 h-12 min-w-50 rounded-full bg-primary px-8 text-base font-bold text-primary-foreground"
              >
                <Link
                  to="/topup"
                  search={{
                    openpay_charge: undefined,
                    openpay_ref: undefined,
                    openpay_tx: undefined,
                    openpay_return: undefined,
                    openpay_cancel: undefined,
                  }}
                >
                  Add Funds
                </Link>
              </Button>
            </section>
          )}

          <TokenSection
            title="Trending"
            onTitleClick={() => setTopTab("trade")}
            loading={isLoading}
            tokens={trending}
            currency={currency}
            empty="No trending tokens yet"
          />

          <TokenSection
            title="Majors"
            loading={isLoading}
            tokens={majors}
            currency={currency}
            empty="No major tokens yet"
          />
        </div>
      )}

      {/* TRADE / EXPLORE — full lists */}
      {topTab !== "home" && (
        <div>
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-lg font-bold">
              {topTab === "trade" ? "Trending" : "Explore"}
            </h2>
            <Button asChild variant="ghost" size="sm" className="rounded-full text-primary">
              <Link to="/swap">OpenDEX</Link>
            </Button>
          </div>
          {isLoading ? (
            <TokenSkeleton count={8} />
          ) : (listForTab ?? []).length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">No tokens found</p>
              <Button asChild className="mt-4 rounded-full">
                <Link to="/opentoken/create">Create coin</Link>
              </Button>
            </div>
          ) : (
            <ul>
              {(listForTab ?? [])
                .filter((t: any) => t?.id)
                .map((t: any) => (
                  <TokenRow key={String(t.id)} token={t} currency={currency} />
                ))}
            </ul>
          )}
        </div>
      )}

      {/* Floating search + mint — Home / Trade / Explore */}
      <ExploreDock
        query={q}
        onQueryChange={setQ}
        searchOpen={searchOpen}
        onSearchOpenChange={setSearchOpen}
      />
    </div>
  );
}

function TokenSection({
  title,
  tokens,
  loading,
  currency,
  empty,
  onTitleClick,
}: {
  title: string;
  tokens: any[];
  loading: boolean;
  currency: CurrencyCode;
  empty: string;
  onTitleClick?: () => void;
}) {
  return (
    <section>
      {onTitleClick ? (
        <button
          type="button"
          onClick={onTitleClick}
          className="mb-1 flex items-center gap-0.5 px-1 text-left press"
        >
          <h2 className="text-lg font-bold">{title}</h2>
          <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
        </button>
      ) : (
        <h2 className="mb-1 px-1 text-lg font-bold">{title}</h2>
      )}
      {loading ? (
        <TokenSkeleton count={5} />
      ) : tokens.length === 0 ? (
        <p className="px-1 py-8 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul>
          {tokens
            .filter((t) => t?.id)
            .map((t) => (
              <TokenRow key={String(t.id)} token={t} currency={currency} />
            ))}
        </ul>
      )}
    </section>
  );
}

function TokenRow({ token: t, currency }: { token: any; currency: CurrencyCode }) {
  const change = Number(t.change_24h ?? 0);
  const price = Number(t.price_usd ?? 0);
  return (
    <li>
      <Link
        to="/opentoken/$tokenId"
        params={{ tokenId: t.id }}
        className="flex items-center gap-3 py-3 press"
      >
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
          {t.logo_url ? (
            <img src={t.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-primary/20 text-xs font-bold text-primary">
              {t.symbol?.slice(0, 2)}
            </div>
          )}
          {t.is_verified && (
            <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{t.name}</div>
          <div className="text-xs text-muted-foreground">{t.symbol}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[15px] font-semibold tabular-nums">
            {price > 0 ? formatCurrency(price, currency) : "—"}
          </div>
          <div
            className={cn(
              "text-xs font-semibold tabular-nums",
              change >= 0 ? "text-emerald-400" : "text-red-400",
            )}
          >
            {formatPct(change)}
          </div>
        </div>
      </Link>
    </li>
  );
}

function TokenSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className="h-11 w-11 rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-24 rounded bg-muted" />
            <div className="h-3 w-12 rounded bg-muted" />
          </div>
          <div className="space-y-1.5 text-right">
            <div className="ml-auto h-3.5 w-16 rounded bg-muted" />
            <div className="ml-auto h-3 w-12 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
