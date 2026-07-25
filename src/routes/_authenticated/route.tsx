import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Wallet,
  Compass,
  Settings as SettingsIcon,
  Sparkles,
  LogOut,
  Menu,
  X,
  Plus,
  EyeOff,
  Eye,
  ChevronsUpDown,
  Moon,
  Sun,
  Copy,
  Check,
  History,
  CheckCircle2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shortAddress } from "@/lib/wallet-utils";
import { formatCurrency, useCurrency } from "@/lib/currency";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NotificationBell, NotificationCenter } from "@/components/notification-center";
import { useTransactionNotifications } from "@/hooks/use-transaction-notifications";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/authpi" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Wallet", icon: Wallet },
  { to: "/tokens/create", label: "Agent", icon: Sparkles },
  { to: "/tokens", label: "Explore", icon: Compass },
  { to: "/activity", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const hideChrome = pathname === "/scan";
  const [notifOpen, setNotifOpen] = useState(false);
  const txNotes = useTransactionNotifications(user.id);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("display_name,username,avatar_url,pi_username")
          .eq("id", user.id)
          .maybeSingle()
      ).data,
  });

  async function switchWallet(id: string) {
    if (id === activeWallet?.id) return;
    await supabase.from("wallets").update({ is_active: false }).eq("user_id", user.id);
    await supabase.from("wallets").update({ is_active: true }).eq("id", id);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["wallets", user.id] }),
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] }),
      qc.invalidateQueries({ queryKey: ["holdings"] }),
      qc.invalidateQueries({ queryKey: ["recent-txs"] }),
      qc.invalidateQueries({ queryKey: ["my-nfts"] }),
    ]);
    toast.success("Wallet switched");
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      {!hideChrome && (
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl md:hidden">
          <Link to="/dashboard" className="text-sm font-semibold tracking-tight">
            OpenPay Pro
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell unread={txNotes.unread} onOpen={() => setNotifOpen(true)} />
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-xl border border-border bg-card p-2"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </header>
      )}

      <div className={cn("mx-auto flex w-full", hideChrome ? "max-w-none" : "max-w-350")}>
        {!hideChrome && (
          <aside className="sticky top-0 hidden h-screen w-85 shrink-0 overflow-y-auto border-r border-border/60 p-4 md:flex md:flex-col">
            <SidebarInner
              wallets={wallets as any[]}
              activeWallet={activeWallet as any}
              profile={profile as any}
              pathname={pathname}
              onSwitchWallet={switchWallet}
              unread={txNotes.unread}
              onOpenNotifications={() => setNotifOpen(true)}
            />
          </aside>
        )}

        {mobileOpen && !hideChrome && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative flex h-full w-[320px] flex-col overflow-y-auto border-r border-border bg-background p-4 shadow-2xl">
              <SidebarInner
                wallets={wallets as any[]}
                activeWallet={activeWallet as any}
                profile={profile as any}
                pathname={pathname}
                onClose={() => setMobileOpen(false)}
                onSwitchWallet={switchWallet}
                unread={txNotes.unread}
                onOpenNotifications={() => {
                  setMobileOpen(false);
                  setNotifOpen(true);
                }}
              />
            </aside>
          </div>
        )}

        <main
          className={cn("min-w-0 flex-1", hideChrome ? "p-0" : "px-4 pb-24 pt-4 md:px-8 md:pt-6")}
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab nav */}
      {!hideChrome && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden">
          <div className="mx-auto grid max-w-md grid-cols-5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.to || (item.to === "/dashboard" && pathname === "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  preload="intent"
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors duration-100",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      <NotificationCenter
        open={notifOpen}
        onOpenChange={setNotifOpen}
        items={txNotes.items}
        onMarkAll={txNotes.markAll}
        onClear={txNotes.clearAll}
        onMarkOne={txNotes.markOneRead}
      />
    </div>
  );
}

