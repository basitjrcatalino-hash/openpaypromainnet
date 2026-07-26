import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy,
  Check,
  QrCode,
  Share2,
  Download,
  Wallet as WalletIcon,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  claimOpenPayInbound,
  createOpenPayReceiveLink,
  settleOpenPayInboundReceive,
} from "@/lib/openpay-pro.functions";
import { formatUSD } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/receive")({
  head: () => ({ meta: [{ title: "Receive — OpenPay Pro Wallet" }] }),
  validateSearch: (s: Record<string, unknown>): {
    openpay_in?: "1";
    openpay_cancel?: "1";
    openpay_tx?: string;
    openpay_ref?: string;
    amount?: string;
  } => {
    const out: {
      openpay_in?: "1";
      openpay_cancel?: "1";
      openpay_tx?: string;
      openpay_ref?: string;
      amount?: string;
    } = {};
    if (s.openpay_in) out.openpay_in = "1";
    if (s.openpay_cancel) out.openpay_cancel = "1";
    if (typeof s.openpay_tx === "string") out.openpay_tx = s.openpay_tx;
    if (typeof s.openpay_ref === "string") out.openpay_ref = s.openpay_ref;
    if (typeof s.amount === "string") out.amount = s.amount;
    return out;
  },
  component: ReceivePage,
});

