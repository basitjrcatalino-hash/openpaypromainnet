import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

const sendSearchSchema = z.object({
  to: z.string().optional(),
  amount: z.string().optional(),
  asset: z.enum(["OUSD", "PI"]).optional(),
});

export const Route = createFileRoute("/_authenticated/send")({
  head: () => ({ meta: [{ title: "Send — OpenPay Pro Wallet" }] }),
  validateSearch: (search) => sendSearchSchema.parse(search),
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
  } catch {
    // fall through to raw text
  }
  return { to: text.trim() };
}

function SendPage() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const send = useServerFn(sendAsset);
  const sendOpenPay = useServerFn(sendViaOpenPay);
  const resolveOP = useServerFn(resolveOpenPayAccount);
  const [busy, setBusy] = useState(false);
  const [rail, setRail] = useState<Rail>("wallet");
  const [opPreview, setOpPreview] = useState<{
    name?: string;
    username?: string;
    account_number?: string;
  } | null>(null);
  const [opError, setOpError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    to: string;
    amount: string;
    asset: "OUSD" | "PI";
    memo: string;
  }>({
    to: search.to ?? "",
    amount: search.amount ?? "",
    asset: search.asset ?? "OUSD",
    memo: "",
  });

  useEffect(() => {
    if (!search.to && !search.amount && !search.asset) return;
    setForm((f) => ({
      ...f,
      to: search.to ?? f.to,
      amount: search.amount ?? f.amount,
      asset: search.asset ?? f.asset,
    }));
  }, [search.to, search.amount, search.asset]);

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () =>
      (await supabase.from("wallets").select("*").eq("user_id", user.id).limit(1).maybeSingle())
        .data,
  });

  function applyScan(text: string) {
    const p = parseScanned(text);
    setForm((f) => ({ ...f, to: p.to, amount: p.amount ?? f.amount, asset: p.asset ?? f.asset }));
    toast.success("Scanned");
  }

  async function verifyOpenPay() {
    if (!form.to.trim()) return;
    setOpError(null);
    setOpPreview(null);
    try {
      const identifier = form.to.trim().replace(/^@+/, "");
      const r = await resolveOP({ data: { identifier } });
      if (r.ok) {
        setOpPreview(r.account);
        if (identifier !== form.to.trim()) {
          setForm((f) => ({ ...f, to: identifier }));
        }
      } else setOpError(r.error);
    } catch (e) {
      setOpError((e as Error).message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid");
      return;
    }
    if (!wallet) return;

    setBusy(true);
    try {
      if (rail === "openpay") {
        if (parsed.data.asset !== "OUSD") throw new Error("OpenPay rail supports OUSD only");
        const res = await sendOpenPay({
          data: { to: parsed.data.to, amount: parsed.data.amount, note: parsed.data.memo ?? null },
        });
        toast.success(`Sent ${parsed.data.amount} OUSD via OpenPay to ${parsed.data.to}`);
        void res;
      } else {
        if (parsed.data.to === wallet.address) {
          toast.error("Cannot send to your own address");
          return;
        }
        const res = await send({ data: parsed.data });
        toast.success(
          res.credited
            ? `Sent ${parsed.data.amount} ${parsed.data.asset} — recipient credited`
            : `Sent ${parsed.data.amount} ${parsed.data.asset}`,
        );
      }
      setForm({ to: "", amount: "", asset: parsed.data.asset, memo: "" });
      setOpPreview(null);
      qc.invalidateQueries({ queryKey: ["active-wallet", user.id] });
      qc.invalidateQueries({ queryKey: ["txs", wallet.id] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Send</h1>
        <p className="text-sm text-muted-foreground">
          Transfer within OpenPay Pro or push OpenPay balance
        </p>
      </div>

      <Card className="glass-strong rounded-3xl border-border/60 p-5">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border p-1">
            <button
              type="button"
              onClick={() => setRail("wallet")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                rail === "wallet"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              OpenPay Pro wallet
            </button>
            <button
              type="button"
              onClick={() => setRail("openpay")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                rail === "openpay"
                  ? "bg-[#0070BA] text-white"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              OpenPay balance
            </button>
          </div>

          <Field
            label={
              rail === "openpay"
                ? "OpenPay @username, OP account, or email"
                : "Recipient address or @username"
            }
          >
            <div className="flex gap-2">
              <Input
                value={form.to}
                onChange={(e) => {
                  setForm({ ...form, to: e.target.value });
                  setOpPreview(null);
                  setOpError(null);
                }}
                onBlur={rail === "openpay" ? verifyOpenPay : undefined}
                placeholder={rail === "openpay" ? "@satoshi, OP…, or email" : "0x… or @username"}
                required
              />
              {rail === "wallet" && (
                <QrScannerButton
                  onResult={applyScan}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="rounded-xl shrink-0"
                      aria-label="Scan QR"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  }
                />
              )}
            </div>
            {rail === "openpay" && opPreview && (
              <div className="mt-2 rounded-xl border border-border bg-muted/40 p-2 text-xs">
                <div className="font-semibold">{opPreview.name ?? opPreview.username}</div>
                <div className="text-muted-foreground">
                  {opPreview.username ? `@${opPreview.username.replace(/^@/, "")}` : ""}{" "}
                  {opPreview.account_number ? `· ${opPreview.account_number}` : ""}
                </div>
              </div>
            )}
            {rail === "openpay" && opError && (
              <div className="mt-2 text-xs text-destructive">{opError}</div>
            )}
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Asset">
              <select
                value={form.asset}
                onChange={(e) => setForm({ ...form, asset: e.target.value as "OUSD" | "PI" })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={rail === "openpay"}
              >
                <option>OUSD</option>
                {rail === "wallet" && <option>PI</option>}
              </select>
            </Field>
            <Field
              className="col-span-2"
              label={`Amount (Balance: ${formatNumber(form.asset === "OUSD" ? wallet?.ousd_balance : wallet?.pi_balance, 4)})`}
            >
              <Input
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                type="number"
                min="0"
                step="any"
                required
              />
            </Field>
          </div>
          <Field label="Note (optional)">
            <Textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              maxLength={140}
              rows={2}
            />
          </Field>
          <Button
            type="submit"
            disabled={busy}
            className={cn(
              "h-12 w-full rounded-2xl text-base font-semibold text-primary-foreground shadow-glow",
              rail === "openpay" ? "bg-[#0070BA] hover:opacity-90" : "bg-gradient-primary",
            )}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <SendIcon className="mr-2 h-4 w-4" />
            )}
            {rail === "openpay" ? "Send via OpenPay" : "Send"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
