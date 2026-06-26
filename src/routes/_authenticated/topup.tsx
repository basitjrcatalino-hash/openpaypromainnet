import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Sparkles, Ticket, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/wallet-utils";
import { topUpWithPi } from "@/lib/pi-network";
import { getPublicTopupInfo, redeemVoucher } from "@/lib/topup-admin.functions";

export const Route = createFileRoute("/_authenticated/topup")({
  head: () => ({ meta: [{ title: "Top Up — OpenPay Pro Wallet" }] }),
  component: TopUpPage,
});

const methods = [
  { id: "pi", label: "Pi Network (π)", icon: Sparkles, desc: "Pay with Pi · 1 π = 1 OUSD credited instantly" },
  { id: "openpay", label: "OpenPay Voucher", icon: Ticket, desc: "Pay on OpenPay, then redeem your voucher code" },
] as const;

const presets = [25, 50, 100, 250, 500, 1000];
const schema = z.object({
  amount: z.coerce.number().positive().min(1, "Minimum $1").max(50000),
  method: z.enum(["pi", "openpay"]),
});

function TopUpPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("100");
  const [method, setMethod] = useState<"pi" | "openpay">("pi");
  const [busy, setBusy] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");

  const getInfo = useServerFn(getPublicTopupInfo);
  const redeem = useServerFn(redeemVoucher);
  const infoQ = useQuery({ queryKey: ["public-topup"], queryFn: () => getInfo() });

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", user.id).limit(1).maybeSingle()).data,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (method === "openpay") {
      const code = voucherCode.trim();
      if (!code) { toast.error("Enter your voucher code"); return; }
      setBusy(true);
      try {
        const r = await redeem({ data: { code } });
        toast.success(`Voucher redeemed · ${r.amount} OUSD credited`);
        setVoucherCode("");
        qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
        qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
      } catch (err) { toast.error((err as Error).message); }
      finally { setBusy(false); }
      return;
    }
    const parsed = schema.safeParse({ amount, method });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid"); return; }
    setBusy(true);
    try {
      const { paymentId } = await topUpWithPi(parsed.data.amount);
      toast.success(`Pi payment complete · ${parsed.data.amount} OUSD credited (${paymentId.slice(0, 8)}…)`);
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
      qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
      setAmount("");
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Top Up</h1>
        <p className="text-sm text-muted-foreground">Add OUSD to your wallet instantly</p>
      </div>

      <Card className="border-0 bg-gradient-primary p-5 text-primary-foreground shadow-glow">
        <div className="text-xs uppercase tracking-widest opacity-80">Current OUSD balance</div>
        <div className="text-3xl font-bold tabular-nums">{formatUSD(Number(wallet?.ousd_balance ?? 0))}</div>
      </Card>

      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount (USD)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" step="any" required className="h-14 text-2xl font-bold tabular-nums" />
            <div className="mt-2 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button key={p} type="button" onClick={() => setAmount(String(p))} className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  amount === String(p) ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                )}>${p}</button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment method</Label>
            <div className="space-y-2">
              {methods.map((m) => (
                <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                  method === m.id ? "border-primary bg-primary/5 shadow-glow" : "border-border hover:bg-muted/50",
                )}>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
                    <m.icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {method === "openpay" && (
            <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 1 · Pay on OpenPay</div>
                {infoQ.data?.openpay_payment_url ? (
                  <a
                    href={infoQ.data.openpay_payment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#0070BA] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Open payment page <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Payment link not configured yet. Ask the admin.</p>
                )}
                {infoQ.data?.instructions && (
                  <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{infoQ.data.instructions}</p>
                )}
              </div>
              <div>
                <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 2 · Redeem voucher</Label>
                <Input
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX"
                  className="font-mono tracking-wider"
                />
              </div>
            </div>
          )}

          <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl bg-gradient-primary text-base font-semibold text-primary-foreground shadow-glow">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {method === "openpay" ? "Redeem voucher" : `Top up ${amount ? formatUSD(Number(amount)) : ""}`}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            New accounts start with a zero balance. Top up to begin.
          </p>
        </form>
      </Card>
    </div>
  );
}