function ReceivePage() {
  const { user } = Route.useRouteContext();
  const search = useSearch({ from: "/_authenticated/receive" });
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<"OUSD" | "PI">("OUSD");
  const [opAmount, setOpAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [opLink, setOpLink] = useState<{
    pay_url: string;
    note: string;
    partner_username?: string;
    address?: string | null;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const opCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const createReceive = useServerFn(createOpenPayReceiveLink);
  const settleInbound = useServerFn(settleOpenPayInboundReceive);

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () =>
      (await supabase.from("wallets").select("*").eq("user_id", user.id).limit(1).maybeSingle())
        .data,
  });

  const payUri = wallet?.address
    ? `openpay:${wallet.address}?asset=${asset}${amount ? `&amount=${amount}` : ""}`
    : "";

  useEffect(() => {
    if (!canvasRef.current || !payUri) return;
    QRCode.toCanvas(canvasRef.current, payUri, {
      width: 240,
      margin: 1,
      color: { dark: "#003087", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(() => {});
  }, [payUri]);

  useEffect(() => {
    if (!opCanvasRef.current || !opLink?.pay_url) return;
    QRCode.toCanvas(opCanvasRef.current, opLink.pay_url, {
      width: 200,
      margin: 1,
      color: { dark: "#003087", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(() => {});
  }, [opLink?.pay_url]);

  async function refreshBalances() {
    qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
    qc.invalidateQueries({ queryKey: ["txs", wallet?.id] });
    qc.invalidateQueries({ queryKey: ["wallets", user.id] });
  }

  /** Reconcile real OpenPay credits (works even when the payer is someone else). */
  async function checkForPayment(opts: { silent?: boolean } = {}) {
    setBusy(true);
    try {
      const r = await claimInbound({ data: { note: opLink?.note } });
      if (r.credited > 0) {
        toast.success(`Received ${formatUSD(r.amount)} from OpenPay`);
        await refreshBalances();
      } else if (r.already > 0) {
        if (!opts.silent) toast.info("Payment already credited");
      } else if (!opts.silent) {
        toast.info("No new OpenPay payment found yet — try again in a moment");
      }
      return r;
    } catch (e) {
      if (!opts.silent) toast.error((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  // Settle OpenPay → Pro inbound return
  useEffect(() => {
    if (search.openpay_cancel) {
      toast.error("OpenPay transfer canceled");
      const u = new URL(window.location.href);
      u.searchParams.delete("openpay_cancel");
      window.history.replaceState({}, "", u.toString());
      return;
    }
    if (!search.openpay_in) return;

    (async () => {
      setBusy(true);
      try {
        // 1) Reconcile against the real OpenPay ledger first (authoritative).
        let done = false;
        try {
          const c = await claimInbound({ data: { note: search.openpay_ref } });
          if (c.credited > 0) {
            toast.success(`Received ${formatUSD(c.amount)} from OpenPay`);
            done = true;
          } else if (c.already > 0) {
            toast.info("Already credited");
            done = true;
          }
        } catch {
          /* fall through to redirect settle */
        }

        // 2) Fallback: settle from the redirect params.
        if (!done) {
          const amt = search.amount ? Number(search.amount) : undefined;
          const r = await settleInbound({
            data: {
              openpay_tx: search.openpay_tx,
              note: search.openpay_ref,
              amount: amt && amt > 0 ? amt : undefined,
            },
          });
          if (r.credited) {
            toast.success(
              r.already ? "Already credited" : `Received ${formatUSD(Number(amt || 0))} from OpenPay`,
            );
          }
        }
        await refreshBalances();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(false);
        const u = new URL(window.location.href);
        u.searchParams.delete("openpay_in");
        u.searchParams.delete("openpay_tx");
        u.searchParams.delete("openpay_ref");
        u.searchParams.delete("amount");
        window.history.replaceState({}, "", u.toString());
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.openpay_in, search.openpay_cancel]);

  // Auto-poll for the payment while a receive link is open.
  useEffect(() => {
    if (!opLink) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      if (n > 20) {
        window.clearInterval(id);
        return;
      }
      void checkForPayment({ silent: true });
    }, 15000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opLink?.note]);

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
    a.href = url;
    a.download = `openpay-${wallet?.address?.slice(0, 8)}.png`;
    a.click();
  }

  async function share() {
    if (!payUri) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "OpenPay payment request", text: payUri });
        return;
      } catch {
        /* ignore */
      }
    }
    await navigator.clipboard.writeText(payUri);
    toast.success("Payment link copied");
  }

  async function makeOpenPayLink() {
    setBusy(true);
    try {
      const amt = opAmount ? Number(opAmount) : undefined;
      if (opAmount && (!(amt! > 0) || Number.isNaN(amt))) {
        toast.error("Enter a valid amount");
        return;
      }
      const res = await createReceive({
        data: {
          amount: amt,
          origin: window.location.origin,
        },
      });
      setOpLink(res);
      toast.success("OpenPay receive link ready — share it");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Receive</h1>
        <p className="text-sm text-muted-foreground">
          Share your Pro wallet or get paid from OpenPay
        </p>
      </div>

      {/* OpenPay → Pro */}
      <Card className="glass-strong space-y-4 rounded-3xl border-border/60 p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground">
            <WalletIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Receive from OpenPay</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Generate a link so someone on OpenPay can send OUSD to your Pro wallet (same rail as
              Pay @tag).
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Amount (optional)
          </label>
          <Input
            value={opAmount}
            onChange={(e) => setOpAmount(e.target.value)}
            placeholder="25.00"
            inputMode="decimal"
          />
        </div>

        <Button
          type="button"
          className="w-full rounded-2xl bg-gradient-primary text-primary-foreground"
          disabled={busy}
          onClick={makeOpenPayLink}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create OpenPay receive link
        </Button>

        {opLink && (
          <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
            <div className="mx-auto grid w-fit place-items-center rounded-2xl bg-white p-3">
              <canvas ref={opCanvasRef} className="block" />
            </div>
            <p className="break-all font-mono text-[10px] text-muted-foreground">{opLink.note}</p>
            {opLink.address ? (
              <p className="break-all font-mono text-[10px] text-muted-foreground">
                Pro address · {opLink.address}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(opLink.pay_url);
                  toast.success("OpenPay link copied");
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy link
              </Button>
              <Button asChild size="sm" className="rounded-full">
                <a href={opLink.pay_url} target="_blank" rel="noreferrer">
                  Open
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Payer opens the link on OpenPay, pays
              {opLink.partner_username ? ` @${opLink.partner_username}` : ""}, then you are credited
              on Pro.
            </p>
          </div>
        )}
      </Card>

      <Card className="glass-strong rounded-3xl border-border/60 p-6 text-center">
        <div className="mx-auto grid place-items-center rounded-3xl bg-white p-4 shadow-card">
          <canvas ref={canvasRef} className="block" />
          {!payUri && <QrCode className="h-40 w-40 text-muted-foreground" />}
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Your Pro wallet address
          </div>
          <button
            onClick={copyAddr}
            className="mt-1 inline-flex items-center gap-2 break-all rounded-full bg-muted px-3 py-1.5 font-mono text-xs hover:bg-accent"
          >
            {wallet?.address ?? "—"}
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-left">
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Asset
            </label>
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value as "OUSD" | "PI")}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option>OUSD</option>
              <option>PI</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Amount (optional)
            </label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={share}>
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            Share
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={downloadQR}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            QR
          </Button>
        </div>
      </Card>
    </div>
  );
}
