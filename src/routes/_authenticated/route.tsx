import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Coins, Image as ImageIcon, ArrowLeftRight, Send, QrCode,
  Activity, Settings as SettingsIcon, Wallet, Plus, Moon, Sun, LogOut, Sparkles, Menu, X, CreditCard, Gift, ShieldCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shortAddress } from "@/lib/wallet-utils";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tokens", label: "Tokens", icon: Coins },
  { to: "/nfts", label: "NFTs", icon: ImageIcon },
  { to: "/swap", label: "Swap", icon: ArrowLeftRight },
  { to: "/send", label: "Send", icon: Send },
  { to: "/receive", label: "Receive", icon: QrCode },
  { to: "/topup", label: "Top Up", icon: CreditCard },
  { to: "/ousd", label: "OUSD", icon: Sparkles },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];
// Keep imports referenced to avoid unused warnings
void Gift; void ShieldCheck;


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
      {/* mobile top bar */}
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
        {/* sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border/60 bg-sidebar/60 backdrop-blur-xl md:flex md:flex-col">
          <SidebarInner activeWallet={activeWallet} userEmail={user.email ?? ""} profile={profile as any} />
        </aside>

        {/* mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="relative ml-0 flex h-full w-72 flex-col border-r border-border bg-sidebar shadow-2xl">
              <SidebarInner activeWallet={activeWallet} userEmail={user.email ?? ""} profile={profile as any} />
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

function SidebarInner({ activeWallet, userEmail }: { activeWallet: { name: string; address: string } | null | undefined; userEmail: string }) {
  const { theme, toggle } = useTheme();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/auth", replace: true });
  }

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="flex h-full flex-col p-4">
      <Link to="/dashboard" className="mb-6 flex items-center gap-2 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
          <Wallet className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">OpenPay <span className="text-gradient">Pro</span></div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Wallet</div>
        </div>
      </Link>

      <div className="glass mb-4 rounded-2xl p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Active wallet</span>
          <Link to="/settings" className="text-primary hover:underline">Manage</Link>
        </div>
        <div className="mt-1 truncate text-sm font-semibold">{activeWallet?.name ?? "No wallet"}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{shortAddress(activeWallet?.address ?? null)}</div>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} icon={item.icon} active={isActive(item.to)}>{item.label}</NavLink>
        ))}
      </nav>

      <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
        <div className="flex items-center gap-2 px-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gradient-primary text-xs text-primary-foreground">
              {(userEmail[0] ?? "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 text-xs">
            <div className="truncate font-medium">{userEmail}</div>
            <div className="text-muted-foreground">Signed in</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={toggle}>
            {theme === "dark" ? <Sun className="mr-1.5 h-3.5 w-3.5" /> : <Moon className="mr-1.5 h-3.5 w-3.5" />}
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
          <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={signOut}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function NavLink({ to, icon: Icon, active, children }: { to: string; icon: typeof LayoutDashboard; active: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-gradient-primary text-primary-foreground shadow-glow"
          : "text-sidebar-foreground hover:bg-sidebar-accent",
      )}
    >
      <Icon className={cn("h-4 w-4", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
      <span>{children}</span>
      {active && <Plus className="ml-auto h-3 w-3 rotate-45 opacity-60" />}
    </Link>
  );
}
