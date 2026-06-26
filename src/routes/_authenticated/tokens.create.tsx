import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Sparkles, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { generateAddress } from "@/lib/wallet-utils";
import { uploadMedia } from "@/lib/upload";


export const Route = createFileRoute("/_authenticated/tokens/create")({
  head: () => ({ meta: [{ title: "Create token — OpenPay Pro Wallet" }] }),
  component: CreateToken,
});

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  symbol: z.string().trim().min(1).max(10).regex(/^[A-Z0-9]+$/, "Uppercase letters/numbers only"),
  description: z.string().trim().max(500).optional(),
  totalSupply: z.coerce.number().positive().max(1e15),
  decimals: z.coerce.number().int().min(0).max(18),
  website: z.string().url().optional().or(z.literal("")),
  twitter: z.string().max(60).optional().or(z.literal("")),
  telegram: z.string().max(60).optional().or(z.literal("")),
  taxBps: z.coerce.number().int().min(0).max(1000),
});

function CreateToken() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "", symbol: "", description: "", totalSupply: 1000000, decimals: 18,
    website: "", twitter: "", telegram: "", taxBps: 0, logo_url: "",
    burnable: true, mintable: false, pausable: false, autoLiquidity: false,
  });

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setUploading(true);
    try {
      const url = await uploadMedia(file, user.id, "tokens");
      set("logo_url", url);
      toast.success("Logo uploaded");
    } catch (err) { toast.error((err as Error).message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("tokens").insert({
        creator_id: user.id,
        name: parsed.data.name,
        symbol: parsed.data.symbol,
        description: parsed.data.description || null,
        total_supply: parsed.data.totalSupply,
        decimals: parsed.data.decimals,
        contract_address: generateAddress(),
        logo_url: form.logo_url || null,
        website: parsed.data.website || null,
        twitter: parsed.data.twitter || null,
        telegram: parsed.data.telegram || null,
        burnable: form.burnable,
        mintable: form.mintable,
        pausable: form.pausable,
        tax_bps: parsed.data.taxBps,
        auto_liquidity: form.autoLiquidity,
        price_usd: 0.01,
      });
      if (error) throw error;
      toast.success(`${parsed.data.symbol} token created!`);
      navigate({ to: "/tokens" });

    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/tokens" })}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Launch your token</h1>
        <p className="text-sm text-muted-foreground">Configure your token's identity, supply and advanced features.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <Card className="glass-strong rounded-3xl border-border/60 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identity</h2>
          <div className="mb-4 flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-gradient-primary text-xs font-bold text-primary-foreground">
              {form.logo_url ? <img src={form.logo_url} alt="logo" className="h-full w-full object-cover" /> : (form.symbol || "?").slice(0, 3)}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogo} />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                Upload logo
              </Button>
              <p className="mt-1 text-[11px] text-muted-foreground">PNG, JPG or SVG. Max 5MB.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Token name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="OpenPay Demo" maxLength={60} required /></Field>
            <Field label="Symbol"><Input value={form.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())} placeholder="OPD" maxLength={10} required /></Field>
            <Field label="Total supply"><Input type="number" value={form.totalSupply} onChange={(e) => set("totalSupply", Number(e.target.value))} min={1} required /></Field>
            <Field label="Decimals"><Input type="number" value={form.decimals} onChange={(e) => set("decimals", Number(e.target.value))} min={0} max={18} required /></Field>
            <Field className="md:col-span-2" label="Description">
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What is this token about?" maxLength={500} rows={3} />
            </Field>
          </div>

        </Card>

        <Card className="glass-strong rounded-3xl border-border/60 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Social</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Website"><Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" /></Field>
            <Field label="Twitter"><Input value={form.twitter} onChange={(e) => set("twitter", e.target.value)} placeholder="@handle" /></Field>
            <Field label="Telegram"><Input value={form.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="t.me/…" /></Field>
          </div>
        </Card>

        <Card className="glass-strong rounded-3xl border-border/60 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Advanced</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Toggle label="Burnable" desc="Holders can burn tokens" value={form.burnable} onChange={(v) => set("burnable", v)} />
            <Toggle label="Mintable" desc="Creator can mint more later" value={form.mintable} onChange={(v) => set("mintable", v)} />
            <Toggle label="Pausable" desc="Pause transfers in emergencies" value={form.pausable} onChange={(v) => set("pausable", v)} />
            <Toggle label="Auto liquidity" desc="Send a portion of tax to LP" value={form.autoLiquidity} onChange={(v) => set("autoLiquidity", v)} />
            <Field className="md:col-span-2" label="Tax (basis points)">
              <Input type="number" value={form.taxBps} onChange={(e) => set("taxBps", Number(e.target.value))} min={0} max={1000} />
              <p className="mt-1 text-xs text-muted-foreground">100 bps = 1%. Max 10%.</p>
            </Field>
          </div>
        </Card>

        <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl bg-gradient-primary text-base font-semibold text-primary-foreground shadow-glow md:w-auto md:px-10">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Launch token
        </Button>
      </form>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-4">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
