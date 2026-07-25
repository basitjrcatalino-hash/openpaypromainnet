import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send as SendIcon, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/wallet-utils";
import { QrScannerButton } from "@/components/qr-scanner";
import { sendAsset } from "@/lib/transfer.functions";
import { sendViaOpenPay, resolveOpenPayAccount } from "@/lib/openpay-pro.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/send")({
  head: () => ({ meta: [{ title: "Send — OpenPay Pro Wallet" }] }),
  component: SendPage,
});

type Rail = "wallet" | "openpay";


const schema = z.object({
  to: z.string().trim().min(2, "Enter a wallet address or @username").max(120),
  amount: z.coerce.number().positive().max(1e15),
  asset: z.enum(["OUSD", "PI"]),
  memo: z.string().max(140).optional(),
});


function parseScanned(text: string): { to: string; amount?: string; asset?: "OUSD" | "PI" } {
  // Accepts: raw address | openpay:ADDR?asset=OUSD&amount=10 | ethereum:0x..?value=..
  try {
    if (text.startsWith("openpay:") || text.startsWith("ethereum:") || text.includes("?")) {
      const [scheme, rest] = text.split(":");
      const body = rest ?? scheme;
      const [addr, query] = body.split("?");
      const params = new URLSearchParams(query ?? "");
      const asset = (params.get("asset") as "OUSD" | "PI") ?? undefined;
      const amount = params.get("amount") ?? params.get("value") ?? undefined;
      return { to: addr, amount: amount ?? undefined, asset };
    }
  } catch {}
  return { to: text.trim() };
}

function SendPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const send = useServerFn(sendAsset);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ to: string; amount: string; asset: "OUSD" | "PI"; memo: string }>({
    to: "", amount: "", asset: "OUSD", memo: "",
  });

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", user.id).limit(1).maybeSingle()).data,
  });

  function applyScan(text: string) {
    const p = parseScanned(text);
    setForm((f) => ({ ...f, to: p.to, amount: p.amount ?? f.amount, asset: p.asset ?? f.asset }));
    toast.success("Scanned");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid"); return; }
    if (!wallet) return;
    if (parsed.data.to === wallet.address) { toast.error("Cannot send to your own address"); return; }
    setBusy(true);
    try {
      const res = await send({ data: parsed.data });
      toast.success(res.credited
        ? `Sent ${parsed.data.amount} ${parsed.data.asset} — recipient credited`
        : `Sent ${parsed.data.amount} ${parsed.data.asset}`);
      setForm({ to: "", amount: "", asset: parsed.data.asset, memo: "" });
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
      qc.invalidateQueries({ queryKey: ["txs", wallet.id] });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Send</h1>
        <p className="text-sm text-muted-foreground">Transfer assets to any wallet</p>
      </div>

      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Recipient address or @username">
            <div className="flex gap-2">
              <Input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="0x… or @username" required />
              <QrScannerButton onResult={applyScan} trigger={
                <Button type="button" variant="outline" size="icon" className="rounded-xl shrink-0" aria-label="Scan QR">
                  <Camera className="h-4 w-4" />
                </Button>
              } />
            </div>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Asset">
              <select value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value as "OUSD" | "PI" })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option>OUSD</option><option>PI</option>
              </select>
            </Field>
            <Field className="col-span-2" label={`Amount (Balance: ${formatNumber(form.asset === "OUSD" ? wallet?.ousd_balance : wallet?.pi_balance, 4)})`}>
              <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" type="number" min="0" step="any" required />
            </Field>
          </div>
          <Field label="Memo (optional)">
            <Textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} maxLength={140} rows={2} />
          </Field>
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl bg-gradient-primary text-base font-semibold text-primary-foreground shadow-glow">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SendIcon className="mr-2 h-4 w-4" />} Send
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
