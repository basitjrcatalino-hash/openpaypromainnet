import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Check, QrCode, Share2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/receive")({
  head: () => ({ meta: [{ title: "Receive — OpenPay Pro Wallet" }] }),
  component: ReceivePage,
});

function ReceivePage() {
  const { user } = Route.useRouteContext();
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("");

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", user.id).limit(1).maybeSingle()).data,
  });

  async function copyAddr() {
    if (!wallet?.address) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1500);
  }

  const payUri = `openpay://${wallet?.address ?? ""}${amount ? `?amount=${amount}` : ""}`;

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Receive</h1>
        <p className="text-sm text-muted-foreground">Share your wallet or a payment request</p>
      </div>

      <Card className="glass-strong rounded-3xl border-border/60 p-6 text-center">
        <div className="mx-auto grid h-56 w-56 place-items-center rounded-3xl bg-card p-4 shadow-card">
          {/* Stylized QR placeholder */}
          <div className="grid h-full w-full grid-cols-12 grid-rows-12 gap-px rounded-xl bg-foreground p-2">
            {Array.from({ length: 144 }).map((_, i) => (
              <div key={i} className={(i * 7919 + (wallet?.address?.length ?? 1)) % 3 === 0 ? "bg-background" : "bg-foreground"} />
            ))}
            <div className="col-span-3 row-span-3 row-start-1 col-start-1 -m-2 grid place-items-center bg-foreground"><QrCode className="h-6 w-6 text-background" /></div>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Your wallet address</div>
          <button onClick={copyAddr} className="mt-1 inline-flex items-center gap-2 break-all rounded-full bg-muted px-3 py-1.5 font-mono text-xs hover:bg-accent">
            {wallet?.address ?? "—"}
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
        <div className="mt-4 text-left">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Request amount (optional)</label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00 OUSD" />
          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => { navigator.clipboard.writeText(payUri); toast.success("Payment URI copied"); }}>
              <Share2 className="mr-1.5 h-4 w-4" /> Share request
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
