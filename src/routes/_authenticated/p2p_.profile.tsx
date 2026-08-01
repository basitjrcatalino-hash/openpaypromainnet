import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  ChevronRight,
  CreditCard,
  FileText,
  Headset,
  HelpCircle,
  Loader2,
  Lock,
  Scale,
  Settings,
  Shield,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";

import { MerchantAvatar } from "@/components/p2p/P2pUi";
import { P2pHubLayout, P2pHubPill, P2pMenuCard } from "@/components/p2p/P2pSubpage";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, useCurrency } from "@/lib/currency";
import {
  formatAvgPayTime,
  formatPositiveRate,
  fetchLockedEscrow,
  fetchRatingStats,
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
  {
    to: "/p2p/payment-ads",
    icon: CreditCard,
    label: "Payment / Ads",
    desc: "Receive methods & offers",
  },
  { to: "/p2p/settings", icon: Settings, label: "Settings", desc: "Alerts & P2P preferences" },
  { to: "/p2p/reviews", icon: Star, label: "Reviews / Orders", desc: "Stats & completed trades" },
  { to: "/p2p/support", icon: Headset, label: "Customer support", desc: "Disputes & help" },
  {
    to: "/p2p/merchant",
    icon: Sparkles,
    label: "Merchant program",
    desc: "Apply · badges · featured",
  },
  {
    to: "/p2p/guide",
    icon: HelpCircle,
    label: "How to use P2P",
    desc: "Step-by-step escrow guide",
  },
  { to: "/p2p/rules", icon: Scale, label: "Trading rules", desc: "Notes · payment · prohibited" },
  {
    to: "/p2p/security",
    icon: Lock,
    label: "Safety & protection",
    desc: "Buyer/seller scam notes",
  },
  {
    to: "/p2p/agreement",
    icon: FileText,
    label: "Agreement · Terms · Privacy",
    desc: "P2P legal pack",
  },
  { to: "/p2p/api", icon: Shield, label: "P2P / Ledger API", desc: "Developer endpoints" },
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
        .select("id, ousd_balance")
        .eq("user_id", userId as string)
        .order("is_active", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const p2pBalQ = useQuery({
    queryKey: ["p2p-account-balances", walletQ.data?.id],
    enabled: !!walletQ.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_account_balances")
        .select("asset, balance")
        .eq("wallet_id", walletQ.data!.id)
        .eq("account", "p2p");
      if (error) {
        // Table/RPC not applied yet — fall back to funding OUSD so the page still loads.
        if (/wallet_account_balances|schema cache|does not exist/i.test(error.message)) {
          return { OUSD: Number(walletQ.data?.ousd_balance ?? 0) } as Record<string, number>;
        }
        throw error;
      }
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        map[String(row.asset).toUpperCase()] = Number(row.balance ?? 0) || 0;
      }
      return map;
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
  const ratingQ = useQuery({
    queryKey: ["p2p-rating-stats-self", userId],
    enabled: !!userId,
    queryFn: async () => {
      const map = await fetchRatingStats([userId as string]);
      return map[userId as string];
    },
  });

  const name =
    profileQ.data?.display_name ||
    profileQ.data?.username ||
    userQ.data?.email?.split("@")[0] ||
    "Trader";
  const joinedAt = profileQ.data?.created_at || userQ.data?.created_at || null;
  const ousd = Number(p2pBalQ.data?.OUSD ?? walletQ.data?.ousd_balance ?? 0);
  const lockedOusd = Number(lockedQ.data?.OUSD ?? 0);
  const st = statsQ.data;
  const rt = ratingQ.data;
  const emailVerified = !!userQ.data?.email_confirmed_at || !!userQ.data?.email;

  if (userQ.isLoading || profileQ.isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <P2pHubLayout
      title={name}
      dek={`Joined ${joinedAt ? new Date(joinedAt).toLocaleDateString() : "—"}${
        emailVerified ? " · Email verified" : ""
      }`}
      backTo="/p2p"
      crumb="Profile"
      eyebrow="Your P2P hub"
      hero={{ from: "#ddd6fe", to: "#c4b5fd", glyph: name.slice(0, 1).toUpperCase() }}
      actions={
        <>
          <P2pHubPill to="/p2p/orders" primary>
            Order history
          </P2pHubPill>
          <P2pHubPill to="/p2p/wallet">Merchant wallet</P2pHubPill>
          {emailVerified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-foreground">
              <BadgeCheck className="h-4 w-4" /> Verified
            </span>
          ) : null}
        </>
      }
    >
      <div className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5">
        {profileQ.data?.avatar_url ? (
          <img
            src={profileQ.data.avatar_url}
            alt=""
            className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <MerchantAvatar name={name} size="lg" online />
        )}
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tracking-tight">{name}</p>
          <p className="text-sm text-muted-foreground">
            Marketplace reputation, funds, and guides in one place.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <P2pMenuCard>
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              My P2P funds
            </h2>
            <Link to="/p2p/wallet" className="text-sm font-semibold text-primary">
              View more →
            </Link>
          </div>
          <div className="space-y-1 px-5 py-3">
            <Row
              label="Available"
              value={`≈ ${formatCurrency(ousd, fiat as never, { compact: false })}`}
            />
            <Row label="Locked" value={`${fmtAmount(lockedOusd)} OUSD`} />
          </div>
        </P2pMenuCard>

        <P2pMenuCard>
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Info
            </h2>
            <Link to="/p2p/reviews" className="text-sm font-semibold text-primary">
              View more →
            </Link>
          </div>
          <div className="space-y-1 px-5 py-3">
            <Row label="Completed orders" value={String(st?.completed_count ?? 0)} />
            <Row
              label="Completion rate"
              value={
                st?.completion_rate == null ? "N/A" : `${Number(st.completion_rate).toFixed(2)}%`
              }
            />
            <Row label="Avg. payment time" value={formatAvgPayTime(st?.avg_pay_seconds)} />
            <Row label="Positive reviews" value={formatPositiveRate(rt?.positive_rate)} />
          </div>
        </P2pMenuCard>
      </div>

      <P2pMenuCard>
        {MENU.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 border-b border-border px-5 py-4 transition hover:bg-muted last:border-b-0"
          >
            <item.icon className={cn("h-5 w-5 text-muted-foreground")} strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold tracking-tight">{item.label}</span>
              <span className="block text-sm text-muted-foreground">{item.desc}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </P2pMenuCard>
    </P2pHubLayout>
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
