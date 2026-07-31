import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Wallet,
  ArrowDownToLine,
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
  CircleDollarSign,
  PanelLeftClose,
  PanelLeftOpen,
  Star,
  HelpCircle,
  MessageCircle,
  Bot,
  Sparkles,
  Code2,
  Newspaper,
  BookMarked,
  Globe2,
  Home,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useDeveloperMode } from "@/hooks/use-developer-mode";


import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
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
import { WalletBalanceHero } from "@/components/wallet/WalletBalanceHero";
import {
  WalletSwitcherDialog,
} from "@/components/wallet/WalletSwitcherDialog";
import { WalletAvatar } from "@/components/wallet/WalletAvatar";
import { CurrencyPickerSheet } from "@/components/wallet/CurrencyPickerSheet";
import { fetchWalletPortfolioTotals, walletLedgerUsd } from "@/lib/wallet-portfolio";
import { MAJOR_TOKEN_IDS } from "@/lib/major-tokens";
import { LEDGER_BALANCE_COLUMN } from "@/lib/ledger-majors";
import { ChromeVisibleProvider } from "@/hooks/chrome-visible";
import { useChromeScroll } from "@/hooks/use-chrome-scroll";
import { AppMoonPayProvider } from "@/components/moonpay-provider";
import { AppPhantomProvider } from "@/components/phantom-provider";
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
  { to: "/wallet", labelKey: "nav.wallet", icon: Wallet },
  { to: "/deposit", labelKey: "nav.deposit", icon: ArrowDownToLine },
  { to: "/tokens", labelKey: "nav.tokens", icon: CircleDollarSign },
  { to: "/opentoken", labelKey: "nav.openToken", icon: BookOpen },

  // Bags Cash hidden for now — re-enable via BAGS_CASH_ENABLED above.
  { to: "/activity", labelKey: "nav.history", icon: History },
  { to: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
] as const;

/** Mobile bottom tab bar — Settings stays in the sidebar/menu only. */
const FOOTER_NAV = NAV.filter((item) => item.to !== "/settings");

