import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Loader2, Settings2, Zap } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber, formatUSD } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/swap")({
  head: () => ({ meta: [{ title: "Swap — OpenPay Pro Wallet" }] }),
  component: SwapPage,
});

function SwapPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [slippage, setSlippage] = useState("0.5");
  const [busy, setBusy] = useState(false);

  const { data: tokens = [] } = useQuery({
    queryKey: ["tokens-swap"],
    queryFn: async () => {
      const { data } = await supabase.from("tokens").select("id, name, symbol, price_usd").order("market_cap", { ascending: false });
      return data ?? [];
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", user.id).limit(1).maybeSingle()).data,
  });

  useEffect(() => {
    if (!from && tokens.length) setFrom(tokens.find((t: any) => t.symbol === "OUSD")?.id ?? tokens[0].id);
    if (!to && tokens.length > 1) setTo(tokens.find((t: any) => t.symbol === "OPAY")?.id ?? tokens[1].id);
  }, [tokens, from, to]);

  const fromToken = tokens.find((t: any) => t.id === from);
  const toToken = tokens.find((t: any) => t.id === to);
  const rate = useMemo(() => {
    if (!fromToken || !toToken) return 0;
    return Number(fromToken.price_usd) / Number(toToken.price_usd || 1);
  }, [fromToken, toToken]);
  const output = (Number(amount) || 0) * rate;
  const networkFee = 0.0025;

  async function doSwap() {
    if (!wallet || !fromToken || !toToken || !amount) return;
    setBusy(true);
    try {
      await supabase.from("transactions").insert({
        wallet_id: wallet.id, type: "swap",
        token_symbol: `${fromToken.symbol}→${toToken.symbol}`,
        amount: Number(amount),
        usd_value: Number(amount) * Number(fromToken.price_usd),
        memo: `Swapped to ${formatNumber(output, 4)} ${toToken.symbol}`,
      });
      toast.success(`Swapped ${amount} ${fromToken.symbol} for ${formatNumber(output, 4)} ${toToken.symbol}`);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["txs", wallet.id] });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Swap</h1>
        <p className="text-sm text-muted-foreground">Instant token exchange with optimized routing</p>
      </div>

      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Trade</span>
          <button className="rounded-full bg-muted p-1.5 hover:bg-accent" aria-label="Settings"><Settings2 className="h-4 w-4" /></button>
        </div>

        <SwapSide label="From" tokens={tokens} value={from} onChange={setFrom} amount={amount} onAmount={setAmount} editable />
        <div className="my-2 flex justify-center">
          <button onClick={() => { const t = from; setFrom(to); setTo(t); }} className="rounded-full border border-border bg-card p-2 shadow-card hover:bg-accent">
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
        <SwapSide label="To" tokens={tokens} value={to} onChange={setTo} amount={output ? formatNumber(output, 6) : ""} onAmount={() => {}} />

        <div className="mt-4 space-y-1.5 rounded-2xl bg-muted/40 p-3 text-xs">
          <Row label="Rate">1 {fromToken?.symbol ?? "—"} = {formatNumber(rate, 6)} {toToken?.symbol ?? "—"}</Row>
          <Row label="Estimated output">{formatNumber(output, 6)} {toToken?.symbol ?? ""}</Row>
          <Row label="Network fee">{formatUSD(networkFee)}</Row>
          <Row label="Slippage">
            <Input className="h-7 w-16 text-right text-xs" value={slippage} onChange={(e) => setSlippage(e.target.value)} />
            <span className="ml-1">%</span>
          </Row>
        </div>

        <Button onClick={doSwap} disabled={busy || !amount || !fromToken || !toToken} className="mt-4 h-12 w-full rounded-2xl bg-gradient-primary text-base font-semibold text-primary-foreground shadow-glow">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
          Swap
        </Button>
      </Card>
    </div>
  );
}

function SwapSide({ label, tokens, value, onChange, amount, onAmount, editable }: {
  label: string; tokens: any[]; value: string; onChange: (v: string) => void;
  amount: string; onAmount: (v: string) => void; editable?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span></div>
      <div className="mt-1 flex items-center gap-3">
        <Input
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          readOnly={!editable}
          placeholder="0.00"
          inputMode="decimal"
          className="border-0 bg-transparent px-0 text-2xl font-bold tabular-nums shadow-none focus-visible:ring-0"
        />
        <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold">
          {tokens.map((t) => <option key={t.id} value={t.id}>{t.symbol}</option>)}
        </select>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  );
}
