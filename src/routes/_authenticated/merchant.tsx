import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Download,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Store,
  Webhook,
  X,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { PageHeader } from "@/components/wallet/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import {
  cancelInvoice,
  createInvoice,
  getMyMerchant,
  listInvoices,
  refreshInvoice,
  rotateMerchantCredentials,
  saveMerchant,
} from "@/lib/payments-gateway.functions";

export const Route = createFileRoute("/_authenticated/merchant")({
  head: () => ({
    meta: [
      { title: "Merchant Payments — OpenPay Pro" },
      {
        name: "description",
        content:
          "Accept crypto payments on Ethereum, Base, Solana, Polygon and more. Create invoices, payment links and QR codes.",
      },
      { property: "og:title", content: "Merchant Payments — OpenPay Pro" },
      {
        property: "og:description",
        content: "Multi-chain crypto payment gateway for OpenPay Pro merchants.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MerchantPage,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500",
  detected: "bg-sky-500/15 text-sky-500",
  paid: "bg-emerald-500/15 text-emerald-500",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
};

async function copy(value: string, label: string) {
  try {
    await copyText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Copy failed");
  }
}

function MerchantPage() {
  const qc = useQueryClient();
  const merchantQ = useQuery({ queryKey: ["merchant"], queryFn: () => getMyMerchant() });
  const invoicesQ = useQuery({
    queryKey: ["merchant-invoices"],
    queryFn: () => listInvoices(),
    refetchInterval: 20_000,
  });

  const merchant = merchantQ.data?.merchant as any;
  const invoices = (invoicesQ.data?.invoices ?? []) as any[];
  const deliveries = (invoicesQ.data?.deliveries ?? []) as any[];

  const [form, setForm] = useState({ name: "", slug: "", website: "", webhook_url: "" });
  const [inv, setInv] = useState({ amount: "", description: "", reference: "", expires: "60" });
  const [secret, setSecret] = useState<{ value: string; kind: string } | null>(null);
  const [qrFor, setQrFor] = useState<{ url: string; image: string } | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const payUrl = (token: string) => `${origin}/pay/${token}`;

  const save = useMutation({
    mutationFn: () =>
      saveMerchant({
        data: {
          name: form.name || merchant?.name || "",
          slug: form.slug || merchant?.slug || "",
          website: form.website || merchant?.website || null,
          webhook_url: form.webhook_url || merchant?.webhook_url || null,
          settlement_symbol: "OUSD",
        },
      }),
    onSuccess: () => {
      toast.success("Merchant profile saved");
      void qc.invalidateQueries({ queryKey: ["merchant"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rotate = useMutation({
    mutationFn: (what: "api_key" | "webhook_secret") => rotateMerchantCredentials({ data: { what } }),
    onSuccess: (res) => {
      setSecret({ value: res.secret, kind: res.kind });
      void qc.invalidateQueries({ queryKey: ["merchant"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: () =>
      createInvoice({
        data: {
          amount_usd: Number(inv.amount),
          description: inv.description || null,
          reference: inv.reference || null,
          expires_minutes: Number(inv.expires) || 60,
        },
      }),
    onSuccess: () => {
      toast.success("Invoice created");
      setInv({ amount: "", description: "", reference: "", expires: "60" });
      void qc.invalidateQueries({ queryKey: ["merchant-invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recheck = useMutation({
    mutationFn: (id: string) => refreshInvoice({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["merchant-invoices"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelInvoice({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["merchant-invoices"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function showQr(token: string) {
    const url = payUrl(token);
    const image = await QRCode.toDataURL(url, { margin: 1, width: 360 });
    setQrFor({ url, image });
  }

  function exportCsv() {
    const rows = [
      ["created_at", "reference", "amount_usd", "status", "chain", "token", "tx_hash", "paid_at"],
      ...invoices.map((i) => [
        i.created_at,
        i.reference ?? "",
        i.amount_usd,
        i.status,
        i.chain_key ?? "",
        i.token_symbol ?? "",
        i.tx_hash ?? "",
        i.paid_at ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `openpay-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const paid = invoices.filter((i) => i.status === "paid");
  const volume = paid.reduce((sum, i) => sum + Number(i.amount_usd), 0);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 pb-24">
      <PageHeader title="Merchant payments" backTo="/dashboard" />

      {merchantQ.isLoading ? (
        <Card className="flex items-center justify-center p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </Card>
      ) : !merchant ? (
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Create your merchant account</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Accept crypto on Ethereum, Base, Solana, Polygon, BNB Chain, Arbitrum, Optimism and
            Avalanche. Payments settle to your OpenPay Pro balance in OUSD.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="m-name">Store name</Label>
              <Input
                id="m-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Pi Coffee Shop"
              />
            </div>
            <div>
              <Label htmlFor="m-slug">Store handle</Label>
              <Input
                id="m-slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                placeholder="pi-coffee"
              />
            </div>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create merchant account
          </Button>
        </Card>
      ) : (
        <Tabs defaultValue="invoices">
          <TabsList className="w-full">
            <TabsTrigger value="invoices" className="flex-1">
              Payments
            </TabsTrigger>
            <TabsTrigger value="new" className="flex-1">
              New invoice
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="text-lg font-bold">{paid.length}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Volume</p>
                <p className="text-lg font-bold">${volume.toFixed(2)}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-lg font-bold">
                  {invoices.filter((i) => i.status === "pending" || i.status === "detected").length}
                </p>
              </Card>
            </div>

            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Payment history</h2>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={exportCsv} aria-label="Export CSV">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void invoicesQ.refetch()}
                    aria-label="Refresh"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <ul className="space-y-2">
                  {invoices.map((i) => (
                    <li key={i.id} className="rounded-xl border border-border/60 p-3">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            ${Number(i.amount_usd).toFixed(2)} · {i.reference ?? i.description ?? "Invoice"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {i.chain_key ? `${i.token_symbol} on ${i.chain_key}` : "Awaiting network choice"}
                            {i.tx_hash ? ` · ${i.tx_hash.slice(0, 14)}…` : ""}
                          </p>
                        </div>
                        <Badge className={cn("border-0", STATUS_TONE[i.status] ?? "")}>
                          {i.status === "detected"
                            ? `${i.confirmations}/${i.required_confirmations}`
                            : i.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" onClick={() => copy(payUrl(i.public_token), "Payment link")}>
                          <Link2 className="mr-1 h-3.5 w-3.5" /> Link
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void showQr(i.public_token)}>
                          <QrCode className="mr-1 h-3.5 w-3.5" /> QR
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => recheck.mutate(i.id)}>
                          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Re-check
                        </Button>
                        {i.status === "pending" || i.status === "detected" ? (
                          <Button size="sm" variant="ghost" onClick={() => cancel.mutate(i.id)}>
                            <X className="mr-1 h-3.5 w-3.5" /> Cancel
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Webhook className="h-4 w-4" /> Recent webhook deliveries
              </h2>
              {deliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No webhooks sent yet.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {deliveries.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-muted-foreground">
                        {d.event} → {d.url}
                      </span>
                      <Badge variant="outline">{d.response_code ?? d.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="new">
            <Card className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="i-amount">Amount (USD)</Label>
                  <Input
                    id="i-amount"
                    inputMode="decimal"
                    value={inv.amount}
                    onChange={(e) => setInv({ ...inv, amount: e.target.value })}
                    placeholder="25.00"
                  />
                </div>
                <div>
                  <Label htmlFor="i-ref">Reference</Label>
                  <Input
                    id="i-ref"
                    value={inv.reference}
                    onChange={(e) => setInv({ ...inv, reference: e.target.value })}
                    placeholder="ORDER-1042"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="i-desc">Description</Label>
                  <Input
                    id="i-desc"
                    value={inv.description}
                    onChange={(e) => setInv({ ...inv, description: e.target.value })}
                    placeholder="Large latte + croissant"
                  />
                </div>
                <div>
                  <Label htmlFor="i-exp">Expires in (minutes)</Label>
                  <Input
                    id="i-exp"
                    inputMode="numeric"
                    value={inv.expires}
                    onChange={(e) => setInv({ ...inv, expires: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={() => create.mutate()} disabled={!Number(inv.amount) || create.isPending}>
                {create.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create payment request
              </Button>
              <p className="text-xs text-muted-foreground">
                The customer picks the blockchain and token on the checkout page. Funds settle to your
                OpenPay Pro balance once confirmed.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="s-name">Store name</Label>
                  <Input
                    id="s-name"
                    defaultValue={merchant.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="s-slug">Store handle</Label>
                  <Input
                    id="s-slug"
                    defaultValue={merchant.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                  />
                </div>
                <div>
                  <Label htmlFor="s-site">Website</Label>
                  <Input
                    id="s-site"
                    defaultValue={merchant.website ?? ""}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="s-hook">Webhook URL</Label>
                  <Input
                    id="s-hook"
                    defaultValue={merchant.webhook_url ?? ""}
                    onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                    placeholder="https://example.com/openpay/webhook"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  Save
                </Button>
                <Button variant="outline" onClick={() => rotate.mutate("api_key")}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  {merchant.api_key_prefix ? "Rotate API key" : "Generate API key"}
                </Button>
                <Button variant="outline" onClick={() => rotate.mutate("webhook_secret")}>
                  <Webhook className="mr-2 h-4 w-4" /> Rotate webhook secret
                </Button>
              </div>
              {merchant.api_key_prefix ? (
                <p className="text-xs text-muted-foreground">
                  Active API key: <code>{merchant.api_key_prefix}…</code>
                </p>
              ) : null}
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-semibold text-foreground">API</p>
                <p>POST {origin}/api/public/payments/create</p>
                <p>GET {origin}/api/public/payments/status/&#123;id&#125;</p>
                <p>GET {origin}/api/public/payments/chains</p>
                <p className="mt-1">
                  Authenticate with the header <code>x-api-key</code>. Webhooks are signed with
                  HMAC-SHA256 in <code>x-openpay-signature</code>.
                </p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={Boolean(secret)} onOpenChange={() => setSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your {secret?.kind === "api_key" ? "API key" : "webhook secret"}</DialogTitle>
            <DialogDescription>This value is shown once and cannot be recovered.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-muted p-2 text-xs">{secret?.value}</code>
            <Button size="icon" variant="ghost" onClick={() => copy(secret!.value, "Secret")}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(qrFor)} onOpenChange={() => setQrFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment QR</DialogTitle>
            <DialogDescription>Let the customer scan this to open the checkout page.</DialogDescription>
          </DialogHeader>
          {qrFor ? (
            <div className="space-y-3">
              <img src={qrFor.image} alt="Payment QR code" className="mx-auto h-56 w-56 rounded-xl bg-white p-2" />
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate text-xs">{qrFor.url}</code>
                <Button size="icon" variant="ghost" onClick={() => copy(qrFor.url, "Payment link")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