function SidebarInner({
  wallets,
  activeWallet,
  profile,
  pathname,
  onClose,
  onSwitchWallet,
  unread = 0,
  onOpenNotifications,
}: {
  wallets: Array<{
    id: string;
    name: string;
    address: string;
    ousd_balance?: number | null;
    pi_balance?: number | null;
  }>;
  activeWallet?: {
    id: string;
    name: string;
    address: string;
    ousd_balance?: number | null;
    pi_balance?: number | null;
  };
  profile?: {
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    pi_username?: string | null;
  } | null;
  pathname: string;
  onClose?: () => void;
  onSwitchWallet: (id: string) => Promise<void>;
  unread?: number;
  onOpenNotifications?: () => void;
}) {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [hideBalance, setHideBalance] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { code: currency, cycle: cycleCurrency } = useCurrency();
  const [copied, setCopied] = useState(false);

  const { data: activeHoldings = [] } = useQuery({
    queryKey: ["holdings", activeWallet?.id],
    enabled: !!activeWallet?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("token_holdings")
        .select("balance, tokens:token_id(price_usd)")
        .eq("wallet_id", activeWallet!.id);
      return data ?? [];
    },
  });

  const holdingsUsd = (
    activeHoldings as Array<{ balance?: number; tokens?: { price_usd?: number } | null }>
  ).reduce((sum, h) => sum + Number(h.balance ?? 0) * Number(h.tokens?.price_usd ?? 0), 0);
  const ousdUsd = Number(activeWallet?.ousd_balance ?? 0);
  const totalUsd = holdingsUsd + ousdUsd;

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/authpi", replace: true });
  }

  async function copyAddress() {
    if (!activeWallet?.address) return;
    try {
      await navigator.clipboard.writeText(activeWallet.address);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function handleSwitch(id: string) {
    setSwitching(true);
    try {
      await onSwitchWallet(id);
      setSwitchOpen(false);
      onClose?.();
    } finally {
      setSwitching(false);
    }
  }

  const handle = profile?.username || profile?.pi_username || profile?.display_name || "wallet";

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Wallet selector */}
      <button
        type="button"
        onClick={() => setSwitchOpen(true)}
        className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-sm font-semibold hover:bg-card/80"
      >
        <span className="flex items-center gap-2">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setHideBalance((v) => !v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                setHideBalance((v) => !v);
              }
            }}
            className="grid h-6 w-6 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Toggle balance"
          >
            {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </span>
          <span className="truncate">{activeWallet?.name ?? "My Wallet"}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        {onClose && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onClose();
              }
            }}
            className="ml-2 text-xs text-muted-foreground"
          >
            ✕
          </span>
        )}
      </button>

      {/* Big balance card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-glow">
        <div className="absolute inset-0 opacity-40" aria-hidden>
          <div className="absolute -left-16 -top-10 h-48 w-48 rounded-full bg-mint blur-3xl" />
          <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-primary-glow blur-3xl" />
        </div>
        <div className="relative flex min-h-45 flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={cycleCurrency}
            className="flex items-center gap-2 text-4xl font-bold tracking-tight tabular-nums"
            aria-label="Change currency"
          >
            {hideBalance ? "••••" : formatCurrency(totalUsd, currency)}
            <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">
              {currency}
            </span>
          </button>
          <button
            type="button"
            onClick={copyAddress}
            className="mt-6 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] transition-colors hover:bg-white/20"
            aria-label="Copy wallet address"
          >
            <span className="opacity-80">◆ {shortAddress(activeWallet?.address ?? null)}</span>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3 opacity-80" />}
          </button>
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
              onClick={onClose}
              preload="intent"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-100",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
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
            type="button"
            disabled={switching}
            onClick={() => handleSwitch(w.id)}
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
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(
                  w.id === activeWallet?.id ? totalUsd : Number(w.ousd_balance ?? 0),
                  currency,
                )}
              </span>
              {w.id === activeWallet?.id && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
            </span>
          </button>
        ))}
        <Link
          to="/settings"
          onClick={onClose}
          className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary hover:bg-sidebar-accent/60"
        >
          <Plus className="h-4 w-4" /> Add Wallet
        </Link>
      </div>

      <div className="mt-auto space-y-2 pt-2">
        <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <span className="truncate">@{handle}</span>
          <div className="flex items-center gap-1">
            {onOpenNotifications && (
              <NotificationBell unread={unread} onOpen={onOpenNotifications} />
            )}
            <button
              type="button"
              onClick={toggle}
              className="rounded-full p-1.5 hover:bg-sidebar-accent"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={signOut}>
          <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
        </Button>
      </div>

      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Switch wallet</DialogTitle>
            <DialogDescription>Choose which wallet to use</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1">
            {wallets.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  disabled={switching}
                  onClick={() => handleSwitch(w.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left",
                    w.id === activeWallet?.id ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-primary text-sm font-bold text-primary-foreground">
                      {(w.name?.[0] ?? "W").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{w.name}</span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {shortAddress(w.address, 6, 4)}
                    </span>
                  </span>
                  {w.id === activeWallet?.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
