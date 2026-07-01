import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Coins, Image as ImageIcon, ArrowLeftRight, Send, QrCode,
  Activity, Settings as SettingsIcon, Wallet, Moon, Sun, LogOut, Sparkles, Menu, X, CreditCard,
  Gift, ShieldCheck, ChevronLeft, ChevronDown, Globe, Gauge, PieChart, Users, ClipboardCheck,
  LayoutGrid, Grid3x3, MessageSquare, Facebook, Instagram, Youtube, Twitter, Rocket, BadgeCheck,
  ScrollText,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shortAddress } from "@/lib/wallet-utils";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

type Tile = { to: string; label: string; icon: typeof LayoutDashboard; external?: boolean };

const FEATURED: Tile[] = [
  { to: "/tokens/create", label: "App Studio", icon: Rocket },
  { to: "/topup", label: "Launchpad", icon: Sparkles },
  { to: "/settings", label: "KYC", icon: BadgeCheck },
];

const WALLET_SECTION: Tile[] = [
  { to: "/dashboard", label: "Balance", icon: Gauge },
  { to: "/tokens", label: "Tokens", icon: Coins },
  { to: "/nfts", label: "NFTs", icon: ImageIcon },
  { to: "/swap", label: "Swap", icon: ArrowLeftRight },
  { to: "/send", label: "Send", icon: Send },
  { to: "/receive", label: "Receive", icon: QrCode },
  { to: "/topup", label: "Top Up", icon: CreditCard },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/ledger", label: "Ledger", icon: ScrollText },
];

const MINING_SECTION: Tile[] = [
  { to: "/dashboard", label: "Balance Dashboard", icon: PieChart },
  { to: "/ousd", label: "Mining Rate", icon: Sparkles },
  { to: "/settings", label: "Referral Team", icon: Users },
  { to: "/settings", label: "Security Circle", icon: ShieldCheck },
  { to: "/testnet-reward", label: "Mainnet Checklist", icon: ClipboardCheck },
  { to: "/settings", label: "Roles", icon: BadgeCheck },
];

const ECOSYSTEM_SECTION: Tile[] = [
  { to: "/tokens", label: "Pi Apps", icon: LayoutGrid },
  { to: "/swap", label: "Pi Utilities", icon: Grid3x3 },
  { to: "/dashboard", label: "Wallet", icon: Wallet },
  { to: "/settings", label: "Chat", icon: MessageSquare },
];

