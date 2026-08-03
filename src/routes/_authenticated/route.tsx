import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Wallet,
  ArrowDownToLine,
  QrCode,
  ArrowUpFromLine,
  ArrowLeftRight,
  Compass,

  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  EyeOff,
  Eye,
  ChevronsUpDown,
  Moon,
  Sun,
  History,
  ScrollText,
  BookOpen,
  Users,
  CircleDollarSign,
  Layers,
  CandlestickChart,
  PanelLeftClose,
  PanelLeftOpen,
  Star,
  HelpCircle,
  MessageCircle,
  Bot,
  Sparkles,
  Code2,
  Gift,
  KeyRound,
  Newspaper,
  BookMarked,
  Globe2,
  Home,
  ChevronDown,
  ExternalLink,
  FileText,
  Shield,
  Scale,
  ScanLine,
  LayoutGrid,
} from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useDeveloperMode } from "@/hooks/use-developer-mode";


import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { listUserWallets, shortAddress } from "@/lib/wallet-utils";
import { formatCurrency, useCurrency } from "@/lib/currency";
import { PageTransition } from "@/components/wallet/PageTransition";
import { CurrencyProvider } from "@/components/currency-provider";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { NotificationBell, NotificationCenter } from "@/components/notification-center";
import { useTransactionNotifications } from "@/hooks/use-transaction-notifications";
import { useP2pOrderNotifications } from "@/hooks/use-p2p-order-notifications";
import { WalletBalanceHero } from "@/components/wallet/WalletBalanceHero";
import {
  WalletSwitcherDialog,
} from "@/components/wallet/WalletSwitcherDialog";
import { WalletAvatar } from "@/components/wallet/WalletAvatar";
import { CurrencyPickerSheet } from "@/components/wallet/CurrencyPickerSheet";
import { walletLedgerUsd } from "@/lib/wallet-portfolio";
import { fetchMajorMarkets } from "@/lib/major-tokens";
import { ChromeVisibleProvider, useChromeVisible } from "@/hooks/chrome-visible";
import { useChromeScroll } from "@/hooks/use-chrome-scroll";
import { P2pShell } from "@/components/p2p/P2pShell";
import { AppMoonPayProvider } from "@/components/moonpay-provider";
import { AppPhantomProvider } from "@/components/phantom-provider";
import { AppLockGate } from "@/components/app-lock-screen";
import { OPENPAY_AI_MENU_ICON } from "@/lib/openpay-auth";

