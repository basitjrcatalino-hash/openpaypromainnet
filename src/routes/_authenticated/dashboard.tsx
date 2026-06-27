import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send, QrCode, ArrowLeftRight, ShoppingCart, Plus, Image as ImageIcon, Sparkles,
  TrendingUp, Eye, EyeOff, Copy, Check, ArrowDownLeft, ArrowUpRight, Coins,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatUSD, formatNumber, formatPct, generateAddress, shortAddress } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — OpenPay Pro Wallet" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [hideBalance, setHideBalance] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()).data,
  });

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

  const { data: txs = [] } = useQuery({
    queryKey: ["txs", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("wallet_id", wallet!.id)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: nfts = [] } = useQuery({
    queryKey: ["my-nfts", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => {
      const { data } = await supabase.from("nfts").select("*").eq("owner_wallet_id", wallet!.id).limit(4);
      return data ?? [];
    },
  });

  // Auto-create first wallet
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
        toast.success("Your first wallet is ready");
      }
    })();
  }, [wallet, walletLoading, user.id, qc]);

  const tokenValue = holdings.reduce((s, h: any) => s + Number(h.balance) * Number(h.tokens?.price_usd ?? 0), 0);
  const ousdValue = Number(wallet?.ousd_balance ?? 0) * 1; // 1:1
  const piValue = Number(wallet?.pi_balance ?? 0) * 32.5;
  const totalValue = tokenValue + ousdValue + piValue;

  const chartData = Array.from({ length: 24 }).map((_, i) => ({
    t: i,
    v: Math.max(0, totalValue * (0.85 + Math.sin(i / 3) * 0.08 + (i / 24) * 0.15)),
  }));

  async function copyAddress() {
    if (!wallet?.address) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1500);
  }

  const quickActions = [
    { label: "Send", icon: Send, to: "/send" },
    { label: "Receive", icon: QrCode, to: "/receive" },
    { label: "Top Up", icon: Plus, to: "/topup" },
    { label: "Swap", icon: ArrowLeftRight, to: "/swap" },
    { label: "Trade", icon: ShoppingCart, to: "/tokens" },
    { label: "Mint NFT", icon: ImageIcon, to: "/nfts/mint" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Hello {(profile?.display_name as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined) ?? (user.email?.split("@")[0]) ?? "there"} 👋
          </h1>
          <p className="text-sm text-muted-foreground">Here's your OpenPay portfolio snapshot</p>
        </div>
      </div>

      {/* Hero balance card */}
      <Card className="relative overflow-hidden border-0 bg-gradient-primary p-6 text-primary-foreground shadow-glow md:p-8">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-mint blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-primary-glow blur-3xl" />
        </div>
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest opacity-80">Total Portfolio Value</div>
            <button onClick={() => setHideBalance((v) => !v)} className="rounded-full bg-white/10 p-1.5 hover:bg-white/20" aria-label="Toggle balance">
              {hideBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-4xl font-bold tabular-nums md:text-5xl">
              {hideBalance ? "••••••" : formatUSD(totalValue)}
            </div>
            <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium">
              <TrendingUp className="h-3 w-3" /> +2.4% today
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={copyAddress} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 font-mono text-xs hover:bg-white/20">
              <span className="opacity-80">{shortAddress(wallet?.address ?? null)}</span>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
            <span className="text-xs opacity-80">{wallet?.name ?? "Loading…"}</span>
          </div>

          <div className="-mx-2 mt-4 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="white" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="white" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip cursor={false} content={() => null} />
                <Area type="monotone" dataKey="v" stroke="white" strokeWidth={2} fill="url(#balGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Balance pills */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <BalanceTile label="OUSD" icon={Sparkles} value={hideBalance ? "••••" : formatNumber(wallet?.ousd_balance ?? 0, 2)} sub={hideBalance ? "" : formatUSD(ousdValue)} accent="mint" />
        <BalanceTile label="Pi" value={hideBalance ? "••••" : formatNumber(wallet?.pi_balance ?? 0, 4)} sub={hideBalance ? "" : formatUSD(piValue)} icon={Coins} />
        <BalanceTile label="Tokens" value={String(holdings.length)} sub={hideBalance ? "" : formatUSD(tokenValue)} icon={Coins} />
      </div>

      {/* Quick actions */}
      <div className="glass rounded-3xl p-4 md:p-5">
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={() => navigate({ to: a.to })}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-transparent bg-card/40 p-3 text-xs font-medium transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-glow"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow transition-transform group-hover:scale-105">
                <a.icon className="h-4 w-4" />
              </span>
              <span className="text-center">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Holdings */}
        <Card className="glass-strong col-span-2 rounded-3xl border-border/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Token Holdings</h2>
            <Link to="/tokens" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {holdings.length === 0 ? (
            <EmptyHint icon={Coins} title="No tokens yet" desc="Swap or receive tokens to fill your portfolio." cta="Go to swap" to="/swap" />
          ) : (
            <ul className="divide-y divide-border/60">
              {holdings.map((h: any) => (
                <li key={h.tokens?.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <TokenLogo symbol={h.tokens?.symbol} />
                    <div>
                      <div className="text-sm font-semibold">{h.tokens?.name}</div>
                      <div className="text-xs text-muted-foreground">{h.tokens?.symbol}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{formatNumber(h.balance, 4)} {h.tokens?.symbol}</div>
                    <div className={cn("text-xs tabular-nums", Number(h.tokens?.change_24h) >= 0 ? "text-success" : "text-destructive")}>
                      {formatPct(h.tokens?.change_24h)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent transactions */}
        <Card className="glass-strong rounded-3xl border-border/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent Activity</h2>
            <Link to="/activity" className="text-xs text-primary hover:underline">All</Link>
          </div>
          {txs.length === 0 ? (
            <EmptyHint icon={ArrowUpRight} title="No transactions yet" desc="Your sends, swaps and mints will appear here." />
          ) : (
            <ul className="space-y-3">
              {txs.map((t: any) => (
                <li key={t.id} className="flex items-center gap-3">
                  <span className={cn("grid h-9 w-9 place-items-center rounded-full",
                    t.type === "receive" || t.type === "buy" ? "bg-mint/20 text-mint-foreground" : "bg-primary/15 text-primary")}>
                    {t.type === "receive" || t.type === "buy" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium capitalize">{t.type} {t.token_symbol ?? ""}</div>
                    <div className="truncate text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <div className="font-semibold">{formatNumber(t.amount, 4)}</div>
                    <div className="text-xs text-muted-foreground">{formatUSD(t.usd_value)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* NFT preview */}
      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">My NFTs</h2>
          <Link to="/nfts" className="text-xs text-primary hover:underline">Explore marketplace</Link>
        </div>
        {nfts.length === 0 ? (
          <EmptyHint icon={ImageIcon} title="No NFTs yet" desc="Mint your first NFT or buy from the marketplace." cta="Mint NFT" to="/nfts/mint" />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {nfts.map((n: any) => (
              <div key={n.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                <div className="aspect-square w-full bg-gradient-mint" />
                <div className="p-2 text-xs">
                  <div className="truncate font-semibold">{n.name}</div>
                  <div className="text-muted-foreground">{formatNumber(n.price, 2)} OUSD</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function BalanceTile({ label, value, sub, icon: Icon, accent }: { label: string; value: string; sub?: string; icon: typeof Coins; accent?: "mint" }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="uppercase tracking-wide">{label}</span>
        <span className={cn("grid h-7 w-7 place-items-center rounded-lg", accent === "mint" ? "bg-mint/20 text-mint-foreground" : "bg-primary/15 text-primary")}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground tabular-nums">{sub}</div>}
    </div>
  );
}

function TokenLogo({ symbol }: { symbol?: string }) {
  return (
    <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
      {(symbol ?? "?").slice(0, 3)}
    </div>
  );
}

function EmptyHint({ icon: Icon, title, desc, cta, to }: { icon: typeof Coins; title: string; desc: string; cta?: string; to?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <div className="text-sm font-semibold">{title}</div>
      <div className="max-w-sm text-xs text-muted-foreground">{desc}</div>
      {cta && to && (
        <Button asChild size="sm" className="mt-1 rounded-full bg-gradient-primary text-primary-foreground">
          <Link to={to}>{cta}</Link>
        </Button>
      )}
    </div>
  );
}