void Gift; void LayoutDashboard; void SettingsIcon;

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const { data: activeWallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("display_name,username,avatar_url,pi_username").eq("id", user.id).maybeSingle()).data,
  });

  return (
    <div className="relative min-h-screen bg-background bg-hero-glow text-foreground">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl md:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Wallet className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold">OpenPay Pro</span>
        </Link>
        <button onClick={() => setMobileOpen((v) => !v)} className="rounded-xl border border-border bg-card p-2" aria-label="Toggle menu">
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-80 shrink-0 overflow-y-auto border-r border-border/60 bg-sidebar/60 backdrop-blur-xl md:flex md:flex-col">
          <SidebarInner activeWallet={activeWallet} userEmail={user.email ?? ""} profile={profile as any} />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="relative ml-0 flex h-full w-80 flex-col overflow-y-auto border-r border-border bg-sidebar shadow-2xl">
              <SidebarInner activeWallet={activeWallet} userEmail={user.email ?? ""} profile={profile as any} onClose={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:px-8 md:pt-8">
          <div key={pathname} className="animate-page-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

type SidebarProfile = { display_name?: string | null; username?: string | null; avatar_url?: string | null; pi_username?: string | null } | null | undefined;

function SidebarInner({ activeWallet, userEmail, profile, onClose }: { activeWallet: { name: string; address: string } | null | undefined; userEmail: string; profile?: SidebarProfile; onClose?: () => void }) {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [aboutOpen, setAboutOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/auth", replace: true });
  }

  const handle = profile?.username || profile?.pi_username || profile?.display_name || (userEmail ? userEmail.split("@")[0] : "user");

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-sidebar/80 px-4 py-3 backdrop-blur">
        <button onClick={onClose} className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ChevronLeft className="h-4 w-4" /> Menu
        </button>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="rounded-full p-2 hover:bg-sidebar-accent" aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button className="flex items-center gap-1 rounded-full px-2 py-1 text-xs hover:bg-sidebar-accent">
            <Globe className="h-3.5 w-3.5" /> EN <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Profile row */}
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
            <AvatarFallback className="bg-gradient-primary text-sm text-primary-foreground">
              {(handle[0] ?? "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">@{handle}</div>
            <div className="truncate text-xs text-muted-foreground">@{handle}</div>
          </div>
          <Link to="/settings" className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-sidebar-accent">
            View Profile
          </Link>
        </div>

        {/* Active wallet pill */}
        <div className="glass rounded-2xl p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Active wallet</span>
            <Link to="/settings" className="text-primary hover:underline">Manage</Link>
          </div>
          <div className="mt-1 truncate text-sm font-semibold">{activeWallet?.name ?? "No wallet"}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{shortAddress(activeWallet?.address ?? null)}</div>
        </div>

        {/* Featured Apps */}
        <Section title="Featured Apps" bare>
          <div className="grid grid-cols-3 gap-3">
            {FEATURED.map((t) => <TileLink key={t.label} tile={t} />)}
          </div>
        </Section>

        {/* Wallet */}
        <Section title="Wallet">
          <div className="grid grid-cols-4 gap-3">
            {WALLET_SECTION.map((t) => <TileLink key={t.label} tile={t} />)}
          </div>
        </Section>

        {/* Mining */}
        <Section title="Mining">
          <div className="grid grid-cols-4 gap-3">
            {MINING_SECTION.map((t) => <TileLink key={t.label} tile={t} />)}
          </div>
        </Section>

        {/* Pi Ecosystem */}
        <Section title="Pi Ecosystem">
          <div className="grid grid-cols-4 gap-3">
            {ECOSYSTEM_SECTION.map((t) => <TileLink key={t.label} tile={t} />)}
          </div>
        </Section>

        {/* About */}
        <div className="rounded-2xl border border-border/60 bg-card/40">
          <button onClick={() => setAboutOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
            About OpenPay <ChevronDown className={cn("h-4 w-4 transition-transform", aboutOpen && "rotate-180")} />
          </button>
          {aboutOpen && (
            <div className="px-4 pb-4 text-xs text-muted-foreground">
              OpenPay Pro — a Pi-native wallet for tokens, NFTs, and on-chain payments.
            </div>
          )}
        </div>

        {/* Social */}
        <div className="pt-2 text-center">
          <div className="mb-3 text-xs text-muted-foreground">Follow us on</div>
          <div className="flex items-center justify-center gap-4">
            <SocialIcon href="https://facebook.com" icon={Facebook} />
            <SocialIcon href="https://instagram.com" icon={Instagram} />
            <SocialIcon href="https://youtube.com" icon={Youtube} />
            <SocialIcon href="https://x.com" icon={Twitter} />
            <SocialIcon href="https://t.me" icon={Send} />
          </div>
          <div className="mt-3 text-[10px] text-muted-foreground">v1.0.0 (mainnet)</div>
        </div>

        {/* Sign out */}
        <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={signOut}>
          <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children, bare }: { title: string; children: ReactNode; bare?: boolean }) {
  return (
    <div className={cn(!bare && "rounded-2xl border border-border/60 bg-card/40 p-4")}>
      <div className={cn("mb-3 text-sm font-semibold", bare && "px-1")}>{title}</div>
      {children}
    </div>
  );
}

function TileLink({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  return (
    <Link to={tile.to} className="group flex flex-col items-center gap-1.5 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sidebar-accent/60 transition-all group-hover:bg-gradient-primary group-hover:text-primary-foreground group-hover:shadow-glow">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-[10px] font-medium leading-tight text-foreground/80">{tile.label}</div>
    </Link>
  );
}

function SocialIcon({ href, icon: Icon }: { href: string; icon: typeof Facebook }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-accent/60 hover:bg-sidebar-accent">
      <Icon className="h-4 w-4" />
    </a>
  );
}