function navActive(pathname: string, to: string) {
  return (
    pathname === to ||
    (to === "/dashboard" && pathname === "/") ||
    (to === "/wallet" && pathname.startsWith("/wallet")) ||
    (to === "/tokens" &&
      (pathname.startsWith("/tokens") || pathname.startsWith("/asset/"))) ||
    (to === "/opentoken" &&
      pathname.startsWith("/opentoken") &&
      !pathname.startsWith("/opentoken/create"))
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
    try { localStorage.setItem("sidebar-collapsed", next ? "1" : "0"); } catch {}
    return next;
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const hideChrome =
    pathname === "/scan" ||
    pathname === "/chat" ||
    pathname.startsWith("/chat/") ||
    /\/opentoken\/[^/]+\/chat\/?$/.test(pathname) ||
    pathname === "/opentoken/terminal" ||
    pathname.startsWith("/opentoken/terminal/");
  const chromeVisible = useChromeScroll(10, pathname);
  const [notifOpen, setNotifOpen] = useState(false);
  const txNotes = useTransactionNotifications(user.id);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets", user.id],
    queryFn: () => listUserWallets<Tables<"wallets">>(supabase, user.id, "*"),
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
      qc.invalidateQueries({ queryKey: ["wallet-portfolio-totals"] }),
      qc.invalidateQueries({ queryKey: ["recent-txs"] }),
      qc.invalidateQueries({ queryKey: ["my-nfts"] }),
    ]);
    toast.success("Wallet switched");
  }

  return (
    <AppMoonPayProvider>
      <AppPhantomProvider>
        <CurrencyProvider>
        <ChromeVisibleProvider value={hideChrome ? true : chromeVisible}>
      <div className="relative min-h-screen bg-background text-foreground">
        {!hideChrome && (
          <>
            <header
              className={cn(
                "ph-header safe-pt fixed inset-x-0 top-0 z-40 grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center px-2 py-2.5 transition-transform duration-300 ease-out md:hidden",
                chromeVisible ? "translate-y-0" : "-translate-y-full pointer-events-none",
              )}
            >
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="justify-self-start rounded-full p-2 text-primary press"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <Link
                to="/dashboard"
                className="ph-nav-title truncate text-center text-foreground"
              >
                OpenPay Pro
              </Link>
              <div className="justify-self-end">
                <NotificationBell unread={txNotes.unread} onOpen={() => setNotifOpen(true)} />
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
            <aside
              className={cn(
                "ph-sidebar sticky top-0 hidden h-screen shrink-0 overflow-y-auto md:flex md:flex-col transition-[width] duration-200 ease-in-out",
                sidebarCollapsed ? "w-[4.25rem] p-2" : "w-[17.5rem] p-3",
              )}
            >
              {sidebarCollapsed ? (
                <CollapsedSidebar
                  pathname={pathname}
                  onExpand={toggleSidebar}
                  activeWallet={activeWallet}
                />
              ) : (
                <>
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
                    className="mt-auto flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                    title="Collapse sidebar"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </>
              )}
            </aside>
          )}

          {mobileOpen && !hideChrome && (
            <div className="fixed inset-0 z-50 md:hidden">
              <div
                className="absolute inset-0 bg-background/70 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
              />
              <aside className="ph-sidebar relative flex h-full w-[19rem] flex-col overflow-y-auto p-3 shadow-2xl">
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
              <Outlet />
            </PageTransition>
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
              className="mx-auto flex max-w-md items-center gap-0 overflow-x-auto overscroll-x-contain px-1.5 scrollbar-none [-webkit-overflow-scrolling:touch]"
              style={{ height: "var(--ph-tabbar-content)" }}
            >
              {FOOTER_NAV.map((item) => {
                const Icon = item.icon;
                const active = navActive(pathname, item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    preload="intent"
                    className={cn(
                      "flex h-full min-w-14 flex-1 flex-col items-center justify-center gap-0.5 ph-tab-label press",
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
                    <span className="px-0.5">{t(item.labelKey)}</span>
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
        </CurrencyProvider>
      </AppPhantomProvider>
    </AppMoonPayProvider>
  );
}

function sideItemClass(active: boolean) {
  return cn(
    "ph-side-item flex w-full items-center gap-3 rounded-[14px] px-3 py-[0.58rem] text-[13.5px] font-semibold tracking-[-0.012em] press",
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
            title={t(item.labelKey)}
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

  const walletIds = wallets.map((w) => w.id).join(",");
  const balanceFingerprint = wallets
    .map((w) => {
      const row = w as Record<string, unknown>;
      const majors = MAJOR_TOKEN_IDS.map(
        (id) => `${id}=${Number(row[LEDGER_BALANCE_COLUMN[id]] ?? 0)}`,
      ).join("|");
      return `${w.id}:${w.ousd_balance ?? 0}:${majors}`;
    })
    .join("|");
  const { data: portfolioTotals = {} } = useQuery({
    queryKey: ["wallet-portfolio-totals", walletIds, balanceFingerprint],
    enabled: wallets.length > 0,
    staleTime: 15_000,
    queryFn: () => fetchWalletPortfolioTotals(supabase, wallets),
  });

  // Same formula as dashboard: all ledger majors + OpenToken holdings
  const totalUsd =
    (activeWallet?.id && portfolioTotals[activeWallet.id] != null
      ? portfolioTotals[activeWallet.id]
      : undefined) ??
    holdingsUsd + walletLedgerUsd(activeWallet);
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
    <div className="flex min-h-full min-w-0 flex-col gap-4">
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
        balanceLabel={formatCurrency(totalUsd, currency)}
        addressLabel={shortAddress(activeWallet?.address ?? null)}
        hideBalance={hideBalance}
        copied={copied}
        onCycleCurrency={() => setCurrencyOpen(true)}
        onCopyAddress={copyAddress}
        className="px-1 py-1"
      />

      <nav className="flex min-h-0 flex-1 flex-col gap-3">
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
                <span className="truncate">{t(item.labelKey)}</span>
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
                  { href: "/", labelKey: "nav.website", Icon: Home, external: true },
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
                href="/docs/openpay"
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
          {isAdmin ? (
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
          ) : null}
          {(developerMode || isAdmin) && (
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
          )}
        </SideSection>
      </nav>

      <div className="mt-auto space-y-1.5 pt-1">
        <div className="flex items-center justify-between gap-2 rounded-[14px] bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
          <span className="truncate font-semibold">@{handle}</span>
          <div className="flex items-center gap-0.5">
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
          className="w-full justify-start rounded-[14px] text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="mr-1.5 h-3.5 w-3.5" /> {t("common.signOut")}
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
