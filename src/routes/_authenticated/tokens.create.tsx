import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Sparkles, Upload, Link2, ChevronDown,
  Coins, Activity, Bot, DollarSign, CircleDollarSign, Info, Image as ImageIcon, FileImage,
} from "lucide-react";

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
  head: () => ({ meta: [{ title: "Create new coin — OpenPay Pro Wallet" }] }),
  component: CreateToken,
});

const schema = z.object({
  name: z.string().trim().min(1, "Coin name required").max(60),
  symbol: z.string().trim().min(1, "Ticker required").max(10).regex(/^[A-Z0-9]+$/, "Uppercase letters/numbers only"),
  description: z.string().trim().max(500).optional(),
  website: z.string().url().optional().or(z.literal("")),
  twitter: z.string().max(120).optional().or(z.literal("")),
  telegram: z.string().max(120).optional().or(z.literal("")),
});

function CreateToken() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showSocial, setShowSocial] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "", symbol: "", description: "",
    website: "", twitter: "", telegram: "",
    logo_url: "", banner_url: "",
    shareRewards: false,   // -> auto_liquidity
    mayhem: false,         // -> pausable
    tokenizedAgent: false, // -> mintable
    cashback: false,       // -> burnable
    pairUsdc: false,
  });

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logo_url" | "banner_url",
    maxMb: number,
    setBusy: (v: boolean) => void,
    ref: React.RefObject<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) { toast.error(`Max ${maxMb}MB`); return; }
    setBusy(true);
    try {
      const url = await uploadMedia(file, user.id, "tokens");
      set(field, url);
      toast.success("Uploaded");
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (!form.logo_url) { toast.error("Upload a coin image"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("tokens").insert({
        creator_id: user.id,
        name: parsed.data.name,
        symbol: parsed.data.symbol,
        description: parsed.data.description || null,
        total_supply: 1_000_000_000,
        decimals: 9,
        contract_address: generateAddress(),
        logo_url: form.logo_url || null,
        website: parsed.data.website || null,
        twitter: parsed.data.twitter || null,
        telegram: parsed.data.telegram || null,
        burnable: form.cashback,
        mintable: form.tokenizedAgent,
        pausable: form.mayhem,
        tax_bps: form.cashback ? 100 : 0,
        auto_liquidity: form.shareRewards,
        price_usd: 0.01,
      });
      if (error) throw error;
      toast.success(`${parsed.data.symbol} coin created!`);
      navigate({ to: "/tokens" });

    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/tokens" })}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
      </Button>

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* LEFT — form */}
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Create new coin</h1>
          </div>

          <Card className="glass-strong space-y-5 rounded-3xl border-border/60 p-6">
            <div>
              <h2 className="text-base font-semibold">Coin details</h2>
              <p className="text-xs text-muted-foreground">Choose carefully, these can't be changed once the coin is created</p>
            </div>

            <Card className="rounded-2xl border-border/60 bg-card/40 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Coin name">
                  <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="OpenPay" maxLength={60} required />
                </Field>
                <Field label="Ticker">
                  <Input value={form.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())} placeholder="OPAY" maxLength={10} required />
                </Field>
              </div>
              <div className="mt-4">
                <Field label={<>Description <span className="text-muted-foreground">(Optional)</span></>}>
                  <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Tell the world about your coin" maxLength={500} rows={4} />
                </Field>
              </div>

              {/* Social links */}
              <button type="button" onClick={() => setShowSocial((s) => !s)} className="mt-5 flex items-center gap-2 text-sm font-semibold text-success">
                <Link2 className="h-4 w-4" /> Add social links <span className="text-muted-foreground">(Optional)</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showSocial ? "rotate-180" : ""}`} />
              </button>
              {showSocial && (
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <Field label="Website"><Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="Add URL" /></Field>
                  <Field label="X"><Input value={form.twitter} onChange={(e) => set("twitter", e.target.value)} placeholder="Add URL" /></Field>
                  <Field label="Telegram" className="md:col-span-2"><Input value={form.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="Add URL" /></Field>
                </div>
              )}

              {/* Feature toggles */}
              <div className="mt-6 space-y-3">
                <FeatureRow
                  icon={<Coins className="h-5 w-5" />}
                  title="Share creator rewards"
                  desc="Share creator rewards with wallets or charities."
                  value={form.shareRewards} onChange={(v) => set("shareRewards", v)}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <FeatureRow
                      icon={<Activity className="h-5 w-5 text-success" />}
                      title="Mayhem mode"
                      desc="Increased price volume."
                      value={form.mayhem} onChange={(v) => set("mayhem", v)}
                    />
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Info className="h-3 w-3" /> Active for 24h, only set at creation. May increase coin supply. <span className="text-success">Learn more</span>
                    </p>
                  </div>
                  <div>
                    <FeatureRow
                      icon={<Bot className="h-5 w-5 text-success" />}
                      title="Tokenized agent"
                      desc="Automated buybacks & burns."
                      value={form.tokenizedAgent} onChange={(v) => set("tokenizedAgent", v)}
                    />
                    <p className="mt-1.5 text-[11px] text-muted-foreground">Automated buybacks through agentic revenue.<span className="text-success"> Learn more</span></p>
                  </div>
                  <FeatureRow
                    icon={<DollarSign className="h-5 w-5" />}
                    title="Cash back"
                    desc="Creator rewards go to traders."
                    value={form.cashback} onChange={(v) => set("cashback", v)}
                  />
                  <FeatureRow
                    icon={<CircleDollarSign className="h-5 w-5 text-primary" />}
                    title="Pair with USDC"
                    desc="Create your coin with USDC liquidity."
                    value={form.pairUsdc} onChange={(v) => set("pairUsdc", v)}
                  />
                </div>
              </div>
            </Card>

            {/* Image upload */}
            <Card className="rounded-2xl border-border/60 bg-card/40 p-5">
              <input ref={logoRef} type="file" accept="image/*,video/mp4" hidden
                onChange={(e) => handleUpload(e, "logo_url", 15, setUploadingLogo, logoRef)} />
              <div className="relative grid min-h-[280px] place-items-center overflow-hidden rounded-2xl border border-dashed border-border/60 bg-background/40 p-6">
                {form.logo_url ? (
                  <>
                    <img src={form.logo_url} alt="coin" className="max-h-[260px] rounded-2xl object-contain" />
                    <Button type="button" size="sm" variant="secondary" className="absolute bottom-3 right-3" onClick={() => logoRef.current?.click()}>
                      Replace
                    </Button>
                  </>
                ) : (
                  <button type="button" onClick={() => logoRef.current?.click()} className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground">
                    {uploadingLogo ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                    <span className="text-sm font-medium">Upload coin image</span>
                    <span className="text-xs">Drop or click to select</span>
                  </button>
                )}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><FileImage className="h-4 w-4" /> File size and type</div>
                  <ul className="ml-5 list-disc text-xs text-muted-foreground">
                    <li>Image - max 15mb. '.jpg', '.gif' or '.png' recommended</li>
                    <li>Video - max 30mb. '.mp4' recommended</li>
                  </ul>
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><ImageIcon className="h-4 w-4" /> Resolution and aspect ratio</div>
                  <ul className="ml-5 list-disc text-xs text-muted-foreground">
                    <li>Image - min. 1000×1000px, 1:1 square recommended</li>
                    <li>Video - 16:9 or 9:16, 1080p+ recommended</li>
                  </ul>
                </div>
              </div>

              <button type="button" onClick={() => setShowBanner((s) => !s)} className="mt-5 flex items-center gap-2 text-sm font-semibold">
                <ImageIcon className="h-4 w-4" /> Add banner <span className="text-muted-foreground">(Optional)</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showBanner ? "rotate-180" : ""}`} />
              </button>
              {showBanner && (
                <div className="mt-3">
                  <input ref={bannerRef} type="file" accept="image/*" hidden
                    onChange={(e) => handleUpload(e, "banner_url", 15, setUploadingBanner, bannerRef)} />
                  <div className="grid min-h-[120px] place-items-center overflow-hidden rounded-xl border border-dashed border-border/60 bg-background/40">
                    {form.banner_url ? (
                      <img src={form.banner_url} alt="banner" className="max-h-32 object-contain" />
                    ) : (
                      <Button type="button" variant="outline" size="sm" disabled={uploadingBanner} onClick={() => bannerRef.current?.click()}>
                        {uploadingBanner ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                        Upload banner
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>

            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
              <Coins className="h-4 w-4" />
              Coin data (social links, banner, etc) can only be added now, and can't be changed or edited after creation
            </div>

            <Button type="submit" disabled={busy} className="h-12 rounded-2xl bg-success px-8 text-base font-semibold text-success-foreground shadow-glow">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Create coin
            </Button>
          </Card>
        </div>

        {/* RIGHT — preview */}
        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <h2 className="text-base font-semibold">Preview</h2>
          <Card className="glass-strong rounded-3xl border-border/60 p-4">
            <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl bg-background/40">
              {form.logo_url ? (
                <img src={form.logo_url} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-2xl bg-gradient-primary text-xl font-bold text-primary-foreground">
                  {(form.symbol || "?").slice(0, 3)}
                </div>
              )}
            </div>
            {(form.name || form.symbol) && (
              <div className="mt-3 px-1">
                <div className="truncate text-sm font-semibold">{form.name || "Coin name"}</div>
                <div className="text-xs text-muted-foreground">{form.symbol || "TICKER"}</div>
              </div>
            )}
          </Card>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-semibold text-foreground">{label}</Label>
      {children}
    </div>
  );
}
function FeatureRow({ icon, title, desc, value, onChange }: { icon: React.ReactNode; title: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-background/60">{icon}</div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
