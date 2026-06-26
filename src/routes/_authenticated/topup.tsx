import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, CreditCard, Building2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/wallet-utils";
import { topUpOUSD } from "@/lib/transfer.functions";

export const Route = createFileRoute("/_authenticated/topup")({
  head: () => ({ meta: [{ title: "Top Up — OpenPay Pro Wallet" }] }),
  component: TopUpPage,
});

const methods = [
  { id: "openpay", label: "OpenPay Balance", icon: Sparkles, desc: "Instant transfer from your OpenPay account" },
  { id: "card", label: "Debit / Credit Card", icon: CreditCard, desc: "Visa, Mastercard, Amex — 3D Secure" },
  { id: "bank", label: "Bank Transfer", icon: Building2, desc: "ACH / SEPA — 1–2 business days" },
] as const;

const presets = [25, 50, 100, 250, 500, 1000];
const schema = z.object({
  amount: z.coerce.number().positive().min(1, "Minimum $1").max(50000),
  method: z.enum(["openpay", "card", "bank"]),
});

function TopUpPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const topup = useServerFn(topUpOUSD);
  const [amount, setAmount] = useState("100");
  const [method, setMethod] = useState<"openpay" | "card" | "bank">("openpay");
  const [busy, setBusy] = useState(false);
  const [cardForm, setCardForm] = useState({ number: "", exp: "", cvc: "" });

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", user.id).limit(1).maybeSingle()).data,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ amount, method });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid"); return; }
    if (method === "card") {
      const digits = cardForm.number.replace(/\s/g, "");
      if (digits.length < 12) { toast.error("Enter a valid card number"); return; }
      if (!/^\d{2}\/\d{2}$/.test(cardForm.exp)) { toast.error("Expiry must be MM/YY"); return; }
      if (cardForm.cvc.length < 3) { toast.error("Invalid CVC"); return; }
    }
    setBusy(true);
    try {
      const ref = method === "card" ? `card_${cardForm.number.slice(-4)}` : method;
      const res = await topup({ data: { amount: parsed.data.amount, method, reference: ref } });
      toast.success(`Topped up ${formatUSD(parsed.data.amount)} OUSD`);
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

          {method === "card" && (
            <div className="space-y-3 rounded-2xl border border-border bg-card/50 p-3">
              <div>
                <Label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Card number</Label>
                <Input value={cardForm.number} onChange={(e) => setCardForm({ ...cardForm, number: e.target.value })} placeholder="4242 4242 4242 4242" inputMode="numeric" maxLength={23} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Expiry</Label>
                  <Input value={cardForm.exp} onChange={(e) => setCardForm({ ...cardForm, exp: e.target.value })} placeholder="MM/YY" maxLength={5} />
                </div>
                <div>
                  <Label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">CVC</Label>
                  <Input value={cardForm.cvc} onChange={(e) => setCardForm({ ...cardForm, cvc: e.target.value })} placeholder="123" maxLength={4} />
                </div>
              </div>
            </div>
          )}

          <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl bg-gradient-primary text-base font-semibold text-primary-foreground shadow-glow">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Top up {amount ? formatUSD(Number(amount)) : ""}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Test mode — funds are credited instantly. Connect OpenPay API for real processing.
          </p>
        </form>
      </Card>
    </div>
  );
}
