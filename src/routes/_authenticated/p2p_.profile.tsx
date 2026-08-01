import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  ChevronRight,
  CreditCard,
  Headset,
  HelpCircle,
  Loader2,
  Lock,
  Settings,
  Shield,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";

import { MerchantAvatar } from "@/components/p2p/P2pUi";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  formatAvgPayTime,
  fetchLockedEscrow,
  fetchTraderStats,
  fmtAmount,
} from "@/lib/p2p";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/p2p_/profile")({
  head: () => ({
    meta: [
      { title: "P2P Profile — OpenPay Pro" },
      { name: "description", content: "Your P2P reputation, funds and settings." },
      { property: "og:title", content: "P2P Profile — OpenPay Pro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: P2pProfilePage,
});

const MENU = [
  { to: "/p2p/wallet", icon: Wallet, label: "Merchant wallet", desc: "Funds for escrow" },
  { to: "/p2p/payment-ads", icon: CreditCard, label: "Payment / Ads", desc: "Receive methods & offers" },
  { to: "/p2p/settings", icon: Settings, label: "Settings", desc: "Alerts & P2P preferences" },
  { to: "/p2p/reviews", icon: Star, label: "Reviews / Orders", desc: "Stats & completed trades" },
  { to: "/p2p/support", icon: Headset, label: "Customer support", desc: "Disputes & help" },
  { to: "/p2p/merchant", icon: Sparkles, label: "Become a Super Merchant", desc: "Merchant program" },
  { to: "/p2p/guide", icon: HelpCircle, label: "Learn how P2P works", desc: "Escrow guide" },
  { to: "/p2p/api", icon: Shield, label: "P2P / Ledger API", desc: "Developer endpoints" },
  { to: "/p2p/security", icon: Lock, label: "Security", desc: "Safety checklist" },
] as const;

function P2pProfilePage() {
  const { code: fiat } = useCurrency();

  const userQ = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const userId = userQ.data?.id ?? null;

  const profileQ = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("display_name,username,avatar_url,created_at")
          .eq("id", userId as string)
          .maybeSingle()
      ).data,
  });
  const walletQ = useQuery({
    queryKey: ["active-wallet", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId as string)
        .order("is_active", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const lockedQ = useQuery({
    queryKey: ["p2p-locked", userId],
    enabled: !!userId,
    queryFn: () => fetchLockedEscrow(userId as string),
  });
  const statsQ = useQuery({
    queryKey: ["p2p-stats-self", userId],
    enabled: !!userId,
    queryFn: async () => {
      const map = await fetchTraderStats([userId as string]);
      return map[userId as string];
    },
  });

  const name =
    profileQ.data?.display_name ||
    profileQ.data?.username ||
    userQ.data?.email?.split("@")[0] ||
    "Trader";
  const joinedAt = profileQ.data?.created_at || userQ.data?.created_at || null;
  const ousd = Number(walletQ.data?.ousd_balance ?? 0);
  const lockedOusd = Number(lockedQ.data?.OUSD ?? 0);
  const st = statsQ.data;
  const emailVerified = !!userQ.data?.email_confirmed_at || !!userQ.data?.email;

  if (userQ.isLoading || profileQ.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <header
        className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border/40 bg-background/95 px-4 backdrop-blur-xl md:px-6"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <h1 className="text-lg font-extrabold tracking-tight">Profile</h1>
        <Link to="/p2p/orders" className="text-xs font-semibold text-muted-foreground">
          History
        </Link>
      </header>

      <div className="relative overflow-hidden px-4 pb-4 pt-6 md:px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="relative flex items-center gap-3">
          {profileQ.data?.avatar_url ? (
            <div className="relative">
              <img
                src={profileQ.data.avatar_url}
                alt=""
                className="h-14 w-14 rounded-full object-cover ring-2 ring-border/40"
              />
              <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-background bg-[#11C66D]" />
            </div>
          ) : (
            <MerchantAvatar name={name} size="lg" online />
          )}
          <div className="min-w-0">
            <p className="truncate text-xl font-extrabold">{name}</p>
            <p className="text-xs text-muted-foreground">
              Joined {joinedAt ? new Date(joinedAt).toLocaleDateString() : "—"}
            </p>
            {emailVerified ? (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#11C66D]">
                <BadgeCheck className="h-3.5 w-3.5" /> Email verified
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <section className="mx-4 rounded-2xl border border-border/50 bg-card/40 p-4 md:mx-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">My P2P funds</h2>
          <Link to="/p2p/wallet" className="text-xs font-semibold text-muted-foreground">
            View more ›
          </Link>
        </div>
        <Row
          label="Available"
          value={`≈ ${formatCurrency(ousd, fiat as never, { compact: false })}`}
        />
        <Row label="Locked" value={`${fmtAmount(lockedOusd)} OUSD`} />
      </section>

      <section className="mx-4 mt-3 rounded-2xl border border-border/50 bg-card/40 p-4 md:mx-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">Info</h2>
          <Link to="/p2p/reviews" className="text-xs font-semibold text-muted-foreground">
            View more ›
          </Link>
        </div>
        <Row label="Total completed orders" value={String(st?.completed_count ?? 0)} />
        <Row
          label="Completion rate (%)"
          value={
            st?.completion_rate == null ? "N/A" : `${Number(st.completion_rate).toFixed(2)}%`
          }
        />
        <Row label="Avg. payment time" value={formatAvgPayTime(st?.avg_pay_seconds)} />
        <Row
          label="Positive reviews (%)"
          value={(st?.completed_count ?? 0) > 0 ? "100%" : "N/A"}
        />
      </section>

      <div className="mt-4 divide-y divide-border/40 border-y border-border/40">
        {MENU.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 md:px-6"
          >
            <item.icon className={cn("h-5 w-5 text-muted-foreground")} strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="block text-[11px] text-muted-foreground">{item.desc}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
