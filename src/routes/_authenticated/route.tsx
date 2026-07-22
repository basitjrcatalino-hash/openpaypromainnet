import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Wallet, Compass, Settings as SettingsIcon, Sparkles, LogOut, Menu, X, Plus,
  EyeOff, Eye, ChevronsUpDown, Moon, Sun,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatUSD, shortAddress } from "@/lib/wallet-utils";
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

const NAV = [
  { to: "/dashboard", label: "Wallet", icon: Wallet },
  { to: "/tokens/create", label: "Agent", icon: Sparkles },
  { to: "/tokens", label: "Explore", icon: Compass },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const activeWallet = wallets[0];

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("display_name,username,avatar_url,pi_username").eq("id", user.id).maybeSingle()).data,
  });

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl md:hidden">
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
        <aside className="sticky top-0 hidden h-screen w-[340px] shrink-0 overflow-y-auto border-r border-border/60 p-4 md:flex md:flex-col">
          <SidebarInner wallets={wallets as any[]} activeWallet={activeWallet as any} profile={profile as any} pathname={pathname} />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="relative flex h-full w-[320px] flex-col overflow-y-auto border-r border-border bg-background p-4 shadow-2xl">
              <SidebarInner wallets={wallets as any[]} activeWallet={activeWallet as any} profile={profile as any} pathname={pathname} onClose={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:px-8 md:pt-6">
          <div key={pathname} className="animate-page-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarInner({
  wallets, activeWallet, profile, pathname, onClose,
}: {
  wallets: Array<{ id: string; name: string; address: string }>;
  activeWallet?: { id: string; name: string; address: string };
  profile?: { display_name?: string | null; username?: string | null; avatar_url?: string | null; pi_username?: string | null } | null;
  pathname: string;
  onClose?: () => void;
}) {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [hideBalance, setHideBalance] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/auth", replace: true });
  }

  const handle = profile?.username || profile?.pi_username || profile?.display_name || "wallet";

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Wallet selector */}
      <button className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-sm font-semibold hover:bg-card/80">
        <span className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setHideBalance((v) => !v); }}
            className="grid h-6 w-6 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Toggle balance"
          >
            {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <span className="truncate">{activeWallet?.name ?? "My Wallet"}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        {onClose && <span onClick={onClose} className="ml-2 text-xs text-muted-foreground">✕</span>}
      </button>

      {/* Big balance card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-glow">
        <div className="absolute inset-0 opacity-40" aria-hidden>
          <div className="absolute -left-16 -top-10 h-48 w-48 rounded-full bg-mint blur-3xl" />
          <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-primary-glow blur-3xl" />
        </div>
        <div className="relative flex min-h-[180px] flex-col items-center justify-center gap-3">
          <div className="text-5xl font-bold tracking-tight tabular-nums">
            {hideBalance ? "••••" : formatUSD(0)}
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-mono text-[11px]">
            <span className="opacity-80">◆ {shortAddress(activeWallet?.address ?? null)}</span>
            <span className="opacity-40">·</span>
            <span className="opacity-80">≡ {shortAddress(activeWallet?.address ?? null, 4, 4)}</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="rounded-2xl border border-border/60 bg-card/40 p-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || (item.to === "/dashboard" && pathname === "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Wallet switcher list */}
      <div className="rounded-2xl border border-border/60 bg-card/40 p-2">
        {wallets.map((w) => (
          <button
            key={w.id}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left",
              w.id === activeWallet?.id ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <Avatar className="h-9 w-9">
                {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
                <AvatarFallback className="bg-gradient-mint text-xs font-bold text-mint-foreground">
                  {(w.name?.[0] ?? "W").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{w.name}</span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                  ◆ {shortAddress(w.address, 4, 4)}
                </span>
              </span>
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatUSD(0)}</span>
          </button>
        ))}
        <Link
          to="/settings"
          className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary hover:bg-sidebar-accent/60"
        >
          <Plus className="h-4 w-4" /> Add Wallet
        </Link>
      </div>

      <div className="mt-auto space-y-2 pt-2">
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span className="truncate">@{handle}</span>
          <button onClick={toggle} className="rounded-full p-1.5 hover:bg-sidebar-accent" aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={signOut}>
          <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
        </Button>
      </div>
    </div>
  );
}
