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
  LogOut,
  Menu,
  X,
  Plus,
  EyeOff,
  Eye,
  ChevronsUpDown,
  Moon,
  Sun,
  History,
  CheckCircle2,
  ScrollText,
  BookOpen,
  CircleDollarSign,
  CreditCard,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listUserWallets, shortAddress } from "@/lib/wallet-utils";
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
import { WalletBalanceHero } from "@/components/wallet/WalletBalanceHero";
import { ChromeVisibleProvider } from "@/hooks/chrome-visible";
import { useChromeScroll } from "@/hooks/use-chrome-scroll";

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
  { to: "/tokens", label: "Tokens", icon: CircleDollarSign },
  { to: "/opentoken", label: "Home", icon: Compass },
  { to: "/activity", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function navActive(pathname: string, to: string) {
  return (
    pathname === to ||
    (to === "/dashboard" && pathname === "/") ||
    (to === "/tokens" &&
      (pathname.startsWith("/tokens") || pathname.startsWith("/asset/"))) ||
    (to === "/opentoken" &&
      pathname.startsWith("/opentoken") &&
      !pathname.startsWith("/opentoken/create"))
  );
}

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const hideChrome = pathname === "/scan";
  const chromeVisible = useChromeScroll(10, pathname);
  const [notifOpen, setNotifOpen] = useState(false);
  const txNotes = useTransactionNotifications(user.id);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets", user.id],
    queryFn: () => listUserWallets(supabase, user.id, "*"),
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
    <ChromeVisibleProvider value={hideChrome ? true : chromeVisible}>
      <div className="relative min-h-screen bg-background text-foreground">
        {!hideChrome && (
          <>
            <header
              className={cn(
                "ph-header safe-pt fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-border/40 px-4 py-3 transition-transform duration-300 ease-out md:hidden",
                chromeVisible ? "translate-y-0" : "-translate-y-full pointer-events-none",
              )}
            >
              <Link to="/dashboard" className="text-sm font-bold tracking-tight">
                OpenPay Pro
              </Link>
              <div className="flex items-center gap-1.5">
                <NotificationBell unread={txNotes.unread} onOpen={() => setNotifOpen(true)} />
                <button
                  onClick={() => setMobileOpen((v) => !v)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground press"
                  aria-label="Toggle menu"
                >
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </header>
            {/* Spacer matches fixed mobile header height */}
            <div
              className="md:hidden"
              style={{ height: "calc(3.25rem + env(safe-area-inset-top, 0px))" }}
              aria-hidden
            />
          </>
        )}

        <div className={cn("mx-auto flex w-full", hideChrome ? "max-w-none" : "max-w-350")}>
          {!hideChrome && (
            <aside className="sticky top-0 hidden h-screen w-80 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 md:flex md:flex-col">
              <SidebarInner
                wallets={wallets}
                activeWallet={activeWallet}
                profile={profile}
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
                className="absolute inset-0 bg-background/70 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
              />
              <aside className="relative flex h-full w-75 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 shadow-2xl">
                <SidebarInner
                  wallets={wallets}
                  activeWallet={activeWallet}
                  profile={profile}
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
            className={cn(
              "ot-phantom min-w-0 flex-1",
              hideChrome ? "p-0" : "safe-pb px-4 pt-2 md:px-8 md:pb-8 md:pt-6",
            )}
          >
            <Outlet />
          </main>
        </div>

        {!hideChrome && (
          <nav
            className={cn(
              "ph-tabbar fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out md:hidden",
              chromeVisible ? "translate-y-0" : "translate-y-full",
            )}
            aria-label="Primary"
          >
            <div
              className="mx-auto grid max-w-md grid-cols-5 items-center px-1"
              style={{ height: "var(--ph-tabbar-content)" }}
            >
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = navActive(pathname, item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    preload="intent"
                    className={cn(
                      "flex h-full flex-col items-center justify-center gap-1 ph-tab-label press",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-12 place-items-center rounded-full transition-colors",
                        active && "bg-primary/15",
                      )}
                    >
                      <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={active ? 2 : 1.75} />
                    </span>
                    <span className="px-0.5">{item.label}</span>
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
    </ChromeVisibleProvider>
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
    <div className="flex min-h-full flex-col gap-5">
      <button
        type="button"
        onClick={() => setSwitchOpen(true)}
        className="flex shrink-0 items-center justify-between gap-2 rounded-2xl px-2 py-2 text-sm font-semibold hover:bg-muted/50 press"
      >
        <span className="flex min-w-0 items-center gap-2">
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
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Toggle balance"
          >
            {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </span>
          <span className="truncate">{activeWallet?.name ?? "My Wallet"}</span>
        </span>
        <span className="flex items-center gap-1">
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
              className="ml-1 grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </span>
          )}
        </span>
      </button>

      <WalletBalanceHero
        balanceLabel={formatCurrency(totalUsd, currency)}
        addressLabel={shortAddress(activeWallet?.address ?? null)}
        hideBalance={hideBalance}
        copied={copied}
        onCycleCurrency={cycleCurrency}
        onCopyAddress={copyAddress}
        className="py-2"
      />

      <nav className="space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = navActive(pathname, item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              preload="intent"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold press",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-0.5">
        <Link
          to="/wc-pay"
          onClick={onClose}
          preload="intent"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold press",
            pathname === "/wc-pay" || pathname.startsWith("/wc-pay")
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <CreditCard className="h-5 w-5" />
          WC Pay
        </Link>
        <Link
          to="/metamask"
          onClick={onClose}
          preload="intent"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold press",
            pathname === "/metamask" || pathname.startsWith("/metamask")
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <Wallet className="h-5 w-5" />
          MetaMask
        </Link>
        <Link
          to="/ledger"
          onClick={onClose}
          preload="intent"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold press",
            pathname === "/ledger"
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <ScrollText className="h-5 w-5" />
          Ledger API
        </Link>
        <a
          href="/docs/openpay"
          target="_blank"
          rel="noreferrer"
          onClick={onClose}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground press"
        >
          <BookOpen className="h-5 w-5" />
          OpenPay Docs
        </a>
      </div>

      <div className="ph-group p-1.5">
        {wallets.map((w) => (
          <button
            key={w.id}
            type="button"
            disabled={switching}
            onClick={() => handleSwitch(w.id)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left press",
              w.id === activeWallet?.id ? "bg-primary/10" : "hover:bg-muted/50",
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <Avatar className="h-9 w-9">
                {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
                <AvatarFallback className="bg-primary/20 text-xs font-bold text-primary">
                  {(w.name?.[0] ?? "W").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{w.name}</span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                  {shortAddress(w.address, 4, 4)}
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
          className="mt-0.5 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
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
              className="rounded-full p-1.5 hover:bg-muted press"
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
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start rounded-xl text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
        </Button>
      </div>

      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-border/60 bg-card">
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
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left press",
                    w.id === activeWallet?.id ? "bg-primary/15" : "hover:bg-muted/60",
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/20 text-sm font-bold text-primary">
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
