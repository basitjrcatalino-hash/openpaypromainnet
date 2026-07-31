import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { copyText as copyToClipboardRobust } from "@/lib/clipboard";
import { Loader2, Plus, Copy, Ban, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  checkIsAdmin,
  claimFirstAdmin,
  getTopupSettings,
  updateTopupSettings,
  listVouchers,
  createVouchers,
  disableVoucher,
  listTopupMethods,
  updateTopupMethod,
} from "@/lib/topup-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/topup")({
  head: () => ({ meta: [{ title: "Admin · Top Up" }] }),
  component: AdminTopupPage,
});

function AdminTopupPage() {
  const qc = useQueryClient();
  const check = useServerFn(checkIsAdmin);
  const claim = useServerFn(claimFirstAdmin);
  const getSettings = useServerFn(getTopupSettings);
  const saveSettings = useServerFn(updateTopupSettings);
  const listV = useServerFn(listVouchers);
  const createV = useServerFn(createVouchers);
  const disableV = useServerFn(disableVoucher);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => check() });
  const isAdmin = !!adminQ.data?.isAdmin;

  const settingsQ = useQuery({
    queryKey: ["topup-settings"],
    queryFn: () => getSettings(),
    enabled: isAdmin,
  });
  const vouchersQ = useQuery({
    queryKey: ["vouchers"],
    queryFn: () => listV(),
    enabled: isAdmin,
  });
  const listM = useServerFn(listTopupMethods);
  const saveMethod = useServerFn(updateTopupMethod);
  const methodsQ = useQuery({
    queryKey: ["topup-methods-admin"],
    queryFn: () => listM(),
    enabled: isAdmin,
  });

  const [url, setUrl] = useState("");
  const [instructions, setInstructions] = useState("");
  const [feePercent, setFeePercent] = useState("0");
  const [feeWallet, setFeeWallet] = useState("");
  const [amount, setAmount] = useState("10");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");

  if (adminQ.isLoading) {
    return (
      <div className="grid place-items-center p-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md">
        <Card className="p-6 text-center space-y-3">
          <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
          <h2 className="text-lg font-semibold">Admin access required</h2>
          <p className="text-sm text-muted-foreground">
            If no admin exists yet, you can claim it now (first user only).
          </p>
          <Button
            onClick={async () => {
              try {
                const r = await claim();
                if (r.claimed) { toast.success("You are now admin"); adminQ.refetch(); }
                else toast.error("Admin already exists");
              } catch (e) { toast.error((e as Error).message); }
            }}
          >
            Claim admin
          </Button>
        </Card>
      </div>
    );
  }

  const settings = settingsQ.data;
  if (settings && url === "" && instructions === "" && feePercent === "0" && feeWallet === "") {
    if (settings.openpay_payment_url) setUrl(settings.openpay_payment_url);
    if (settings.instructions) setInstructions(settings.instructions);
    if (settings.fee_bps != null) setFeePercent(String(Number(settings.fee_bps) / 100));
    if (settings.fee_wallet_address) setFeeWallet(settings.fee_wallet_address);
  }

  const saveM = useMutation({
    mutationFn: () => {
      const bps = Math.round(Number(feePercent || 0) * 100);
      return saveSettings({
        data: {
          openpay_payment_url: url || null,
          instructions: instructions || null,
          fee_bps: Number.isFinite(bps) ? Math.max(0, Math.min(10_000, bps)) : 0,
          fee_wallet_address: feeWallet.trim() || null,
        },
      });
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["topup-settings"] }); qc.invalidateQueries({ queryKey: ["public-topup"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createM = useMutation({
    mutationFn: () =>
      createV({ data: { amount_ousd: Number(amount), quantity: Number(qty), note: note || null } }),
    onSuccess: () => {
      toast.success(`${qty} voucher(s) created`);
      setNote("");
      qc.invalidateQueries({ queryKey: ["vouchers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disableM = useMutation({
    mutationFn: (id: string) => disableV({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vouchers"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="ph-page mx-auto max-w-3xl space-y-6 md:max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin · Top Up</h1>
        <p className="text-sm text-muted-foreground">Manage the OpenPay payment link and vouchers</p>
      </div>

      <Card className="space-y-4 rounded-2xl border-0 p-5 shadow-none">
        <h2 className="text-lg font-semibold">OpenPay payment link</h2>
        <div className="space-y-2">
          <Label>Payment URL shown to users</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://openpy.space/qr-pay/qrp_..." />
        </div>
        <div className="space-y-2">
          <Label>Instructions (optional)</Label>
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3}
            placeholder="Pay the exact amount on OpenPay. After payment you will receive a voucher code. Enter it here to credit your balance." />
        </div>
        <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
          {saveM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save settings
        </Button>
      </Card>

      <Card className="space-y-4 rounded-2xl border-0 p-5 shadow-none">
        <h2 className="text-lg font-semibold">Top-up fee</h2>
        <p className="text-sm text-muted-foreground">
          Fee is deducted from each top-up before crediting the user. The same fee wallet
          also receives OpenToken / OpenDEX / major-buy platform fees (0.30%).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Fee (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={feePercent}
              onChange={(e) => setFeePercent(e.target.value)}
              placeholder="e.g. 1.5"
            />
            <p className="text-xs text-muted-foreground">0 = no fee. Example: 1.5% on $100 → $1.50 fee.</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Fee wallet address</Label>
            <Input
              value={feeWallet}
              onChange={(e) => setFeeWallet(e.target.value)}
              placeholder="0x… or @openpay"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Must match an existing OpenPay Pro wallet address, or a profile username like{" "}
              <code className="rounded bg-muted px-1">@openpay</code>. Used for top-up fees and
              platform trade fees (OpenToken buy/sell, OpenDEX, major buys).
            </p>
          </div>
        </div>
        <Button onClick={() => saveM.mutate()} disabled={saveM.isPending} variant="secondary">
          {saveM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save fee settings
        </Button>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-lg font-semibold">Create vouchers</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Amount (OUSD)</Label>
            <Input type="number" min="0.01" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input type="number" min="1" max="50" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2 md:col-span-1">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. order #1234" />
          </div>
        </div>
        <Button onClick={() => createM.mutate()} disabled={createM.isPending}>
          {createM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Create
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-lg font-semibold">Vouchers</h2>
        {vouchersQ.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !vouchersQ.data?.length ? (
          <p className="text-sm text-muted-foreground">No vouchers yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {vouchersQ.data.map((v: any) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{v.code}</code>
                    <button
                      onClick={() => { void copyToClipboardRobust(v.code).then(() => toast.success("Copied"), () => toast.error("Copy failed")); }}
                      className="text-muted-foreground hover:text-foreground"
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <Badge variant={v.status === "active" ? "default" : "secondary"}>{v.status}</Badge>
                  </div>
                  {v.note && <div className="mt-0.5 truncate text-xs text-muted-foreground">{v.note}</div>}
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{Number(v.amount_ousd).toFixed(2)} OUSD</div>
                  <div className="text-[11px] text-muted-foreground">
                    {v.redeemed_at ? `Redeemed ${new Date(v.redeemed_at).toLocaleDateString()}` : new Date(v.created_at).toLocaleDateString()}
                  </div>
                </div>
                {v.status === "active" && (
                  <Button size="sm" variant="ghost" onClick={() => disableM.mutate(v.id)} disabled={disableM.isPending}>
                    <Ban className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}