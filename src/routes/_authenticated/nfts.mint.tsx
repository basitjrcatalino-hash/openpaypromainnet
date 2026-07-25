import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ImagePlus, Sparkles, Upload } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { uploadMedia } from "@/lib/upload";


export const Route = createFileRoute("/_authenticated/nfts/mint")({
  head: () => ({ meta: [{ title: "Mint NFT — OpenPay Pro Wallet" }] }),
  component: MintNFT,
});

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).optional(),
  media_url: z.string().url("Provide a valid media URL"),
  price: z.coerce.number().min(0).max(1e9),
  royalty_bps: z.coerce.number().int().min(0).max(2000),
  collection_id: z.string().uuid().optional(),
});

function MintNFT() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: "", description: "", media_url: "", price: 1, royalty_bps: 500, collection_id: "" });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error("Max 25MB"); return; }
    setUploading(true);
    try {
      const url = await uploadMedia(file, user.id, "nfts");
      setForm((f) => ({ ...f, media_url: url }));
      toast.success("Uploaded");
    } catch (err) { toast.error((err as Error).message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }


  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("id").eq("user_id", user.id).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: collections = [] } = useQuery({
    queryKey: ["my-collections", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("nft_collections").select("id, name").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ ...form, collection_id: form.collection_id || undefined });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid"); return; }
    if (!wallet) { toast.error("No wallet found"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("nfts").insert({
        creator_id: user.id,
        owner_wallet_id: wallet.id,
        collection_id: parsed.data.collection_id ?? null,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        media_url: parsed.data.media_url,
        media_type: "image",
        price: parsed.data.price,
        royalty_bps: parsed.data.royalty_bps,
        listed: true,
      });
      if (error) throw error;

      // Record mint on the public ledger (mirrored via trigger)
      const { error: txErr } = await supabase.from("transactions").insert({
        wallet_id: wallet.id,
        type: "mint",
        status: "confirmed",
        token_symbol: "NFT",
        counterparty: parsed.data.name,
        amount: Number(parsed.data.price) || 0,
        usd_value: Number(parsed.data.price) || 0,
        memo: `Minted NFT · ${parsed.data.name}`,
      });
      if (txErr) throw txErr;

      void qc.invalidateQueries({ queryKey: ["txs", wallet.id] });
      void qc.invalidateQueries({ queryKey: ["ledger-entries"] });
      void qc.invalidateQueries({ queryKey: ["ledger-overview"] });

      toast.success("NFT minted!");
      navigate({ to: "/nfts" });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/nfts" })}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
      </Button>
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Mint NFT</h1>
        <p className="text-sm text-muted-foreground">Create a one-of-a-kind digital asset.</p>
      </div>

      <Card className="glass-strong rounded-3xl border-border/60 p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-muted-foreground">
            {form.media_url ? (
              <img src={form.media_url} alt="preview" className="max-h-48 rounded-xl object-contain" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
            <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={onFile} />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                Upload file
              </Button>
              <span className="text-xs">or paste a URL</span>
            </div>
            <Input className="max-w-md" value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} placeholder="https://…/art.png" required />
          </div>


          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required /></Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} rows={3} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Price (OUSD)"><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} min={0} step="0.01" /></Field>
            <Field label="Royalty (bps)"><Input type="number" value={form.royalty_bps} onChange={(e) => setForm({ ...form, royalty_bps: Number(e.target.value) })} min={0} max={2000} /></Field>
          </div>
          {collections.length > 0 && (
            <Field label="Collection (optional)">
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.collection_id} onChange={(e) => setForm({ ...form, collection_id: e.target.value })}>
                <option value="">— None —</option>
                {collections.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}

          <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl bg-gradient-primary text-base font-semibold text-primary-foreground shadow-glow">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Mint NFT
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
