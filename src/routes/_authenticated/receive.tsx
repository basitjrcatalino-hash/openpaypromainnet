import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Copy, Check, QrCode, Share2, Download } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

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
  const [asset, setAsset] = useState<"OUSD" | "PI">("OUSD");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", user.id).limit(1).maybeSingle()).data,
  });

  const payUri = wallet?.address
    ? `openpay:${wallet.address}?asset=${asset}${amount ? `&amount=${amount}` : ""}`
    : "";

  useEffect(() => {
    if (!canvasRef.current || !payUri) return;
    QRCode.toCanvas(canvasRef.current, payUri, {
      width: 240, margin: 1,
      color: { dark: "#003087", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(() => {});
  }, [payUri]);

  async function copyAddr() {
    if (!wallet?.address) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadQR() {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = `openpay-${wallet?.address?.slice(0, 8)}.png`;
    a.click();
  }

  async function share() {
    if (!payUri) return;
    if (navigator.share) {
      try { await navigator.share({ title: "OpenPay payment request", text: payUri }); return; } catch {}
    }
    await navigator.clipboard.writeText(payUri);
    toast.success("Payment link copied");
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Receive</h1>
        <p className="text-sm text-muted-foreground">Share your wallet or a payment request</p>
      </div>

      <Card className="glass-strong rounded-3xl border-border/60 p-6 text-center">
        <div className="mx-auto grid place-items-center rounded-3xl bg-white p-4 shadow-card">
          <canvas ref={canvasRef} className="block" />
          {!payUri && <QrCode className="h-40 w-40 text-muted-foreground" />}
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Your wallet address</div>
          <button onClick={copyAddr} className="mt-1 inline-flex items-center gap-2 break-all rounded-full bg-muted px-3 py-1.5 font-mono text-xs hover:bg-accent">
            {wallet?.address ?? "—"}
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-left">
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Asset</label>
            <select value={asset} onChange={(e) => setAsset(e.target.value as any)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option>OUSD</option><option>PI</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Amount (optional)</label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" className="rounded-2xl" onClick={share}>
            <Share2 className="mr-1.5 h-4 w-4" /> Share
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={downloadQR}>
            <Download className="mr-1.5 h-4 w-4" /> Save QR
          </Button>
        </div>
      </Card>
    </div>
  );
}
