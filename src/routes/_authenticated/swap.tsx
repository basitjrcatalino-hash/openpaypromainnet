import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Search,
  Settings2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatNumber, formatOUSD } from "@/lib/wallet-utils";
import { OUSD_LOGO_URL } from "@/lib/token-logos";
import { OusdIcon } from "@/components/ousd-icon";
import { executeOpenDexSwap, OUSD_SWAP_ID } from "@/lib/opendex.functions";

const SLIPPAGE_PRESETS = [0.1, 0.5, 1, 3] as const;

const searchSchema = z.object({
  token: z.string().optional(),
});

type SwapToken = {
  id: string;
  name: string;
  symbol: string;
  price_usd: number;
  logo_url?: string | null;
  status?: string | null;
  isOusd?: boolean;
};

const OUSD_TOKEN: SwapToken = {
  id: OUSD_SWAP_ID,
  name: "OpenPay USD",
  symbol: "OUSD",
  price_usd: 1,
  logo_url: OUSD_LOGO_URL,
  status: "quote",
  isOusd: true,
};

export const Route = createFileRoute("/_authenticated/swap")({
  head: () => ({ meta: [{ title: "OpenDEX — OpenPay Pro" }] }),
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  component: OpenDexPage,
});

function OpenDexPage() {
  const { user } = Route.useRouteContext();
  const { token: tokenParam } = Route.useSearch();
  const qc = useQueryClient();
  const swapFn = useServerFn(executeOpenDexSwap);

  const [from, setFrom] = useState(OUSD_SWAP_ID);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [customSlippage, setCustomSlippage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { data: dbTokens = [] } = useQuery({
    queryKey: ["tokens-opendex"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("id, name, symbol, price_usd, logo_url, status, market_cap")
        .eq("is_hidden", false)
        .order("market_cap", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((t) => t.symbol !== "OUSD") as SwapToken[];
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("wallets")
          .select("id, ousd_balance")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  const { data: holdings = [] } = useQuery({
    queryKey: ["holdings", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("token_holdings")
        .select("token_id, balance")
        .eq("wallet_id", wallet!.id)
        .gt("balance", 0);
      return data ?? [];
    },
  });

  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    map.set(OUSD_SWAP_ID, Number(wallet?.ousd_balance ?? 0));
    for (const h of holdings) map.set(h.token_id, Number(h.balance ?? 0));
    return map;
  }, [wallet, holdings]);

  /** From list = OUSD + tokens the user actually holds (matches dashboard assets). */
  const fromTokens = useMemo(() => {
    const held = dbTokens.filter((t) => (balanceMap.get(t.id) ?? 0) > 0);
    return [OUSD_TOKEN, ...held];
  }, [dbTokens, balanceMap]);

  /** To list = OUSD + all listed tokens (prefer held / graduated first). */
  const toTokens = useMemo(() => {
    const sorted = [...dbTokens].sort((a, b) => {
      const ah = (balanceMap.get(a.id) ?? 0) > 0 ? 1 : 0;
      const bh = (balanceMap.get(b.id) ?? 0) > 0 ? 1 : 0;
      if (ah !== bh) return bh - ah;
      const ag = a.status === "graduated" ? 1 : 0;
      const bg = b.status === "graduated" ? 1 : 0;
      return bg - ag;
    });
    return [OUSD_TOKEN, ...sorted];
  }, [dbTokens, balanceMap]);

  const allTokens = useMemo(() => {
    const map = new Map<string, SwapToken>();
    map.set(OUSD_SWAP_ID, OUSD_TOKEN);
    for (const t of dbTokens) map.set(t.id, t);
    return map;
  }, [dbTokens]);

  useEffect(() => {
    if (!dbTokens.length || initialized) return;
    const pref =
      (tokenParam && dbTokens.find((t) => t.id === tokenParam)) ||
      fromTokens.find((t) => t.id !== OUSD_SWAP_ID) ||
      dbTokens.find((t) => t.status === "graduated") ||
      dbTokens[0];

    const ousdBal = Number(wallet?.ousd_balance ?? 0);
    if (ousdBal > 0) {
      setFrom(OUSD_SWAP_ID);
      setTo(pref?.id && pref.id !== OUSD_SWAP_ID ? pref.id : "");
    } else if (pref && (balanceMap.get(pref.id) ?? 0) > 0) {
      setFrom(pref.id);
      setTo(OUSD_SWAP_ID);
    } else {
      setFrom(OUSD_SWAP_ID);
      setTo(pref?.id ?? "");
    }
    setInitialized(true);
  }, [dbTokens, tokenParam, initialized, wallet, fromTokens, balanceMap]);

  const fromToken = allTokens.get(from);
  const toToken = allTokens.get(to);

  const fromBal = balanceMap.get(from) ?? 0;
  const toBal = balanceMap.get(to) ?? 0;

  const rate = useMemo(() => {
    if (!fromToken || !toToken) return 0;
    const fp = Number(fromToken.price_usd) || 0;
    const tp = Number(toToken.price_usd) || 0;
    if (tp <= 0) return 0;
    return fp / tp;
  }, [fromToken, toToken]);

  const amt = Number(amount) || 0;
  const rawOutput = amt > 0 && rate > 0 ? amt * rate : 0;
  const minOut = rawOutput * (1 - slippage / 100);
  const samePair = !!from && !!to && from === to;
  const needsOusd = from !== OUSD_SWAP_ID && to !== OUSD_SWAP_ID;

  function pickFrom(id: string) {
    setFrom(id);
    setAmount("");
    if (id === to) {
      setTo(id === OUSD_SWAP_ID ? toTokens.find((t) => t.id !== id)?.id ?? "" : OUSD_SWAP_ID);
    } else if (id !== OUSD_SWAP_ID && to !== OUSD_SWAP_ID) {
      setTo(OUSD_SWAP_ID);
    }
  }

  function pickTo(id: string) {
    setTo(id);
    if (id === from) {
      setFrom(id === OUSD_SWAP_ID ? fromTokens.find((t) => t.id !== id)?.id ?? OUSD_SWAP_ID : OUSD_SWAP_ID);
    } else if (id !== OUSD_SWAP_ID && from !== OUSD_SWAP_ID) {
      setFrom(OUSD_SWAP_ID);
    }
  }

  function flip() {
    const nextFrom = to;
    const nextTo = from;
    // Only flip into From if user holds that asset (or OUSD)
    if (nextFrom !== OUSD_SWAP_ID && (balanceMap.get(nextFrom) ?? 0) <= 0) {
      toast.error("You don't hold that token to swap from");
      return;
    }
    setFrom(nextFrom);
    setTo(nextTo);
    setAmount("");
  }

  function applySlippagePreset(v: number) {
    setSlippage(v);
    setCustomSlippage("");
  }

  function applyCustomSlippage(raw: string) {
    setCustomSlippage(raw);
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 50) setSlippage(n);
  }

  async function refreshBalances() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] }),
      qc.invalidateQueries({ queryKey: ["holdings"] }),
      qc.invalidateQueries({ queryKey: ["ot-holdings-swap"] }),
      qc.invalidateQueries({ queryKey: ["ot-holding"] }),
      qc.invalidateQueries({ queryKey: ["ot-portfolio"] }),
      qc.invalidateQueries({ queryKey: ["wallets"] }),
      qc.invalidateQueries({ queryKey: ["recent-txs"] }),
      qc.invalidateQueries({ queryKey: ["all-txs"] }),
      qc.invalidateQueries({ queryKey: ["txs"] }),
      qc.invalidateQueries({ queryKey: ["ledger-entries"] }),
      qc.invalidateQueries({ queryKey: ["ledger-overview"] }),
    ]);
  }

  async function doSwap() {
    if (!wallet || !fromToken || !toToken || !amount) return;
    if (samePair) {
      toast.error("Select two different tokens");
      return;
    }
    if (needsOusd) {
      toast.error("OpenDEX pairs must include OUSD");
      return;
    }
    if (amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amt > fromBal + 1e-12) {
      toast.error(`Insufficient ${fromToken.symbol} balance`);
      return;
    }

    setBusy(true);
    try {
      const res = await swapFn({
        data: {
          wallet_id: wallet.id,
          from_id: from,
          to_id: to,
          amount: amt,
          slippage,
          expected_out: rawOutput,
        },
      });
      toast.success(
        `Swapped ${formatNumber(res.amount_in, 6)} ${res.from_symbol} → ${formatNumber(res.amount_out, 6)} ${res.to_symbol}`,
      );
      setAmount("");
      await refreshBalances();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canSwap =
    !busy &&
    amt > 0 &&
    !!fromToken &&
    !!toToken &&
    !samePair &&
    !needsOusd &&
    amt <= fromBal + 1e-12 &&
    !!wallet?.id;

  return (
    <div className="mx-auto max-w-md animate-page-in space-y-5 px-1 pb-8">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="mt-0.5 rounded-full">
          <Link to="/opentoken">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">OpenDEX</h1>
          <p className="text-sm text-muted-foreground">
            Swap your wallet assets against OUSD — balances match your dashboard
          </p>
        </div>
      </div>

      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Trade</span>
          <button
            type="button"
            className="rounded-full bg-muted p-1.5 hover:bg-accent"
            aria-label="Swap settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        <SwapSide
          label="From"
          tokens={fromTokens}
          value={from}
          onChange={pickFrom}
          amount={amount}
          onAmount={setAmount}
          balance={fromBal}
          editable
          onMax={() => setAmount(String(fromBal))}
          emptyHint="No tokens in your wallet yet"
        />

        <div className="my-2 flex justify-center">
          <button
            type="button"
            onClick={flip}
            className="rounded-full border border-border bg-card p-2 shadow-card hover:bg-accent"
            aria-label="Flip tokens"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>

        <SwapSide
          label="To"
          tokens={toTokens}
          value={to}
          onChange={pickTo}
          amount={rawOutput > 0 ? formatNumber(rawOutput, 8) : ""}
          onAmount={() => {}}
          balance={toBal}
        />

        <div className="mt-4 space-y-1.5 rounded-2xl bg-muted/40 p-3 text-xs">
          <Row label="Rate">
            {fromToken && toToken && rate > 0
              ? `1 ${fromToken.symbol} = ${formatNumber(rate, 8)} ${toToken.symbol}`
              : "—"}
          </Row>
          <Row label="You pay">
            {amt > 0 ? `${formatNumber(amt, 8)} ${fromToken?.symbol ?? ""}` : "0"}
          </Row>
          <Row label="You receive">
            {rawOutput > 0 ? `${formatNumber(rawOutput, 8)} ${toToken?.symbol ?? ""}` : "0"}
          </Row>
          <Row label="Min received">
            {rawOutput > 0 ? `${formatNumber(minOut, 8)} ${toToken?.symbol ?? ""}` : "0"}
          </Row>
          <Row label="Slippage">{slippage}%</Row>
          <Row label="Wallet OUSD">{formatNumber(balanceMap.get(OUSD_SWAP_ID) ?? 0, 4)}</Row>
        </div>

        {(samePair || needsOusd) && (
          <p className="mt-2 text-center text-xs text-destructive">
            {samePair ? "Choose different tokens" : "One side must be OUSD"}
          </p>
        )}

        <Button
          onClick={doSwap}
          disabled={!canSwap}
          className="mt-4 h-12 w-full rounded-2xl bg-gradient-primary text-base font-semibold text-primary-foreground shadow-glow"
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
          {!wallet
            ? "Create a wallet first"
            : !fromToken || !toToken
              ? "Select tokens"
              : samePair || needsOusd
                ? "Invalid pair"
                : amt > fromBal
                  ? `Insufficient ${fromToken.symbol}`
                  : amt > 0
                    ? `Swap ${formatNumber(amt, 4)} ${fromToken.symbol}`
                    : "Enter an amount"}
        </Button>
      </Card>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Swap settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium">Slippage tolerance</div>
              <div className="flex flex-wrap gap-2">
                {SLIPPAGE_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applySlippagePreset(p)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                      slippage === p && !customSlippage
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {p}%
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Input
                  inputMode="decimal"
                  placeholder="Custom"
                  value={customSlippage}
                  onChange={(e) => applyCustomSlippage(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="rounded-xl"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <Button className="w-full rounded-full" onClick={() => setSettingsOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SwapSide({
  label,
  tokens,
  value,
  onChange,
  amount,
  onAmount,
  balance,
  editable,
  onMax,
  emptyHint,
}: {
  label: string;
  tokens: SwapToken[];
  value: string;
  onChange: (v: string) => void;
  amount: string;
  onAmount: (v: string) => void;
  balance: number;
  editable?: boolean;
  onMax?: () => void;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = tokens.find((t) => t.id === value) ?? (value ? undefined : undefined);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return tokens;
    return tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(qq) ||
        t.name.toLowerCase().includes(qq),
    );
  }, [tokens, q]);

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <button
          type="button"
          className={cn("tabular-nums", editable && onMax && "hover:text-primary")}
          onClick={editable && onMax ? onMax : undefined}
        >
          Bal: {formatNumber(balance, balance > 0 && balance < 1 ? 6 : 4)}
          {editable && onMax && balance > 0 ? " · Max" : ""}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Popover
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setQ("");
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2 text-sm font-semibold hover:bg-accent"
            >
              <TokenLogo token={selected} size="sm" />
              <span>{selected?.symbol ?? "Select"}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search token"
                className="h-9 rounded-xl pl-8"
                autoFocus
              />
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                    setQ("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-muted",
                    t.id === value && "bg-primary/10",
                  )}
                >
                  <TokenLogo token={t} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      {t.symbol}
                      {t.isOusd && (
                        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          Quote
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">{t.name}</div>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground tabular-nums">
                    {formatOUSD(t.price_usd, { price: true, suffix: false })}
                  </div>
                  {t.id === value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {emptyHint ?? "No tokens found"}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Input
          className="border-0 bg-transparent text-right text-xl font-semibold shadow-none focus-visible:ring-0"
          placeholder="0"
          value={amount}
          onChange={(e) => onAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          readOnly={!editable}
          inputMode="decimal"
        />
      </div>
    </div>
  );
}

function TokenLogo({ token, size = "md" }: { token?: SwapToken | null; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-[10px]";
  if (!token) return <div className={cn("shrink-0 rounded-full bg-muted", dim)} />;
  if (token.isOusd) return <OusdIcon className={cn("shrink-0 rounded-full object-cover", dim)} />;
  if (token.logo_url) {
    return <img src={token.logo_url} alt="" className={cn("shrink-0 rounded-full object-cover", dim)} />;
  }
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-primary font-bold text-primary-foreground",
        dim,
      )}
    >
      {token.symbol.slice(0, 2)}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right font-medium tabular-nums">{children}</div>
    </div>
  );
}
