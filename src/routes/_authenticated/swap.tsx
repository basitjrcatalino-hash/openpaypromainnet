import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpDown,
  BadgeCheck,
  Info,
  Loader2,
  Search,
  Settings2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/wallet/PageHeader";
import { cn } from "@/lib/utils";
import { formatNumber, formatOUSD } from "@/lib/wallet-utils";
import { OUSD_LOGO_URL, OPENPAY_NETWORK_BADGE_URL } from "@/lib/token-logos";
import { OusdIcon } from "@/components/ousd-icon";
import { executeOpenDexSwap, OUSD_SWAP_ID } from "@/lib/opendex.functions";
import {
  applyOpenDexFee,
  OPENDEX_SWAP_FEE_BPS,
  opendexFeePct,
} from "@/lib/opendex-fee";
import {
  DEFAULT_SWAP_NETWORK,
  SWAP_NETWORKS,
  type SwapNetworkId,
} from "@/lib/swap-networks";

const SLIPPAGE_PRESETS = [0.1, 0.5, 1, 3] as const;
const FEE_PCT = opendexFeePct();

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
  is_verified?: boolean | null;
  isOusd?: boolean;
};

const OUSD_TOKEN: SwapToken = {
  id: OUSD_SWAP_ID,
  name: "OpenPay USD",
  symbol: "OUSD",
  price_usd: 1,
  logo_url: OUSD_LOGO_URL,
  status: "quote",
  is_verified: true,
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
  const [network, setNetwork] = useState<SwapNetworkId>(DEFAULT_SWAP_NETWORK);

  const { data: dbTokens = [] } = useQuery({
    queryKey: ["tokens-opendex"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("id, name, symbol, price_usd, logo_url, status, market_cap, is_verified")
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

  const fromTokens = useMemo(() => {
    const held = dbTokens.filter((t) => (balanceMap.get(t.id) ?? 0) > 0);
    return [OUSD_TOKEN, ...held];
  }, [dbTokens, balanceMap]);

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
  const { fee: feeOut, net: netOutput } = applyOpenDexFee(rawOutput);
  const minOut = netOutput * (1 - slippage / 100);
  const feeUsd = feeOut * (Number(toToken?.price_usd) || 0);
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
          expected_out: netOutput,
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
    <div className="ot-phantom ph-page space-y-4 pb-8">
      <PageHeader
        title="Swap"
        backTo="/dashboard"
        right={
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Swap settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </button>
        }
      />

      <p className="-mt-1 text-center text-sm text-muted-foreground">OpenDEX · wallet balances</p>

      <div className="relative space-y-2">
        <SwapSide
          label="You pay"
          tokens={fromTokens}
          value={from}
          onChange={pickFrom}
          amount={amount}
          onAmount={setAmount}
          balance={fromBal}
          editable
          onHalf={() => setAmount(trimAmt(fromBal / 2))}
          onMax={() => setAmount(trimAmt(fromBal))}
          emptyHint="No tokens in your wallet yet"
          network={network}
          onNetworkChange={setNetwork}
          balances={balanceMap}
        />

        <div className="relative z-10 -my-3.5 flex justify-center">
          <button
            type="button"
            onClick={flip}
            className="grid h-10 w-10 place-items-center rounded-full border-4 border-background bg-muted text-foreground press hover:bg-accent"
            aria-label="Flip tokens"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>

        <SwapSide
          label="You receive"
          tokens={toTokens}
          value={to}
          onChange={pickTo}
          amount={netOutput > 0 ? formatNumber(netOutput, 8) : ""}
          onAmount={() => {}}
          balance={toBal}
          network={network}
          onNetworkChange={setNetwork}
          balances={balanceMap}
        />
      </div>

      <div className="overflow-hidden rounded-2xl bg-card">
        <div className="space-y-0 px-1 py-1 text-sm">
          <Row label="Rate">
            {fromToken && toToken && rate > 0
              ? `1 ${fromToken.symbol} = ${formatNumber(rate, 8)} ${toToken.symbol}`
              : "—"}
          </Row>
          <Row label="Min received">
            {netOutput > 0 ? `${formatNumber(minOut, 8)} ${toToken?.symbol ?? ""}` : "—"}
          </Row>
          <Row label="Slippage">{slippage}%</Row>
          <Row label="Swap fee">
            {netOutput > 0 || amt > 0 ? (
              <span className="inline-flex flex-col items-end gap-0.5">
                <span>
                  {formatNumber(feeOut, feeOut > 0 && feeOut < 0.01 ? 8 : 4)}{" "}
                  {toToken?.symbol ?? ""}
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {FEE_PCT}% · ~{formatOUSD(feeUsd, { compact: true })}
                </span>
              </span>
            ) : (
              `${FEE_PCT}%`
            )}
          </Row>
        </div>
      </div>

      {(samePair || needsOusd) && (
        <p className="text-center text-xs text-destructive">
          {samePair ? "Choose different tokens" : "One side must be OUSD"}
        </p>
      )}

      <Button
        onClick={doSwap}
        disabled={!canSwap}
        className="h-14 w-full rounded-full text-base font-semibold"
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

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Swap settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-sm font-medium">Slippage tolerance</div>
              <div className="flex flex-wrap gap-2">
                {SLIPPAGE_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applySlippagePreset(p)}
                    className={cn(
                      "rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
                      slippage === p && !customSlippage
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {p}%
                  </button>
                ))}
              </div>
              <div className="relative mt-3">
                <Input
                  id="custom-slippage"
                  inputMode="decimal"
                  placeholder="Custom"
                  value={customSlippage}
                  onChange={(e) => applyCustomSlippage(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="h-11 rounded-xl pr-10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-muted/50 p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Swap fee</span>
                <span className="text-sm font-semibold tabular-nums text-primary">{FEE_PCT}%</span>
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                OpenDEX takes a {FEE_PCT}% platform fee ({OPENDEX_SWAP_FEE_BPS} bps) from the
                output amount on every swap. This is separate from slippage.
              </p>
              {amt > 0 && toToken && feeOut > 0 && (
                <p className="mt-2 text-xs tabular-nums text-foreground">
                  Est. fee: {formatNumber(feeOut, 6)} {toToken.symbol} (
                  {formatOUSD(feeUsd, { compact: true })})
                </p>
              )}
            </div>

            <Button className="h-12 w-full rounded-full" onClick={() => setSettingsOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function trimAmt(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0";
  const s = n.toFixed(8).replace(/\.?0+$/, "");
  return s || "0";
}

function isTokenVerified(token?: SwapToken | null) {
  if (!token) return false;
  return !!token.isOusd || !!token.is_verified;
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
  onHalf,
  onMax,
  emptyHint,
  network,
  onNetworkChange,
  balances,
}: {
  label: string;
  tokens: SwapToken[];
  value: string;
  onChange: (v: string) => void;
  amount: string;
  onAmount: (v: string) => void;
  balance: number;
  editable?: boolean;
  onHalf?: () => void;
  onMax?: () => void;
  emptyHint?: string;
  network: SwapNetworkId;
  onNetworkChange: (n: SwapNetworkId) => void;
  balances: Map<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const selected = tokens.find((t) => t.id === value);

  return (
    <div className="rounded-3xl bg-card p-4">
      <div className="mb-3 text-xs font-medium text-muted-foreground">{label}</div>

      <div className="flex items-start justify-between gap-3">
        <Input
          className="h-auto flex-1 border-0 bg-transparent p-0 text-3xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
          placeholder="0"
          value={amount}
          onChange={(e) => onAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          readOnly={!editable}
          inputMode="decimal"
          aria-label={label}
        />

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-2 text-sm font-semibold press hover:bg-accent"
        >
          <TokenLogo token={selected} size="sm" showNetworkBadge />
          <span>{selected?.symbol ?? "Select"}</span>
          {selected && isTokenVerified(selected) && (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-primary text-primary-foreground" />
          )}
          <span className="text-muted-foreground">▾</span>
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-muted-foreground">
          Bal: {formatNumber(balance, balance > 0 && balance < 1 ? 6 : 4)}
        </span>
        {editable && (
          <div className="flex items-center gap-1.5">
            {onHalf && balance > 0 && (
              <button
                type="button"
                onClick={onHalf}
                className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground press hover:bg-accent hover:text-foreground"
              >
                50%
              </button>
            )}
            {onMax && balance > 0 && (
              <button
                type="button"
                onClick={onMax}
                className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-primary press hover:bg-accent"
              >
                Max
              </button>
            )}
          </div>
        )}
      </div>

      <TokenPickerDialog
        open={open}
        onOpenChange={setOpen}
        tokens={tokens}
        value={value}
        onChange={onChange}
        emptyHint={emptyHint}
        network={network}
        onNetworkChange={onNetworkChange}
        balances={balances}
      />
    </div>
  );
}

function TokenPickerDialog({
  open,
  onOpenChange,
  tokens,
  value,
  onChange,
  emptyHint,
  network,
  onNetworkChange,
  balances,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tokens: SwapToken[];
  value: string;
  onChange: (v: string) => void;
  emptyHint?: string;
  network: SwapNetworkId;
  onNetworkChange: (n: SwapNetworkId) => void;
  balances: Map<string, number>;
}) {
  const [q, setQ] = useState("");
  const live = network === "openpay";

  const filtered = useMemo(() => {
    if (!live) return [];
    const qq = q.trim().toLowerCase();
    if (!qq) return tokens;
    return tokens.filter(
      (t) => t.symbol.toLowerCase().includes(qq) || t.name.toLowerCase().includes(qq),
    );
  }, [tokens, q, live]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setQ("");
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-0 overflow-hidden rounded-3xl border-border/60 bg-background p-0 sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Select token</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 p-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="h-11 rounded-2xl border-0 bg-muted pl-10"
              autoFocus
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {SWAP_NETWORKS.map((n) => {
              const active = network === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    onNetworkChange(n.id);
                    if (n.status === "soon") {
                      toast.message(`${n.label} coming soon`, {
                        description: "OpenDEX will support this network in a future update.",
                      });
                    }
                  }}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold press",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n.label}
                  {n.status === "soon" ? " · Soon" : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
          {!live ? (
            <div className="rounded-2xl bg-muted/60 px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                {SWAP_NETWORKS.find((n) => n.id === network)?.label} not live yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Switch back to OpenPay to swap with your wallet balances.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-4 rounded-full"
                onClick={() => onNetworkChange("openpay")}
              >
                Use OpenPay
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {emptyHint ?? "No tokens found"}
            </div>
          ) : (
            filtered.map((t) => {
              const bal = balances.get(t.id) ?? 0;
              const verified = isTokenVerified(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onChange(t.id);
                    onOpenChange(false);
                    setQ("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl bg-muted/70 px-3 py-3 text-left press hover:bg-muted",
                    t.id === value && "ring-1 ring-primary/40",
                  )}
                >
                  <TokenLogo token={t} showNetworkBadge />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{t.symbol}</span>
                      {verified && (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-primary text-primary-foreground" />
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatNumber(bal, bal > 0 && bal < 1 ? 6 : 4)} {t.symbol}
                    </div>
                  </div>
                  <span className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground">
                    <Info className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-border/60 p-3">
          <Button
            type="button"
            variant="secondary"
            className="h-12 w-full rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TokenLogo({
  token,
  size = "md",
  showNetworkBadge,
}: {
  token?: SwapToken | null;
  size?: "sm" | "md";
  showNetworkBadge?: boolean;
}) {
  const dim = size === "sm" ? "h-7 w-7 text-[9px]" : "h-10 w-10 text-[11px]";
  const badge = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  let logo: ReactNode;
  if (!token) {
    logo = <div className={cn("shrink-0 rounded-full bg-muted", dim)} />;
  } else if (token.isOusd) {
    logo = <OusdIcon className={cn("shrink-0 rounded-full object-cover", dim)} />;
  } else if (token.logo_url) {
    logo = (
      <img src={token.logo_url} alt="" className={cn("shrink-0 rounded-full object-cover", dim)} />
    );
  } else {
    logo = (
      <div
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-primary/20 font-bold text-primary",
          dim,
        )}
      >
        {token.symbol.slice(0, 2)}
      </div>
    );
  }

  // OUSD already is the OpenPay mark — no network badge overlay
  if (!showNetworkBadge || token?.isOusd) return logo;

  return (
    <span className="relative inline-flex shrink-0">
      {logo}
      <img
        src={OPENPAY_NETWORK_BADGE_URL}
        alt=""
        title="OpenPay"
        aria-hidden
        className={cn(
          "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-card bg-card object-cover",
          badge,
        )}
      />
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-3 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right text-sm font-medium tabular-nums text-foreground">{children}</div>
    </div>
  );
}
