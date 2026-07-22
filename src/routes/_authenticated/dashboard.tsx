import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send, Plus, ArrowLeftRight, TrendingUp, DollarSign,
  ChevronsUpDown, Sparkles, QrCode, Eye, EyeOff, ScanLine, Lock,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatUSD, formatNumber, formatPct, generateAddress, shortAddress } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Wallet — OpenPay Pro" }] }),
  component: Dashboard,
});

const ACTIONS = [
  { label: "Fund", icon: Plus, to: "/topup" },
  { label: "Send", icon: Send, to: "/send" },
  { label: "Receive", icon: QrCode, to: "/receive" },
  { label: "Swap", icon: ArrowLeftRight, to: "/swap" },
  { label: "Earn", icon: TrendingUp, to: "/ousd" },
  { label: "Sell", icon: DollarSign, to: "/swap" },
] as const;

function Dashboard() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: wallet, isLoading: walletLoading } = useQuery({
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

  const { data: holdings = [] } = useQuery({
    queryKey: ["holdings", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("token_holdings")
        .select("balance, tokens:token_id(id, name, symbol, price_usd, change_24h, logo_url)")
        .eq("wallet_id", wallet!.id);
      return data ?? [];
    },
  });

  const { data: nfts = [] } = useQuery({
    queryKey: ["my-nfts", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => {
      const { data } = await supabase.from("nfts").select("*").eq("owner_wallet_id", wallet!.id).limit(6);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (walletLoading || wallet) return;
    (async () => {
      const { data, error } = await supabase
        .from("wallets")
        .insert({ user_id: user.id, name: "Main Wallet", address: generateAddress(), is_active: true, ousd_balance: 0, pi_balance: 0 })
        .select()
        .single();
      if (!error && data) {
        qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
        qc.invalidateQueries({ queryKey: ["wallets", user.id] });
        toast.success("Your wallet is ready");
      }
    })();
  }, [wallet, walletLoading, user.id, qc]);

  const [hideBalance, setHideBalance] = useState(false);
  const [tab, setTab] = useState<"assets" | "collectibles">("assets");

  const totalUsd = (holdings as any[]).reduce(
    (sum, h: any) => sum + Number(h.balance ?? 0) * Number(h.tokens?.price_usd ?? 0),
    0,
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between md:hidden">
        <button className="rounded-lg p-1.5 text-primary hover:bg-sidebar-accent" aria-label="Scan">
          <ScanLine className="h-5 w-5" />
        </button>
        <button className="inline-flex items-center gap-1 text-base font-semibold">
          {wallet?.name ?? "Main Wallet"} <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-1">
          <button className="rounded-lg p-1.5 text-primary hover:bg-sidebar-accent" aria-label="Lock">
            <Lock className="h-5 w-5" />
          </button>
          <button
            onClick={() => setHideBalance((v) => !v)}
            className="rounded-lg p-1.5 text-primary hover:bg-sidebar-accent"
            aria-label="Toggle balance"
          >
            {hideBalance ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Big gradient balance card (mobile primary, also visible on desktop as hero) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-glow md:hidden">
        <div className="absolute inset-0 opacity-40" aria-hidden>
          <div className="absolute -left-16 -top-10 h-56 w-56 rounded-full bg-mint blur-3xl" />
          <div className="absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-primary-glow blur-3xl" />
        </div>
        <div className="relative flex min-h-[180px] flex-col items-center justify-center gap-3">
          <button
            onClick={() => setHideBalance((v) => !v)}
            className="flex items-center gap-2 text-5xl font-bold tracking-tight tabular-nums"
          >
            {hideBalance ? "••••" : formatUSD(totalUsd)}
            <ChevronsUpDown className="h-5 w-5 opacity-70" />
          </button>
          <div className="mt-4 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-mono text-[11px]">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-white/20">◆</span>
            <span className="opacity-90">{shortAddress(wallet?.address ?? null, 6, 6)}</span>
          </div>
        </div>
      </div>

      {/* Actions bar */}
      <div className="grid grid-cols-4 gap-2 md:grid-cols-6 md:gap-3">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={() => navigate({ to: a.to })}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card px-2 py-3 text-xs font-semibold transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow md:px-3 md:py-4"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-accent text-primary transition-colors group-hover:bg-gradient-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <span>{a.label}</span>
            </button>
          );
        })}
      </div>


      <div className="grid gap-6 lg:grid-cols-3">
        {/* Assets */}
        <section className="lg:col-span-2">
          <header className="mb-3 flex items-center justify-between">
            <button className="inline-flex items-center gap-1 text-sm font-semibold">
              Assets <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </header>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            {holdings.length === 0 ? (
              <EmptyRow />
            ) : (
              <ul className="divide-y divide-border/60">
                {holdings.map((h: any) => {
                  const usd = Number(h.balance) * Number(h.tokens?.price_usd ?? 0);
                  const pct = Number(h.tokens?.change_24h ?? 0);
                  return (
                    <li key={h.tokens?.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
                          {(h.tokens?.symbol ?? "?").slice(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            {h.tokens?.name}
                            <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                              APY 3.9%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {formatUSD(h.tokens?.price_usd)} · <span className={cn(pct >= 0 ? "text-success" : "text-destructive")}>↑ {formatPct(pct)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">{formatNumber(h.balance, 4)} {h.tokens?.symbol}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">{formatUSD(usd)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              to="/tokens"
              className="flex items-center justify-center gap-2 border-t border-border/60 py-3 text-sm font-semibold text-primary hover:bg-sidebar-accent/40"
            >
              <span className="grid h-4 w-4 place-items-center rounded-sm border border-current">▦</span>
              Show All Assets <span className="text-muted-foreground">{holdings.length}</span>
            </Link>
          </div>
        </section>

        {/* Collectibles */}
        <section>
          <header className="mb-3 flex items-center justify-between">
            <button className="inline-flex items-center gap-1 text-sm font-semibold">
              Collectibles <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </header>

          <div className="rounded-2xl border border-border/60 bg-card p-5">
            {nfts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="text-base font-semibold">No collectibles yet</div>
                <p className="max-w-[220px] text-sm text-muted-foreground">
                  Explore a marketplace to discover existing NFT collections.
                </p>
                <Link
                  to="/nfts"
                  className="mt-2 rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
                >
                  Open Marketplace
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {nfts.map((n: any) => (
                  <div key={n.id} className="overflow-hidden rounded-xl border border-border/60 bg-card">
                    <div className="aspect-square w-full bg-gradient-mint" />
                    <div className="p-2 text-xs">
                      <div className="truncate font-semibold">{n.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* New wallet empty state */}
      {holdings.length === 0 && (
        <section className="rounded-3xl border border-border/60 bg-card px-6 py-16">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
            <div className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="h-10 w-10" />
            </div>
            <div className="text-lg font-bold">You have just created a new wallet</div>
            <p className="text-sm text-muted-foreground">
              Send, receive, and trade tokens and collectibles.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-sidebar-accent text-xs font-bold text-muted-foreground">
          —
        </div>
        <div>
          <div className="text-sm font-semibold text-muted-foreground">No assets yet</div>
          <div className="text-xs text-muted-foreground">Fund your wallet to get started</div>
        </div>
      </div>
    </div>
  );
}