/** Flip to true to show Bags Cash in nav and unlock /bags routes. */
const BAGS_CASH_ENABLED = false;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/authpi" });
    if (!BAGS_CASH_ENABLED && location.pathname.startsWith("/bags")) {
      throw redirect({ to: "/dashboard" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/dashboard", labelKey: "nav.home", icon: Compass },
  { to: "/assets", labelKey: "nav.assets", icon: Layers },
  { to: "/trade", labelKey: "nav.trade", icon: CandlestickChart },
  { to: "/deposit", labelKey: "nav.deposit", icon: ArrowDownToLine },
  { to: "/wallet/receive", labelKey: "nav.receive", icon: QrCode },
  { to: "/transfer", labelKey: "nav.transfer", icon: ArrowLeftRight },
  { to: "/withdraw", labelKey: "nav.withdraw", icon: ArrowUpFromLine },
  { to: "/tokens", labelKey: "nav.tokens", icon: CircleDollarSign },
  { to: "/opentoken", labelKey: "nav.openToken", icon: BookOpen },
  { to: "/p2p", labelKey: "nav.p2p", icon: Users },

  // Bags Cash hidden for now — re-enable via BAGS_CASH_ENABLED above.
  { to: "/activity", labelKey: "nav.history", icon: History },
  { to: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
] as const;

/** Resolve nav label; never show raw i18n keys like "nav.p2p". */
function navLabel(t: (key: string) => string, labelKey: string) {
  const translated = t(labelKey);
  if (translated !== labelKey) return translated;
  if (labelKey === "nav.p2p") return "P2P";
  if (labelKey === "nav.transfer") return "Transfer";
  if (labelKey === "nav.assets") return "Assets";
  if (labelKey === "nav.trade") return "Trade";
  if (labelKey === "nav.more") return "More";
  if (labelKey === "nav.discover") return "Discover";
  if (labelKey === "nav.withdraw") return "Withdraw";
  const leaf = labelKey.includes(".") ? labelKey.slice(labelKey.lastIndexOf(".") + 1) : labelKey;
  return leaf.charAt(0).toUpperCase() + leaf.slice(1);
}

/** Primary mobile tabs — 5 max. Deposit / P2P / History / OpenToken live in More. */
const FOOTER_TABS = [
  { to: "/dashboard", labelKey: "nav.home", icon: Compass },
  { to: "/assets", labelKey: "nav.assets", icon: Layers },
  { to: "/trade", labelKey: "nav.trade", icon: CandlestickChart },
  { to: "/tokens", labelKey: "nav.discover", icon: Sparkles },
] as const;

const MORE_NAV = [
  { to: "/deposit", labelKey: "nav.deposit", icon: ArrowDownToLine, desc: "Fund your wallet" },
  { to: "/wallet/receive", labelKey: "nav.receive", icon: QrCode, desc: "Show your QR & address" },
  { to: "/opentoken", labelKey: "nav.openToken", icon: BookOpen, desc: "Launch & trade coins" },
  { to: "/p2p", labelKey: "nav.p2p", icon: Users, desc: "Peer marketplace" },
  { to: "/activity", labelKey: "nav.history", icon: History, desc: "Transaction history" },
  { to: "/transfer", labelKey: "nav.transfer", icon: ArrowLeftRight, desc: "Move between accounts" },
  { to: "/withdraw", labelKey: "nav.withdraw", icon: ArrowUpFromLine, desc: "Cash out" },
  { to: "/settings", labelKey: "nav.settings", icon: SettingsIcon, desc: "Security & preferences" },
] as const;

function navActive(pathname: string, to: string) {
  return (
    pathname === to ||
    (to === "/dashboard" && pathname === "/") ||
    (to === "/assets" && pathname.startsWith("/assets")) ||
    (to === "/trade" && pathname.startsWith("/trade")) ||
    (to === "/wallet" && pathname.startsWith("/wallet")) ||
    (to === "/transfer" && pathname.startsWith("/transfer")) ||
    (to === "/tokens" &&
      (pathname.startsWith("/tokens") || pathname.startsWith("/asset/"))) ||
    (to === "/opentoken" &&
      pathname.startsWith("/opentoken") &&
      !pathname.startsWith("/opentoken/create")) ||
    (to === "/p2p" && pathname.startsWith("/p2p")) ||
    (to === "/deposit" && pathname.startsWith("/deposit")) ||
    (to === "/activity" && pathname.startsWith("/activity")) ||
    (to === "/withdraw" && pathname.startsWith("/withdraw")) ||
    (to === "/settings" && pathname.startsWith("/settings"))
  );
}

function moreNavActive(pathname: string) {
  return MORE_NAV.some((item) => navActive(pathname, item.to));
}

/** Mobile top bar — Home: Menu · Wallet · Scan · Bell */
function MobileAppHeader({
  isHome,
  mobileOpen,
  onToggleMenu,
  unread,
  onOpenNotifications,
  walletName,
  walletLoading,
  onOpenWalletSwitcher,
}: {
  isHome: boolean;
  mobileOpen: boolean;
  onToggleMenu: () => void;
  unread: number;
  onOpenNotifications: () => void;
  walletName?: string | null;
  walletLoading?: boolean;
  onOpenWalletSwitcher?: () => void;
}) {
  const chromeVisible = useChromeVisible();
  return (
    <header
      className={cn(
        "ph-header safe-pt fixed inset-x-0 top-0 z-40 grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-1 px-2 py-2 transition-transform duration-300 ease-out md:hidden",
        chromeVisible ? "translate-y-0" : "-translate-y-full pointer-events-none",
      )}
    >
      <button
        onClick={onToggleMenu}
        className="justify-self-start rounded-full p-2 text-primary press"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {isHome ? (
        <button
          type="button"
          onClick={onOpenWalletSwitcher}
          className="justify-self-center inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-1.5 text-[15px] font-semibold press hover:bg-muted/50"
        >
          {walletLoading && !walletName ? (
            <span className="h-4 w-24 animate-pulse rounded-full bg-muted" />
          ) : (
            <>
              <span className="truncate">{walletName ?? "Main Wallet"}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      ) : (
        <span className="pointer-events-none" aria-hidden />
      )}
      <div className="flex items-center justify-self-end gap-0.5">
        {isHome ? (
          <Link
            to="/scan"
            className="rounded-full p-2 text-primary press hover:bg-primary/10"
            aria-label="Scan QR code"
          >
            <ScanLine className="h-5 w-5" />
          </Link>
        ) : null}
        <NotificationBell unread={unread} onOpen={onOpenNotifications} />
      </div>
    </header>
  );
}

/** Mobile tabbar — 5 destinations: Home · Assets · Trade · Discover · More */
function MobileTabBar({
  pathname,
  mobileOpen,
  t,
}: {
  pathname: string;
  mobileOpen: boolean;
  t: (key: string) => string;
}) {
  const chromeVisible = useChromeVisible();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreNavActive(pathname);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        className={cn(
          "ph-tabbar fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-out md:hidden",
          chromeVisible && !mobileOpen ? "translate-y-0" : "translate-y-full",
          (!chromeVisible || mobileOpen) && "pointer-events-none",
          mobileOpen && "opacity-0",
        )}
        aria-label="Primary"
        aria-hidden={mobileOpen || !chromeVisible}
      >
        <div
          className="mx-auto flex max-w-md items-center justify-around px-1"
          style={{ height: "var(--ph-tabbar-content)" }}
        >
          {FOOTER_TABS.map((item) => {
            const Icon = item.icon;
            const active = navActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                preload="intent"
                className={cn(
                  "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 ph-tab-label press",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-[filter,opacity]",
                    active && "ph-tab-icon-active",
                  )}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className="px-0.5">{navLabel(t, item.labelKey)}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 ph-tab-label press",
              moreActive || moreOpen ? "text-primary" : "text-muted-foreground",
            )}
            aria-label={navLabel(t, "nav.more")}
            aria-expanded={moreOpen}
          >
            <LayoutGrid
              className={cn(
                "h-5 w-5 transition-[filter,opacity]",
                (moreActive || moreOpen) && "ph-tab-icon-active",
              )}
              strokeWidth={moreActive || moreOpen ? 2.25 : 1.75}
            />
            <span className="px-0.5">{navLabel(t, "nav.more")}</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[min(92dvh,640px)] flex-col gap-0 overflow-hidden rounded-t-3xl border-border/60 px-4 pb-0 pt-3 md:hidden"
        >
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" aria-hidden />
          <SheetHeader className="mb-3 shrink-0 space-y-1 pr-8 text-left">
            <SheetTitle className="text-lg font-bold tracking-tight">
              {navLabel(t, "nav.more")}
            </SheetTitle>
            <SheetDescription>Deposit, P2P, history, and settings</SheetDescription>
          </SheetHeader>
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {MORE_NAV.map((item) => {
              const Icon = item.icon;
              const active = navActive(pathname, item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    preload="intent"
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3.5 py-3 press",
                      active
                        ? "bg-primary/12 text-primary"
                        : "bg-muted/40 text-foreground hover:bg-muted/70",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                        active ? "bg-primary/15" : "bg-background/80",
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.85} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-bold tracking-tight">
                        {navLabel(t, item.labelKey)}
                      </span>
                      <span className="block text-xs text-muted-foreground">{item.desc}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const { t } = useTranslation();
  // Re-render the whole shell (Outlet, sidebar, sheets) when display currency changes
  useCurrency();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "1"; } catch { return false; }
  });
  const toggleSidebar = () => setSidebarCollapsed((v) => {
    const next = !v;
    try {
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
    } catch {
      /* ignore quota / private mode */
    }
    return next;
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const hideChrome =
    pathname === "/scan" ||
    pathname === "/trade" ||
    pathname.startsWith("/trade/") ||
    pathname === "/chat" ||
    pathname.startsWith("/chat/") ||
    /\/opentoken\/[^/]+\/chat\/?$/.test(pathname) ||
    /\/asset\/[^/]+\/chat\/?$/.test(pathname) ||
    pathname === "/opentoken/terminal" ||
    pathname.startsWith("/opentoken/terminal/") ||
    pathname.startsWith("/p2p");
  const isP2p = pathname.startsWith("/p2p");
  const isHome =
    pathname === "/dashboard" ||
    pathname === "/dashboard/" ||
    pathname === "/" ||
    pathname === "";
  const chromeVisible = useChromeScroll(10, pathname);
  const [notifOpen, setNotifOpen] = useState(false);
  const [headerSwitchOpen, setHeaderSwitchOpen] = useState(false);
  const [headerSwitching, setHeaderSwitching] = useState(false);
  const txNotes = useTransactionNotifications(user.id);
  useP2pOrderNotifications(user.id);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Clear Radix scroll locks that can block taps after leaving Trade / sheets
  useEffect(() => {
    const unlock = () => {
      try {
        document.body.style.removeProperty("pointer-events");
        document.body.style.removeProperty("overflow");
        document.body.removeAttribute("data-scroll-locked");
        document.documentElement.style.removeProperty("pointer-events");
      } catch {
        /* ignore */
      }
    };
    unlock();
    const t = window.setTimeout(unlock, 80);
    return () => window.clearTimeout(t);
  }, [pathname]);

  const { data: wallets = [], isLoading: walletsLoading } = useQuery({
    queryKey: ["wallets", user.id],
    queryFn: () => listUserWallets<Tables<"wallets">>(supabase, user.id, "*"),
  });

  const activeWallet =
    wallets.find((w) => (w as { is_active?: boolean | null }).is_active) ?? wallets[0];

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
      qc.invalidateQueries({ queryKey: ["wallet-portfolio-totals"] }),
      qc.invalidateQueries({ queryKey: ["recent-txs"] }),
      qc.invalidateQueries({ queryKey: ["my-nfts"] }),
    ]);
    toast.success("Wallet switched");
  }

  async function switchWalletFromHeader(id: string) {
    if (id === activeWallet?.id) {
      setHeaderSwitchOpen(false);
      return;
    }
    setHeaderSwitching(true);
    try {
      await switchWallet(id);
      setHeaderSwitchOpen(false);
    } catch (err) {
      toast.error((err as Error).message || "Could not switch wallet");
    } finally {
      setHeaderSwitching(false);
    }
  }

  const { code: headerCurrency } = useCurrency();

  return (
    <AppLockGate userId={user.id}>
    <AppMoonPayProvider>
      <AppPhantomProvider>
        <CurrencyProvider>
        <ChromeVisibleProvider value={hideChrome ? true : chromeVisible}>
      <div className="relative min-h-screen bg-background text-foreground">
        {!hideChrome && (
          <>
            <MobileAppHeader
              isHome={isHome}
              mobileOpen={mobileOpen}
              onToggleMenu={() => setMobileOpen((v) => !v)}
              unread={txNotes.unread}
              onOpenNotifications={() => setNotifOpen(true)}
              walletName={activeWallet?.name}
              walletLoading={walletsLoading}
              onOpenWalletSwitcher={() => setHeaderSwitchOpen(true)}
            />

            {/* Spacer matches fixed mobile header height */}
            <div
              className="md:hidden"
              style={{ height: "calc(3.25rem + env(safe-area-inset-top, 0px))" }}
              aria-hidden
            />
          </>
        )}

        <div className="mx-auto flex w-full max-w-none">
          {!hideChrome && (
            <aside
              className={cn(
                "ph-sidebar sticky top-0 hidden h-screen shrink-0 transition-[width,padding] duration-300 ease-out md:flex md:flex-col",
                sidebarCollapsed ? "w-17 p-2" : "w-70 p-3",
              )}
            >
              {sidebarCollapsed ? (
                <CollapsedSidebar
                  pathname={pathname}
                  onExpand={toggleSidebar}
                  activeWallet={activeWallet}
                />
              ) : (
                <div className="flex h-full min-h-0 flex-col">
                  <SidebarInner
                    wallets={wallets}
                    activeWallet={activeWallet}
                    profile={profile}
                    pathname={pathname}
                    onSwitchWallet={switchWallet}
                    unread={txNotes.unread}
                    onOpenNotifications={() => setNotifOpen(true)}
                  />
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    className="mt-1 flex shrink-0 items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                    title="Collapse sidebar"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </div>
              )}
            </aside>
          )}

          {mobileOpen && !hideChrome && (
            <div className="fixed inset-0 z-50 md:hidden">
              <div
                className="absolute inset-0 bg-background/70 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
              />
              <aside className="ph-sidebar relative flex h-full w-76 flex-col overflow-hidden p-3 shadow-2xl animate-in slide-in-from-left duration-300 ease-out">
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
            <PageTransition disabled={hideChrome}>
              {isP2p ? (
                <P2pShell>
                  <Outlet />
                </P2pShell>
              ) : (
                <Outlet />
              )}
            </PageTransition>
          </main>
        </div>

        {!hideChrome && (
          <MobileTabBar
            pathname={pathname}
            mobileOpen={mobileOpen}
            t={t}
          />
        )}

        <NotificationCenter
          open={notifOpen}
          onOpenChange={setNotifOpen}
          items={txNotes.items}
          onMarkAll={txNotes.markAll}
          onClear={txNotes.clearAll}
          onMarkOne={txNotes.markOneRead}
        />

        <WalletSwitcherDialog
          open={headerSwitchOpen}
          onOpenChange={setHeaderSwitchOpen}
          wallets={wallets}
          activeWalletId={activeWallet?.id}
          onSelect={switchWalletFromHeader}
          switching={headerSwitching}
          currency={headerCurrency}
        />
      </div>
    </ChromeVisibleProvider>
        </CurrencyProvider>
      </AppPhantomProvider>
    </AppMoonPayProvider>
    </AppLockGate>
  );
}

function sideItemClass(active: boolean) {
  return cn(
    "ph-side-item flex w-full items-center gap-3 rounded-[14px] px-3 py-[0.58rem] text-[13.5px] font-semibold tracking-[-0.012em] press transition-[background-color,color,box-shadow,transform] duration-200 ease-out",
    active
      ? "ph-side-item-active bg-primary/12 text-primary"
      : "text-muted-foreground hover:bg-muted/55 hover:text-foreground",
  );
}

function SideSection({
  label,
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      {label ? <p className="ph-side-label px-3 pb-1.5 pt-1">{label}</p> : null}
      {children}
    </div>
  );
}

function CollapsedSidebar({
  pathname,
  onExpand,
  activeWallet,
}: {
  pathname: string;
  onExpand: () => void;
  activeWallet?: { address: string; name: string } | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center gap-1 py-1.5">
      {activeWallet ? (
        <WalletAvatar
          address={activeWallet.address}
          name={activeWallet.name}
          size="sm"
          active
          className="mb-1.5"
        />
      ) : null}
      <button
        type="button"
        onClick={onExpand}
        className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-[14px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        title="Expand sidebar"
      >
        <PanelLeftOpen className="h-5 w-5" />
      </button>
      {NAV.map((item) => {
        const active = navActive(pathname, item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-[14px] transition-colors",
              active
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
            title={navLabel(t, item.labelKey)}
          >
            <item.icon
              className={cn("h-5 w-5", active && "ph-tab-icon-active")}
              strokeWidth={active ? 2.25 : 1.75}
            />
          </Link>
        );
      })}
      <Link
        to="/ai"
        className={cn(
          "mt-1 flex h-10 w-10 items-center justify-center rounded-[14px] transition-colors",
          pathname === "/ai"
            ? "bg-primary/12 text-primary"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
        title={t("nav.ai")}
      >
        <img src={OPENPAY_AI_MENU_ICON} alt="" className="h-5 w-5 rounded object-contain" />
      </Link>
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
    is_active?: boolean | null;
    ousd_balance?: number | null;
    pi_balance?: number | null;
    btc_balance?: number | null;
    eth_balance?: number | null;
    sol_balance?: number | null;
    usdc_balance?: number | null;
    usdt_balance?: number | null;
    pyusd_balance?: number | null;
    usdg_balance?: number | null;
    usd1_balance?: number | null;
    cash_balance?: number | null;
    eurc_balance?: number | null;
    [key: string]: unknown;
  }>;
  activeWallet?: {
    id: string;
    name: string;
    address: string;
    is_active?: boolean | null;
    ousd_balance?: number | null;
    pi_balance?: number | null;
    btc_balance?: number | null;
    eth_balance?: number | null;
    sol_balance?: number | null;
    usdc_balance?: number | null;
    usdt_balance?: number | null;
    pyusd_balance?: number | null;
    usdg_balance?: number | null;
    usd1_balance?: number | null;
    cash_balance?: number | null;
    eurc_balance?: number | null;
    [key: string]: unknown;
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
  const { developerMode, setDeveloperMode } = useDeveloperMode();
  const { t } = useTranslation();

  const router = useRouter();
  const [hideBalance, setHideBalance] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { code: currency, setCode: setCurrency } = useCurrency();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(() => {
    try {
      return localStorage.getItem("sidebar-discover-open") === "1";
    } catch {
      return false;
    }
  });
  const [legalOpen, setLegalOpen] = useState(() => {
    try {
      return localStorage.getItem("sidebar-legal-open") === "1";
    } catch {
      return false;
    }
  });

  const toggleDiscover = () =>
    setDiscoverOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem("sidebar-discover-open", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  const toggleLegal = () =>
    setLegalOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem("sidebar-legal-open", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  const { data: adminInfo } = useQuery({
    queryKey: ["is-admin"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { isAdmin: false };
      const { data } = await supabase.rpc("has_role", {
        _user_id: u.user.id,
        _role: "admin",
      });
      return { isAdmin: !!data };
    },
  });
  const isAdmin = !!adminInfo?.isAdmin;

  const { data: activeHoldings = [] } = useQuery({
    queryKey: ["holdings", activeWallet?.id],
    enabled: !!activeWallet?.id,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("token_holdings")
        .select("balance, tokens:token_id(price_usd, is_hidden)")
        .eq("wallet_id", activeWallet!.id);
      return (data ?? []).filter(
        (h: {
          balance?: number;
          tokens?: { price_usd?: number; is_hidden?: boolean | null } | null;
        }) => h.tokens && !h.tokens.is_hidden,
      );
    },
  });

  const { data: majorMarkets = [] } = useQuery({
    queryKey: ["major-markets"],
    staleTime: 30_000,
    queryFn: fetchMajorMarkets,
  });

  const holdingsUsd = (
    activeHoldings as Array<{ balance?: number; tokens?: { price_usd?: number } | null }>
  ).reduce((sum, h) => sum + Number(h.balance ?? 0) * Number(h.tokens?.price_usd ?? 0), 0);

  const liveMajorPrices = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of majorMarkets as Array<{ id: string; price: number }>) {
      if (m?.id && Number(m.price) > 0) map[m.id] = Number(m.price);
    }
    return map;
  }, [majorMarkets]);

  // Same formula as Home: live major prices + visible OpenToken holdings
  const totalUsd = holdingsUsd + walletLedgerUsd(activeWallet, liveMajorPrices);
  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/authpi", replace: true });
  }

  async function copyAddress() {
    if (!activeWallet?.address) return;
    try {
      await copyText(activeWallet.address);
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
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-2 rounded-2xl px-1.5 py-1">
        <Link
          to="/profile"
          onClick={onClose}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-sm font-semibold press hover:opacity-90"
        >
          {activeWallet ? (
            <WalletAvatar
              address={activeWallet.address}
              name={activeWallet.name}
              size="sm"
              active
            />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-muted">
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </span>
          )}
          <span className="truncate">{activeWallet?.name ?? "My Wallet"}</span>
        </Link>
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setHideBalance((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground press"
            aria-label="Toggle balance"
          >
            {hideBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setSwitchOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground press"
            aria-label="Switch wallet"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </span>
      </div>

      <WalletBalanceHero
        size="sidebar"
        balanceLabel={formatCurrency(totalUsd, currency)}
        addressLabel={shortAddress(activeWallet?.address ?? null)}
        hideBalance={hideBalance}
        copied={copied}
        onCycleCurrency={() => setCurrencyOpen(true)}
        onCopyAddress={copyAddress}
        className="shrink-0 px-1"
      />

      <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
        <SideSection>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = navActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                preload="intent"
                aria-current={active ? "page" : undefined}
                className={sideItemClass(active)}
              >
                <Icon
                  className={cn("h-[1.15rem] w-[1.15rem] shrink-0", active && "ph-tab-icon-active")}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className="truncate">{navLabel(t, item.labelKey)}</span>
              </Link>
            );
          })}
        </SideSection>

        <SideSection label={t("nav.explore")}>
          <Link
            to="/chat"
            onClick={onClose}
            preload="intent"
            aria-current={
              pathname === "/chat" || pathname.startsWith("/chat/") ? "page" : undefined
            }
            className={sideItemClass(pathname === "/chat" || pathname.startsWith("/chat/"))}
          >
            <MessageCircle
              className={cn(
                "h-[1.15rem] w-[1.15rem] shrink-0",
                (pathname === "/chat" || pathname.startsWith("/chat/")) && "ph-tab-icon-active",
              )}
              strokeWidth={
                pathname === "/chat" || pathname.startsWith("/chat/") ? 2.25 : 1.75
              }
            />
            <span className="truncate">{t("nav.liveChat")}</span>
          </Link>
          <Link
            to="/watchlist"
            onClick={onClose}
            preload="intent"
            aria-current={
              pathname === "/watchlist" || pathname.startsWith("/watchlist/")
                ? "page"
                : undefined
            }
            className={sideItemClass(
              pathname === "/watchlist" || pathname.startsWith("/watchlist/"),
            )}
          >
            <Star
              className={cn(
                "h-[1.15rem] w-[1.15rem] shrink-0",
                (pathname === "/watchlist" || pathname.startsWith("/watchlist/")) &&
                  "ph-tab-icon-active",
              )}
              strokeWidth={
                pathname === "/watchlist" || pathname.startsWith("/watchlist/") ? 2.25 : 1.75
              }
            />
            <span className="truncate">{t("nav.watchlist")}</span>
          </Link>
          <Link
            to="/airdrop"
            onClick={onClose}
            preload="intent"
            aria-current={
              pathname === "/airdrop" || pathname.startsWith("/airdrop/") ? "page" : undefined
            }
            className={sideItemClass(
              pathname === "/airdrop" || pathname.startsWith("/airdrop/"),
            )}
          >
            <Gift
              className={cn(
                "h-[1.15rem] w-[1.15rem] shrink-0",
                (pathname === "/airdrop" || pathname.startsWith("/airdrop/")) &&
                  "ph-tab-icon-active",
              )}
              strokeWidth={
                pathname === "/airdrop" || pathname.startsWith("/airdrop/") ? 2.25 : 1.75
              }
            />
            <span className="truncate">Airdrops</span>
          </Link>
          <Link
            to="/developer"
            onClick={onClose}
            preload="intent"
            aria-current={pathname === "/developer" ? "page" : undefined}
            className={sideItemClass(pathname === "/developer")}
          >
            <Code2
              className={cn(
                "h-[1.15rem] w-[1.15rem] shrink-0",
                pathname === "/developer" && "ph-tab-icon-active",
              )}
              strokeWidth={pathname === "/developer" ? 2.25 : 1.75}
            />
            <span className="truncate">Developer Portal</span>
          </Link>
          <Link
            to="/ai"
            onClick={onClose}
            preload="intent"
            aria-current={pathname === "/ai" ? "page" : undefined}
            className={sideItemClass(pathname === "/ai")}
          >
            <img
              src={OPENPAY_AI_MENU_ICON}
              alt=""
              className={cn(
                "h-[1.15rem] w-[1.15rem] shrink-0 rounded object-contain",
                pathname !== "/ai" && "opacity-85",
              )}
            />
            <span className="truncate">{t("nav.ai")}</span>
          </Link>
          <Link
            to="/solana-pay"
            search={{ donate_return: undefined, donate_cancel: undefined }}
            onClick={onClose}
            preload="intent"
            aria-current={pathname === "/solana-pay" ? "page" : undefined}
            className={sideItemClass(pathname === "/solana-pay")}
          >
            <span
              className={cn(
                "grid h-[1.15rem] w-[1.15rem] shrink-0 place-items-center text-[13px] font-black leading-none",
                pathname === "/solana-pay" ? "text-primary" : "text-muted-foreground",
              )}
            >
              ◎
            </span>
            <span className="truncate">{t("nav.solanaPay")}</span>
          </Link>
        </SideSection>

        <div className="space-y-0.5">
          <button
            type="button"
            onClick={toggleDiscover}
            className="ph-side-label flex w-full items-center justify-between px-3 pb-1.5 pt-1 press"
            aria-expanded={discoverOpen}
          >
            <span>{t("nav.discover")}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground/80 transition-transform duration-200",
                discoverOpen && "rotate-180",
              )}
            />
          </button>
          {discoverOpen ? (
            <div className="space-y-0.5">
              {(
                [
                  { href: "/website", labelKey: "nav.website", Icon: Home, external: false },
                  { href: "/openusd", labelKey: "nav.ousd", Icon: CircleDollarSign, external: false },
                  { href: "/about", labelKey: "nav.about", Icon: Globe2, external: false },
                  { href: "/blog", labelKey: "nav.blog", Icon: Newspaper, external: false },
                  { href: "/wiki", labelKey: "nav.wiki", Icon: BookMarked, external: false },
                ] as const
              ).map(({ href, labelKey, Icon, external }) =>
                external ? (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={onClose}
                    className={sideItemClass(false)}
                  >
                    <Icon className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate">{t(labelKey)}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
                  </a>
                ) : (
                  <Link
                    key={href}
                    to={href}
                    onClick={onClose}
                    preload="intent"
                    aria-current={
                      pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined
                    }
                    className={sideItemClass(
                      pathname === href || pathname.startsWith(`${href}/`),
                    )}
                  >
                    <Icon className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate">{t(labelKey)}</span>
                  </Link>
                ),
              )}
            </div>
          ) : null}
        </div>

        <div className="space-y-0.5">
          <button
            type="button"
            onClick={toggleLegal}
            className="ph-side-label flex w-full items-center justify-between px-3 pb-1.5 pt-1 press"
            aria-expanded={legalOpen}
          >
            <span>{t("settings.legal")}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground/80 transition-transform duration-200",
                legalOpen && "rotate-180",
              )}
            />
          </button>
          {legalOpen ? (
            <div className="space-y-0.5">
              {(
                [
                  { href: "/terms", label: "Terms", Icon: ScrollText },
                  { href: "/privacy", label: "Privacy", Icon: Shield },
                  { href: "/legal", label: "License", Icon: FileText },
                  { href: "/regulatory", label: "Regulatory", Icon: Scale },
                ] as const
              ).map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  to={href}
                  onClick={onClose}
                  preload="intent"
                  aria-current={
                    pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined
                  }
                  className={sideItemClass(
                    pathname === href || pathname.startsWith(`${href}/`),
                  )}
                >
                  <Icon className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        {isAdmin ? (
          <SideSection label={t("nav.developer")}>
            <div className="mb-1 flex items-center gap-3 rounded-[14px] px-3 py-[0.55rem]">
              <Code2 className="h-[1.15rem] w-[1.15rem] shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <label
                htmlFor="developer-mode"
                className="flex-1 cursor-pointer text-[13.5px] font-semibold tracking-[-0.012em] text-muted-foreground"
              >
                {t("nav.developer")}
              </label>
              <Switch
                id="developer-mode"
                checked={developerMode}
                onCheckedChange={setDeveloperMode}
                aria-label="Toggle developer mode"
              />
            </div>
            {developerMode ? (
              <>
                <Link
                  to="/developer"
                  onClick={onClose}
                  preload="intent"
                  aria-current={pathname === "/developer" ? "page" : undefined}
                  className={sideItemClass(pathname === "/developer")}
                >
                  <KeyRound
                    className={cn(
                      "h-[1.15rem] w-[1.15rem] shrink-0",
                      pathname === "/developer" && "ph-tab-icon-active",
                    )}
                    strokeWidth={pathname === "/developer" ? 2.25 : 1.75}
                  />
                  <span className="truncate">API keys &amp; seed</span>
                </Link>
                <Link
                  to="/ledger"
                  onClick={onClose}
                  preload="intent"
                  aria-current={pathname === "/ledger" ? "page" : undefined}
                  className={sideItemClass(pathname === "/ledger")}
                >
                  <ScrollText
                    className={cn(
                      "h-[1.15rem] w-[1.15rem] shrink-0",
                      pathname === "/ledger" && "ph-tab-icon-active",
                    )}
                    strokeWidth={pathname === "/ledger" ? 2.25 : 1.75}
                  />
                  <span className="truncate">{t("nav.ledgerApi")}</span>
                </Link>
                <Link
                  to="/connect"
                  onClick={onClose}
                  preload="intent"
                  aria-current={pathname === "/connect" ? "page" : undefined}
                  className={sideItemClass(pathname === "/connect")}
                >
                  <Bot
                    className={cn(
                      "h-[1.15rem] w-[1.15rem] shrink-0",
                      pathname === "/connect" && "ph-tab-icon-active",
                    )}
                    strokeWidth={pathname === "/connect" ? 2.25 : 1.75}
                  />
                  <span className="truncate">{t("nav.agentConnect")}</span>
                </Link>
                <a
                  href="/docs"
                  target="_blank"
                  rel="noreferrer"
                  onClick={onClose}
                  className={sideItemClass(false)}
                >
                  <BookOpen className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 truncate">{t("nav.docs")}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
                </a>
                <a
                  href="/docs/faq"
                  target="_blank"
                  rel="noreferrer"
                  onClick={onClose}
                  className={sideItemClass(false)}
                >
                  <HelpCircle className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 truncate">{t("nav.faq")}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
                </a>
              </>
            ) : null}
            <Link
              to="/p2p/admin"
              onClick={onClose}
              preload="intent"
              aria-current={pathname.startsWith("/p2p/admin") ? "page" : undefined}
              className={sideItemClass(pathname.startsWith("/p2p/admin"))}
            >
              <Users
                className={cn(
                  "h-[1.15rem] w-[1.15rem] shrink-0",
                  pathname.startsWith("/p2p/admin") && "ph-tab-icon-active",
                )}
                strokeWidth={pathname.startsWith("/p2p/admin") ? 2.25 : 1.75}
              />
              <span className="truncate">Admin · P2P</span>
            </Link>
            <Link
              to="/admin/topup"
              onClick={onClose}
              preload="intent"
              aria-current={pathname === "/admin/topup" ? "page" : undefined}
              className={sideItemClass(pathname === "/admin/topup")}
            >
              <CircleDollarSign
                className={cn(
                  "h-[1.15rem] w-[1.15rem] shrink-0",
                  pathname === "/admin/topup" && "ph-tab-icon-active",
                )}
                strokeWidth={pathname === "/admin/topup" ? 2.25 : 1.75}
              />
              <span className="truncate">Admin · Top Up &amp; Buy</span>
            </Link>
            <Link
              to="/admin/airdrops"
              onClick={onClose}
              preload="intent"
              aria-current={pathname === "/admin/airdrops" ? "page" : undefined}
              className={sideItemClass(pathname === "/admin/airdrops")}
            >
              <Gift
                className={cn(
                  "h-[1.15rem] w-[1.15rem] shrink-0",
                  pathname === "/admin/airdrops" && "ph-tab-icon-active",
                )}
                strokeWidth={pathname === "/admin/airdrops" ? 2.25 : 1.75}
              />
              <span className="truncate">Admin · Airdrops</span>
            </Link>
            <Link
              to="/admin/withdrawals"
              onClick={onClose}
              preload="intent"
              aria-current={pathname === "/admin/withdrawals" ? "page" : undefined}
              className={sideItemClass(pathname === "/admin/withdrawals")}
            >
              <ArrowUpFromLine
                className={cn(
                  "h-[1.15rem] w-[1.15rem] shrink-0",
                  pathname === "/admin/withdrawals" && "ph-tab-icon-active",
                )}
                strokeWidth={pathname === "/admin/withdrawals" ? 2.25 : 1.75}
              />
              <span className="truncate">Admin · Withdrawals</span>
            </Link>
            <Link
              to="/admin/deposits"
              onClick={onClose}
              preload="intent"
              aria-current={pathname === "/admin/deposits" ? "page" : undefined}
              className={sideItemClass(pathname === "/admin/deposits")}
            >
              <ArrowDownToLine
                className={cn(
                  "h-[1.15rem] w-[1.15rem] shrink-0",
                  pathname === "/admin/deposits" && "ph-tab-icon-active",
                )}
                strokeWidth={pathname === "/admin/deposits" ? 2.25 : 1.75}
              />
              <span className="truncate">{t("nav.depositGateway")}</span>
            </Link>
          </SideSection>
        ) : null}
      </nav>

      {/* Docked footer — scrolls never cover this; stays under the nav list */}
      <div className="shrink-0 space-y-2 border-t border-border/50 pt-3">
        <div className="flex items-center gap-2 rounded-2xl bg-muted/40 px-2.5 py-2">
          <span className="min-w-0 flex-1 truncate px-1 text-xs font-semibold text-muted-foreground">
            @{handle}
          </span>
          {onOpenNotifications ? (
            <NotificationBell unread={unread} onOpen={onOpenNotifications} />
          ) : null}
          <button
            type="button"
            onClick={toggle}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background/70 text-foreground ring-1 ring-border/60 press hover:bg-muted"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" strokeWidth={2} />
            ) : (
              <Moon className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-full justify-start rounded-2xl text-muted-foreground hover:text-foreground"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" /> {t("common.signOut")}
        </Button>
      </div>

      <WalletSwitcherDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        wallets={wallets}
        activeWalletId={activeWallet?.id}
        onSelect={handleSwitch}
        switching={switching}
        currency={currency}
        hideBalance={hideBalance}
        onNavigateAway={onClose}
      />

      <CurrencyPickerSheet
        open={currencyOpen}
        onOpenChange={setCurrencyOpen}
        value={currency}
        onSelect={(code) => {
          setCurrency(code);
          onClose?.();
        }}
      />
    </div>
  );
}
