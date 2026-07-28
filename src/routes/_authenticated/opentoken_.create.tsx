/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Upload,
  Info,
  Gift,
  Zap,
  CircleDollarSign,
  Wallet,
  X,
  Plus,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { uploadMedia } from "@/lib/upload";
import { createOpenToken } from "@/lib/opentoken.functions";
import {
  DEFAULT_LAUNCH_FEE_OUSD,
  DEFAULT_TOTAL_SUPPLY,
  OT_CATEGORIES,
  OT_CATEGORY_LABELS,
  type OtCategory,
} from "@/lib/opentoken/bonding-curve";
import { FairLaunchConfirm } from "@/components/opentoken";
import { fetchActiveWallet } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/opentoken_/create")({
  head: () => ({ meta: [{ title: "Create coin — OpenToken" }] }),
  component: CreateOpenTokenPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(60),
  symbol: z
    .string()
    .trim()
    .min(1, "Ticker required")
    .max(10)
    .regex(/^[A-Z0-9]+$/, "Uppercase letters/numbers only"),
  description: z.string().trim().max(1000).optional(),
  website: z.string().url().optional().or(z.literal("")),
  twitter: z.string().max(120).optional().or(z.literal("")),
  telegram: z.string().max(120).optional().or(z.literal("")),
  discord: z.string().max(120).optional().or(z.literal("")),
});

type Recipient = { address: string; pct: number; label?: string };

function CreateOpenTokenPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const createFn = useServerFn(createOpenToken);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showSocial, setShowSocial] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [form, setForm] = useState({
    name: "",
    symbol: "",
    description: "",
    website: "",
    twitter: "",
    telegram: "",
    discord: "",
    logo_url: "",
    banner_url: "",
    category: "meme" as OtCategory,
    total_supply: DEFAULT_TOTAL_SUPPLY,
    decimals: 9,
    burnable: false,
    mintable: false,
  });

  // Pump.fun-style creator rewards
  const [shareRewards, setShareRewards] = useState(false);
  const [rewardsDialogOpen, setRewardsDialogOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([
    { address: user.id, pct: 100, label: "You (Creator)" },
  ]);

  // Feature toggles
  const [mayhemMode, setMayhemMode] = useState(false);
  const [cashBack, setCashBack] = useState(false);
  const [pairWithOUSD, setPairWithOUSD] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () => fetchActiveWallet<{ id: string; ousd_balance: number }>(supabase, user.id),
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "banner") {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = type === "banner" ? 5 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Max ${type === "banner" ? "5" : "15"}MB`);
      return;
    }
    type === "banner" ? setUploadingBanner(true) : setUploading(true);
    try {
      const url = await uploadMedia(file, user.id, "opentoken");
      set(type === "banner" ? "banner_url" : "logo_url", url);
      toast.success(`${type === "banner" ? "Banner" : "Logo"} uploaded`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      type === "banner" ? setUploadingBanner(false) : setUploading(false);
      const ref = type === "banner" ? bannerRef : logoRef;
      if (ref.current) ref.current.value = "";
    }
  }

  function goConfirm(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      name: form.name,
      symbol: form.symbol.toUpperCase(),
      description: form.description,
      website: form.website,
      twitter: form.twitter,
      telegram: form.telegram,
      discord: form.discord,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid form");
      return;
    }
    set("symbol", parsed.data.symbol);
    setStep("confirm");
  }

  async function launch() {
    if (!wallet?.id) {
      toast.error("Create a wallet first");
      return;
    }
    const ousdBalance = Number(wallet.ousd_balance ?? 0);
    if (ousdBalance < DEFAULT_LAUNCH_FEE_OUSD) {
      toast.error(`Launch fee is ${DEFAULT_LAUNCH_FEE_OUSD} OUSD — insufficient available balance`);
      return;
    }
    setBusy(true);
    try {
      const created = await createFn({
        data: {
          name: form.name.trim(),
          symbol: form.symbol.toUpperCase(),
          description: form.description || null,
          logo_url: form.logo_url || null,
          website: form.website || null,
          twitter: form.twitter || null,
          telegram: form.telegram || null,
          discord: form.discord || null,
          category: form.category,
          total_supply: form.total_supply,
          decimals: form.decimals,
          burnable: form.burnable,
          mintable: form.mintable,
          wallet_id: wallet.id,
        },
      });
      toast.success(`$${created.symbol} launched`);
      void navigate({ to: "/opentoken/$tokenId", params: { tokenId: created.id } });
    } catch (err) {
      toast.error((err as Error).message || "Launch failed");
    } finally {
      setBusy(false);
    }
  }

  /* ── confirm step ─────────────────────────────────────────────── */
  if (step === "confirm") {
    return (
      <div className="ot-phantom mx-auto max-w-lg animate-page-in space-y-4 px-4 py-6">
        <Button
          type="button"
          variant="ghost"
          className="rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => setStep("form")}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <FairLaunchConfirm
          name={form.name}
          symbol={form.symbol}
          fee={DEFAULT_LAUNCH_FEE_OUSD}
          busy={busy}
          onBack={() => setStep("form")}
          onConfirm={launch}
        />
      </div>
    );
  }

  /* ── main form ────────────────────────────────────────────────── */
  return (
    <div className="ot-phantom mx-auto max-w-4xl animate-page-in px-1 pb-8 pt-2">
      {/* top bar */}
      <div className="flex items-center gap-3 pb-5">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
          <Link to="/opentoken">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Create new coin</h1>
          <p className="text-xs text-muted-foreground">
            Choose carefully, these can't be changed once the coin is created.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <form onSubmit={goConfirm} className="order-2 space-y-5 lg:order-1">
          {/* ── coin details card ────────────────────────────────── */}
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="text-sm font-semibold text-foreground">Coin details</div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Coin name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Droplink"
                  className="mt-1 rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground"
                  maxLength={60}
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Ticker</Label>
                <Input
                  value={form.symbol}
                  onChange={(e) =>
                    set("symbol", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                  }
                  placeholder="ETE"
                  className="mt-1 rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground"
                  maxLength={10}
                />
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Description (Optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value.slice(0, 1000))}
                className="mt-1 min-h-20 rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground"
                placeholder="What is this coin about?"
              />
            </div>

            <div>
              <Label className="text-muted-foreground">Category</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {OT_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("category", c)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      form.category === c
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {OT_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── logo upload ──────────────────────────────────────── */}
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div
              className="cursor-pointer rounded-2xl border border-dashed border-border bg-muted/50 p-8 text-center transition hover:border-border"
              onClick={() => logoRef.current?.click()}
            >
              {form.logo_url ? (
                <img
                  src={form.logo_url}
                  alt=""
                  className="mx-auto h-28 w-28 rounded-2xl object-cover"
                />
              ) : (
                <>
                  <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground" />
                  <div className="mt-3 text-sm font-medium text-foreground/80">
                    {uploading ? "Uploading…" : "Select video or image to upload"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">or drag and drop it here</div>
                  <Button
                    type="button"
                    className="mt-3 rounded-full bg-green-500 px-4 py-1 text-sm font-medium text-black hover:bg-green-400"
                    onClick={(e) => { e.stopPropagation(); logoRef.current?.click(); }}
                  >
                    Select file
                  </Button>
                </>
              )}
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUpload(e, "logo")}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium text-muted-foreground">File size and type</div>
                  Image · max 15mb · .jpg, .gif or .png recommended
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium text-muted-foreground">Resolution and aspect ratio</div>
                  Image · min 1000x1000px, 1:1 square recommended
                </div>
              </div>
            </div>
          </div>

          {/* ── social links (collapsible) ───────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-sm font-medium text-foreground/80"
              onClick={() => setShowSocial((v) => !v)}
            >
              <span className="text-muted-foreground">⚙</span>
              Add social links (Optional)
              <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition", showSocial && "rotate-180")} />
            </button>
            {showSocial && (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Website</Label>
                    <Input
                      value={form.website}
                      onChange={(e) => set("website", e.target.value)}
                      className="mt-1 rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground"
                      placeholder="Add URL"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">X</Label>
                    <Input
                      value={form.twitter}
                      onChange={(e) => set("twitter", e.target.value)}
                      className="mt-1 rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground"
                      placeholder="Add URL"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Telegram</Label>
                  <Input
                    value={form.telegram}
                    onChange={(e) => set("telegram", e.target.value)}
                    className="mt-1 rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground"
                    placeholder="Add URL"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── banner upload (collapsible) ──────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-sm font-medium text-foreground/80"
              onClick={() => setShowBanner((v) => !v)}
            >
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              Add banner (Optional)
              <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition", showBanner && "rotate-180")} />
            </button>
            {showBanner && (
              <div className="mt-4 space-y-3">
                <div className="text-xs font-medium text-foreground/80">Upload banner</div>
                <div className="text-xs text-muted-foreground">
                  This will be shown on the coin page in addition to the coin image. Images or animated gifs
                  up to 5mb, 3:1 / 1500x500px original. You can only do this when creating the coin, and it
                  cannot be changed later.
                </div>
                <div
                  className="cursor-pointer rounded-2xl border border-dashed border-border bg-muted/50 p-6 text-center transition hover:border-border"
                  onClick={() => bannerRef.current?.click()}
                >
                  {form.banner_url ? (
                    <img
                      src={form.banner_url}
                      alt=""
                      className="mx-auto h-24 w-full max-w-md rounded-xl object-cover"
                    />
                  ) : (
                    <>
                      <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                      <div className="mt-2 text-sm text-muted-foreground">Upload file...</div>
                      <Button
                        type="button"
                        className="mt-2 rounded-full bg-green-500 px-4 py-1 text-sm font-medium text-black hover:bg-green-400"
                        onClick={(e) => { e.stopPropagation(); bannerRef.current?.click(); }}
                      >
                        Select file
                      </Button>
                    </>
                  )}
                  <input
                    ref={bannerRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onUpload(e, "banner")}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-medium text-muted-foreground">File size and type</div>
                      Image · max 4.3mb · .jpg, .gif or .png recommended
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-medium text-muted-foreground">Resolution and aspect ratio</div>
                      3:1 aspect ratio, 1500x500px recommended
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── share creator rewards ────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-muted">
                  <Gift className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    Share creator rewards
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Share creator rewards with wallets or charities.
                  </div>
                </div>
              </div>
              <Switch
                checked={shareRewards}
                onCheckedChange={setShareRewards}
                className="data-[state=checked]:bg-green-500"
              />
            </div>

            {shareRewards && (
              <button
                type="button"
                className="mt-3 flex w-full items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm transition hover:bg-muted"
                onClick={() => setRewardsDialogOpen(true)}
              >
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground/80">{recipients.length} fee recipient{recipients.length !== 1 ? "s" : ""} selected</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* ── mayhem mode + cash back ──────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-muted">
                  <Zap className="h-4 w-4 text-yellow-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">Mayhem mode</div>
                  <div className="text-[11px] text-muted-foreground">Increased price volume.</div>
                </div>
              </div>
              <Switch
                checked={mayhemMode}
                onCheckedChange={setMayhemMode}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-muted">
                  <CircleDollarSign className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">Cash back</div>
                  <div className="text-[11px] text-muted-foreground">Creator rewards go to traders.</div>
                </div>
              </div>
              <Switch
                checked={cashBack}
                onCheckedChange={setCashBack}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            <Info className="mr-1 inline h-3 w-3" />
            Active for 24h, only set at creation. May increase coin supply.{" "}
            <span className="text-green-400 hover:underline cursor-pointer">learn more</span>
          </div>

          {/* ── pair with OUSD ───────────────────────────────────── */}
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-green-500/20">
                <CircleDollarSign className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">Pair with OUSD</div>
                <div className="text-[11px] text-muted-foreground">Create your coin with OUSD liquidity.</div>
              </div>
            </div>
            <Switch
              checked={pairWithOUSD}
              onCheckedChange={setPairWithOUSD}
              className="data-[state=checked]:bg-green-500"
            />
          </div>

          {/* ── advanced options ─────────────────────────────────── */}
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className="text-sm font-semibold text-foreground">Advanced</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Total supply</Label>
                <Input
                  type="number"
                  value={form.total_supply}
                  onChange={(e) =>
                    set("total_supply", Number(e.target.value) || DEFAULT_TOTAL_SUPPLY)
                  }
                  className="mt-1 rounded-xl border-border bg-muted text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Decimals</Label>
                <Input
                  type="number"
                  value={form.decimals}
                  onChange={(e) =>
                    set("decimals", Math.min(18, Math.max(0, Number(e.target.value) || 0)))
                  }
                  className="mt-1 rounded-xl border-border bg-muted text-foreground"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted p-3">
              <div>
                <div className="text-sm font-medium text-foreground/80">Burnable</div>
                <div className="text-[11px] text-muted-foreground">Allow token burns</div>
              </div>
              <Switch checked={form.burnable} onCheckedChange={(v) => set("burnable", v)} className="data-[state=checked]:bg-green-500" />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted p-3">
              <div>
                <div className="text-sm font-medium text-foreground/80">Mintable</div>
                <div className="text-[11px] text-muted-foreground">Allow future mints (not recommended)</div>
              </div>
              <Switch checked={form.mintable} onCheckedChange={(v) => set("mintable", v)} className="data-[state=checked]:bg-green-500" />
            </div>
          </div>

          {/* ── submit ──────────────────────────────────────────── */}
          <Button
            type="submit"
            className="w-full rounded-full bg-green-500 py-5 text-base font-semibold text-black shadow-lg shadow-green-900/20 hover:bg-green-400"
            disabled={uploading || uploadingBanner}
          >
            {uploading || uploadingBanner ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Create
          </Button>

          <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Coin data (social links, logo, etc.) is set at launch. OpenToken is a 100% fair launch
            — no presale, whitelist, or team allocation. Fee: {DEFAULT_LAUNCH_FEE_OUSD} OUSD
            {wallet ? ` · available ${Number(wallet.ousd_balance ?? 0).toFixed(2)} OUSD` : ""}
          </div>
        </form>

        {/* ── live preview sidebar (desktop) + mobile strip ───── */}
        <div className="order-1 lg:sticky lg:top-4 lg:order-2 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</div>
            <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted">
              <div className="aspect-square max-h-48 bg-muted sm:max-h-none lg:aspect-square">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full min-h-32 place-items-center px-4 text-center text-sm text-muted-foreground">
                    A preview of how the coin<br />will look like
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="text-sm font-semibold text-foreground">
                  {form.name || "Token name"}
                </div>
                <div className="text-xs text-muted-foreground">${form.symbol || "TICKER"}</div>
                {form.description && (
                  <p className="mt-1.5 line-clamp-3 text-[11px] text-muted-foreground">
                    {form.description}
                  </p>
                )}
                <div className="mt-2 text-[10px] text-muted-foreground">
                  {OT_CATEGORY_LABELS[form.category]}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── share creator rewards dialog ────────────────────────── */}
      <Dialog open={rewardsDialogOpen} onOpenChange={setRewardsDialogOpen}>
        <DialogContent className="rounded-3xl border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-foreground">Share creator rewards</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-2">
            <p className="text-center text-xs text-muted-foreground">
              Creators earn percentage rewards on all transaction fees. You may invite wallets or
              charities to receive a portion of it. Rewards sharing{" "}
              <span className="underline">cannot</span> be changed again.
            </p>

            {/* allocation bar */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Allocated</span>
              <span className="font-semibold text-foreground">
                {recipients.reduce((s, r) => s + r.pct, 0)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${Math.min(100, recipients.reduce((s, r) => s + r.pct, 0))}%` }}
              />
            </div>

            {/* recipient list */}
            <ul className="space-y-2">
              {recipients.map((r, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-muted-foreground/40 text-xs text-foreground">
                      {r.label?.[0] ?? "?"}
                    </div>
                    <div>
                      <div className="text-sm text-foreground">{r.label || r.address.slice(0, 12)}</div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {i === 0 && <span className="rounded bg-green-500/20 px-1 py-0.5 text-green-400">Admin</span>}
                        🔒 {r.pct}%
                      </div>
                    </div>
                  </div>
                  <Input
                    type="number"
                    value={r.pct}
                    onChange={(e) => {
                      const updated = [...recipients];
                      updated[i] = { ...updated[i], pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) };
                      setRecipients(updated);
                    }}
                    className="w-16 rounded-lg border-border bg-muted text-center text-sm text-foreground"
                  />
                </li>
              ))}
            </ul>

            <div className="text-center text-xs text-muted-foreground">Add more recipients</div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-border text-foreground/80 hover:bg-muted"
                onClick={() => {
                  setRecipients((prev) => [...prev, { address: "", pct: 0, label: "Wallet" }]);
                }}
              >
                <Wallet className="mr-1.5 h-3.5 w-3.5" /> Add wallet
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-border text-foreground/80 hover:bg-muted"
                onClick={() => {
                  setRecipients((prev) => [...prev, { address: "", pct: 0, label: "Charity" }]);
                }}
              >
                <Gift className="mr-1.5 h-3.5 w-3.5" /> Add charity
              </Button>
            </div>

            <p className="text-center text-[11px] text-muted-foreground">
              Your split is saved with this session and will be applied when you create the coin.
            </p>

            <Button
              type="button"
              className="w-full rounded-full bg-green-500 py-3 font-semibold text-black hover:bg-green-400"
              onClick={() => setRewardsDialogOpen(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
