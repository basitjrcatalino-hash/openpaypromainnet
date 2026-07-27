import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { formatNumber, formatOUSD, formatUSD } from "@/lib/wallet-utils";
import { OUSD_LOGO_URL } from "@/lib/token-logos";
import { OusdIcon } from "@/components/ousd-icon";

const OUSD_ID = "__ousd__";
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
  id: OUSD_ID,
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

  const [from, setFrom] = useState(OUSD_ID);
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

  const tokens = useMemo(() => [OUSD_TOKEN, ...dbTokens], [dbTokens]);

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
    queryKey: ["ot-holdings-swap", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("token_holdings")
        .select("token_id, balance")
        .eq("wallet_id", wallet!.id);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!dbTokens.length || initialized) return;
    const pref =
      (tokenParam && dbTokens.find((t) => t.id === tokenParam)) ||
      dbTokens.find((t) => t.status === "graduated") ||
      dbTokens[0];
    setFrom(OUSD_ID);
    setTo(pref?.id ?? "");
    setInitialized(true);
  }, [dbTokens, tokenParam, initialized]);

  const fromToken = tokens.find((t) => t.id === from);
  const toToken = tokens.find((t) => t.id === to);

  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    map.set(OUSD_ID, Number(wallet?.ousd_balance ?? 0));
    for (const h of holdings) map.set(h.token_id, Number(h.balance ?? 0));
    return map;
  }, [wallet, holdings]);

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
  const rawOutput = amt * rate;
  const minOut = rawOutput * (1 - slippage / 100);
  const networkFee = 0.0025;
  const samePair = !!from && !!to && from === to;

  function pickFrom(id: string) {
    setFrom(id);
    if (id === to) {
      const other = tokens.find((t) => t.id !== id);
      if (other) setTo(other.id);
    }
  }

  function pickTo(id: string) {
    setTo(id);
    if (id === from) {
      const other = tokens.find((t) => t.id !== id);
      if (other) setFrom(other.id);
    }
  }

  function flip() {
    const prevFrom = from;
    setFrom(to);
    setTo(prevFrom);
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

  async function doSwap() {
    if (!wallet || !fromToken || !toToken || !amount) return;
    if (samePair) {
      toast.error("Select two different tokens");
      return;
    }
    if (amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amt > fromBal) {
      toast.error(`Insufficient ${fromToken.symbol} balance`);
      return;
    }
    if (slippage < 0 || slippage > 50) {
      toast.error("Slippage must be between 0% and 50%");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.from("transactions").insert({
        wallet_id: wallet.id,
        type: "swap",
        status: "confirmed",
        token_symbol: `${fromToken.symbol}→${toToken.symbol}`,
        counterparty: toToken.symbol,
        amount: amt,
        usd_value: amt * Number(fromToken.price_usd ?? 0),
        memo: `OpenDEX ${amt} ${fromToken.symbol} → min ${formatNumber(minOut, 6)} ${toToken.symbol} @ ${slippage}% slip`,
      });
      if (error) throw error;
      toast.success(
        `Swapped ${formatNumber(amt, 4)} ${fromToken.symbol} → ${formatNumber(rawOutput, 6)} ${toToken.symbol}`,
      );
      setAmount("");
      void qc.invalidateQueries({ queryKey: ["txs", wallet.id] });
      void qc.invalidateQueries({ queryKey: ["recent-txs"] });
      void qc.invalidateQueries({ queryKey: ["all-txs"] });
      void qc.invalidateQueries({ queryKey: ["ledger-entries"] });
      void qc.invalidateQueries({ queryKey: ["ledger-overview"] });
      void qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
      void qc.invalidateQueries({ queryKey: ["ot-holdings-swap", wallet.id] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canSwap = !busy && amt > 0 && !!fromToken && !!toToken && !samePair && amt <= fromBal;

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
          <p className="text-sm text-muted-foreground">Swap tokens with OUSD quote pairs</p>
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
          tokens={tokens}
          value={from}
          onChange={pickFrom}
          amount={amount}
          onAmount={setAmount}
          balance={fromBal}
          editable
          onMax={() => setAmount(String(fromBal))}
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
          tokens={tokens}
          value={to}
          onChange={pickTo}
          amount={rawOutput > 0 ? formatNumber(rawOutput, 6) : ""}
          onAmount={() => {}}
          balance={toBal}
        />

        <div className="mt-4 space-y-1.5 rounded-2xl bg-muted/40 p-3 text-xs">
          <Row label="Rate">
            {fromToken && toToken && rate > 0
              ? `1 ${fromToken.symbol} = ${formatNumber(rate, 6)} ${toToken.symbol}`
              : "—"}
          </Row>
          <Row label="Estimated output">
            {rawOutput > 0 ? `${formatNumber(rawOutput, 6)} ${toToken?.symbol ?? ""}` : "0"}
          </Row>
          <Row label="Min received">
            {rawOutput > 0 ? `${formatNumber(minOut, 6)} ${toToken?.symbol ?? ""}` : "0"}
          </Row>
          <Row label="Network fee">{formatUSD(networkFee)}</Row>
          <Row label="Slippage">{slippage}%</Row>
        </div>

        {samePair && (
          <p className="mt-2 text-center text-xs text-destructive">Choose different tokens</p>
        )}

        <Button
          onClick={doSwap}
          disabled={!canSwap}
          className="mt-4 h-12 w-full rounded-2xl bg-gradient-primary text-base font-semibold text-primary-foreground shadow-glow"
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
          {!fromToken || !toToken
            ? "Select tokens"
            : samePair
              ? "Invalid pair"
              : amt > fromBal
                ? `Insufficient ${fromToken.symbol}`
                : amt > 0
                  ? `Swap ${fromToken.symbol} → ${toToken.symbol}`
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
              <p className="mt-2 text-xs text-muted-foreground">
                Your swap reverts if price moves more than this. Current:{" "}
                <span className="font-medium text-foreground">{slippage}%</span>
              </p>
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
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = tokens.find((t) => t.id === value);

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
          Bal: {formatNumber(balance, balance < 1 ? 4 : 2)}
          {editable && onMax ? " · Max" : ""}
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
                      {t.status === "graduated" && (
                        <span className="rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-300">
                          DEX
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">{t.name}</div>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    {formatOUSD(t.price_usd, { price: true, suffix: false })}
                  </div>
                  {t.id === value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">No tokens found</div>
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
  if (!token) {
    return <div className={cn("shrink-0 rounded-full bg-muted", dim)} />;
  }
  if (token.isOusd) {
    return <OusdIcon className={cn("shrink-0 rounded-full object-cover", dim)} />;
  }
  if (token.logo_url) {
    return (
      <img
        src={token.logo_url}
        alt=""
        className={cn("shrink-0 rounded-full object-cover", dim)}
      />
    );
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
