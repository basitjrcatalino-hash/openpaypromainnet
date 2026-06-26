import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Sparkles } from "lucide-react";
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
import { OpenPayCheckout } from "@/components/openpay-checkout";

export const Route = createFileRoute("/_authenticated/topup")({
  head: () => ({ meta: [{ title: "Top Up — OpenPay Pro Wallet" }] }),
  component: TopUpPage,
});

const methods = [
  { id: "pi", label: "Pi Network (π)", icon: Sparkles, desc: "Pay with Pi · 1 π = 1 OUSD credited instantly" },
  { id: "openpay", label: "OpenPay QR Pay", icon: Sparkles, desc: "Pay securely via OpenPay checkout" },
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
  const [openpayToken, setOpenpayToken] = useState("");
  const [showOpenpay, setShowOpenpay] = useState(false);

  function extractToken(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    // Accept either a raw token (e.g. "qrp_...") or a full URL like
    // "https://openpy.space/qr-pay/qrp_..." — use the last path segment.
    try {
      const url = new URL(trimmed);
      const segs = url.pathname.split("/").filter(Boolean);
      return segs[segs.length - 1] ?? trimmed;
    } catch {
      const segs = trimmed.split("/").filter(Boolean);
      return segs[segs.length - 1] ?? trimmed;
    }
  }

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", user.id).limit(1).maybeSingle()).data,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (method === "openpay") {
      const tok = extractToken(openpayToken);
      if (!tok) { toast.error("Enter an OpenPay QR token or link"); return; }
      setOpenpayToken(tok);
      setShowOpenpay(true);
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
                <button key={m.id} type="button" onClick={() => { setMethod(m.id); setShowOpenpay(false); }} className={cn(
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
            <div>
              <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">OpenPay QR token</Label>
              <Input value={openpayToken} onChange={(e) => { setOpenpayToken(e.target.value); setShowOpenpay(false); }} placeholder="qrp_... or https://openpy.space/qr-pay/qrp_..." />
              <p className="mt-1 text-[11px] text-muted-foreground">Paste the QR token or the full QR Pay link.</p>
            </div>
          )}

          {method === "openpay" && showOpenpay && openpayToken ? (
            <OpenPayCheckout
              token={extractToken(openpayToken)}
              customerEmail={user.email ?? ""}
              customerName={(user.user_metadata?.full_name as string | undefined) ?? user.email ?? ""}
            />
          ) : (
            <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl bg-gradient-primary text-base font-semibold text-primary-foreground shadow-glow">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {method === "openpay" ? "Continue to OpenPay" : `Top up ${amount ? formatUSD(Number(amount)) : ""}`}
            </Button>
          )}
          <p className="text-center text-[11px] text-muted-foreground">
            New accounts start with a zero balance. Top up to begin.
          </p>
        </form>
      </Card>
    </div>
  );
}
