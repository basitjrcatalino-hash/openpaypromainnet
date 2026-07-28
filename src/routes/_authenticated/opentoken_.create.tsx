/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";
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
  Plus,
  Info,
  Gift,
  Zap,
  CircleDollarSign,
  Wallet,
  Settings2,
  BadgeCheck,
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

const fieldClass =
  "mt-1.5 h-11 rounded-2xl border-0 bg-muted px-3.5 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40";

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [logoDrag, setLogoDrag] = useState(false);
  const [bannerDrag, setBannerDrag] = useState(false);
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

  const [shareRewards, setShareRewards] = useState(false);
  const [rewardsDialogOpen, setRewardsDialogOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([
    { address: user.id, pct: 100, label: "You (Creator)" },
  ]);

  const [mayhemMode, setMayhemMode] = useState(false);
  const [cashBack, setCashBack] = useState(false);
  const [pairWithOUSD, setPairWithOUSD] = useState(true);

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () => fetchActiveWallet<{ id: string; ousd_balance: number }>(supabase, user.id),
  });

  const ousdBal = Number(wallet?.ousd_balance ?? 0);
  const canAfford = ousdBal >= DEFAULT_LAUNCH_FEE_OUSD;

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleFile(file: File | undefined, type: "logo" | "banner") {
    if (!file) return;
    const maxSize = type === "banner" ? 5 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Max ${type === "banner" ? "5" : "15"}MB`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
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

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "banner") {
    await handleFile(e.target.files?.[0], type);
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
    if (!form.logo_url) {
      toast.message("Tip: add a logo so your coin stands out");
    }
    set("symbol", parsed.data.symbol);
    setStep("confirm");
  }

  async function launch() {
    if (!wallet?.id) {
      toast.error("Create a wallet first");
      return;
    }
    if (!canAfford) {
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
          banner_url: form.banner_url || null,
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
      void navigate({ to: "/asset/$tokenId", params: { tokenId: created.id } });
    } catch (err) {
      toast.error((err as Error).message || "Launch failed");
    } finally {
      setBusy(false);
    }
  }

  if (step === "confirm") {
    return (
      <div className="ot-phantom mx-auto max-w-lg animate-page-in space-y-5 pb-8 pt-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground press"
          onClick={() => setStep("form")}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="overflow-hidden rounded-3xl bg-muted/40">
          {form.logo_url ? (
            <img src={form.logo_url} alt="" className="aspect-video w-full object-cover" />
          ) : (
            <div className="grid aspect-video place-items-center bg-primary/10 text-primary">
              <Plus className="h-10 w-10" />
            </div>
          )}
          <div className="px-5 py-4">
            <div className="text-lg font-bold">{form.name}</div>
            <div className="text-sm text-muted-foreground">${form.symbol}</div>
          </div>
        </div>
        <FairLaunchConfirm
          name={form.name}
          symbol={form.symbol}
          fee={DEFAULT_LAUNCH_FEE_OUSD}
          busy={busy}
          onBack={() => setStep("form")}
          onConfirm={launch}
        />
        {(mayhemMode || cashBack || shareRewards || pairWithOUSD) && (
          <div className="rounded-2xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
            Launch options:{" "}
            {[
              pairWithOUSD && "OUSD pair",
              mayhemMode && "Mayhem",
              cashBack && "Cash back",
              shareRewards && `${recipients.length} reward recipient(s)`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ot-phantom mx-auto max-w-4xl animate-page-in pb-10 pt-1">
      <div className="mb-6 flex items-start gap-3">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="mt-0.5 h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Link to="/tokens">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Create new coin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose carefully — name, ticker, and media can&apos;t be changed after launch.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form onSubmit={goConfirm} className="order-2 space-y-4 lg:order-1">
          {/* Coin details */}
          <section className="space-y-4 rounded-3xl bg-card p-5">
            <div className="text-[13px] font-semibold text-foreground">Coin details</div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Coin name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Open Coin"
                  className={fieldClass}
                  maxLength={60}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ticker</Label>
                <Input
                  value={form.symbol}
                  onChange={(e) =>
                    set("symbol", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                  }
                  placeholder="OPEN"
                  className={cn(fieldClass, "font-semibold tracking-wide")}
                  maxLength={10}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value.slice(0, 1000))}
                className="mt-1.5 min-h-24 rounded-2xl border-0 bg-muted px-3.5 py-3 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
                placeholder="What is this coin about?"
              />
              <div className="mt-1 text-right text-[10px] text-muted-foreground">
                {form.description.length}/1000
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Category</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {OT_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("category", c)}
                    className={cn(
                      "rounded-full px-3.5 py-2 text-xs font-semibold press",
                      form.category === c
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {OT_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Logo upload */}
          <section className="space-y-3 rounded-3xl bg-card p-5">
            <div className="text-[13px] font-semibold">Artwork</div>
            <div
              className={cn(
                "relative cursor-pointer rounded-3xl border border-dashed p-8 text-center transition",
                logoDrag
                  ? "border-primary bg-primary/10"
                  : "border-border/80 bg-muted/40 hover:border-primary/40 hover:bg-muted/60",
              )}
              onClick={() => logoRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setLogoDrag(true);
              }}
              onDragLeave={() => setLogoDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setLogoDrag(false);
                void handleFile(e.dataTransfer.files?.[0], "logo");
              }}
            >
              {form.logo_url ? (
                <div className="relative mx-auto w-fit">
                  <img
                    src={form.logo_url}
                    alt=""
                    className="mx-auto h-32 w-32 rounded-3xl object-cover shadow-lg"
                  />
                  <button
                    type="button"
                    className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full bg-background text-xs font-semibold shadow press"
                    onClick={(e) => {
                      e.stopPropagation();
                      set("logo_url", "");
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <ImageIcon className="h-6 w-6" />
                    )}
                  </div>
                  <div className="mt-3 text-sm font-semibold">
                    {uploading ? "Uploading…" : "Select image to upload"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">or drag and drop it here</div>
                  <Button
                    type="button"
                    className="mt-4 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      logoRef.current?.click();
                    }}
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
              <Hint
                title="File size and type"
                body="Image · max 15MB · .jpg, .gif or .png recommended"
              />
              <Hint
                title="Resolution"
                body="Min 1000×1000px, 1:1 square recommended"
              />
            </div>
          </section>

          {/* Social links */}
          <Collapsible
            open={showSocial}
            onToggle={() => setShowSocial((v) => !v)}
            icon={<Settings2 className="h-4 w-4" />}
            title="Add social links (optional)"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Website"
                value={form.website}
                onChange={(v) => set("website", v)}
                placeholder="https://"
              />
              <Field
                label="X / Twitter"
                value={form.twitter}
                onChange={(v) => set("twitter", v)}
                placeholder="@handle or URL"
              />
              <Field
                label="Telegram"
                value={form.telegram}
                onChange={(v) => set("telegram", v)}
                placeholder="t.me/…"
              />
              <Field
                label="Discord"
                value={form.discord}
                onChange={(v) => set("discord", v)}
                placeholder="discord.gg/…"
              />
            </div>
          </Collapsible>

          {/* Banner */}
          <Collapsible
            open={showBanner}
            onToggle={() => setShowBanner((v) => !v)}
            icon={<ImageIcon className="h-4 w-4" />}
            title="Add banner (optional)"
          >
            <p className="mb-3 text-xs text-muted-foreground">
              Shown on the coin page with your logo. Images or GIFs up to 5MB, 3:1 / 1500×500
              recommended. Set once at creation.
            </p>
            <div
              className={cn(
                "cursor-pointer rounded-3xl border border-dashed p-6 text-center transition",
                bannerDrag
                  ? "border-primary bg-primary/10"
                  : "border-border/80 bg-muted/40 hover:border-primary/40",
              )}
              onClick={() => bannerRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setBannerDrag(true);
              }}
              onDragLeave={() => setBannerDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setBannerDrag(false);
                void handleFile(e.dataTransfer.files?.[0], "banner");
              }}
            >
              {form.banner_url ? (
                <img
                  src={form.banner_url}
                  alt=""
                  className="mx-auto h-28 w-full max-w-md rounded-2xl object-cover"
                />
              ) : (
                <>
                  {uploadingBanner ? (
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
                  ) : (
                    <ImageIcon className="mx-auto h-7 w-7 text-muted-foreground" />
                  )}
                  <div className="mt-2 text-sm text-muted-foreground">
                    {uploadingBanner ? "Uploading…" : "Upload banner…"}
                  </div>
                  <Button
                    type="button"
                    className="mt-3 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      bannerRef.current?.click();
                    }}
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
          </Collapsible>

          {/* Share creator rewards */}
          <ToggleCard
            icon={<Gift className="h-4 w-4 text-primary" />}
            title="Share creator rewards"
            subtitle="Share fees with wallets or charities"
            checked={shareRewards}
            onCheckedChange={setShareRewards}
          >
            {shareRewards && (
              <button
                type="button"
                className="mt-3 flex w-full items-center justify-between rounded-2xl bg-muted px-4 py-3 text-sm press"
                onClick={() => setRewardsDialogOpen(true)}
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  <Gift className="h-4 w-4 text-muted-foreground" />
                  {recipients.length} fee recipient{recipients.length !== 1 ? "s" : ""} selected
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </ToggleCard>

          {/* Mayhem + cash back */}
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleCard
              compact
              icon={<Zap className="h-4 w-4 text-amber-400" />}
              title="Mayhem mode"
              subtitle="Increased price volume"
              checked={mayhemMode}
              onCheckedChange={setMayhemMode}
            />
            <ToggleCard
              compact
              icon={<CircleDollarSign className="h-4 w-4 text-sky-400" />}
              title="Cash back"
              subtitle="Rewards go to traders"
              checked={cashBack}
              onCheckedChange={setCashBack}
            />
          </div>

          <p className="px-1 text-center text-xs text-muted-foreground">
            <Info className="mr-1 inline h-3 w-3" />
            Mayhem & cash back are active for 24h and only set at creation. May increase supply.{" "}
            <a
              href="/docs/openpay"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Learn more
            </a>
          </p>

          {/* Pair with OUSD */}
          <ToggleCard
            icon={<CircleDollarSign className="h-4 w-4 text-emerald-400" />}
            title="Pair with OUSD"
            subtitle="Create your coin with OUSD liquidity"
            checked={pairWithOUSD}
            onCheckedChange={setPairWithOUSD}
          />

          {/* Advanced */}
          <Collapsible
            open={showAdvanced}
            onToggle={() => setShowAdvanced((v) => !v)}
            icon={<Settings2 className="h-4 w-4" />}
            title="Advanced"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Total supply</Label>
                <Input
                  type="number"
                  value={form.total_supply}
                  onChange={(e) =>
                    set("total_supply", Number(e.target.value) || DEFAULT_TOTAL_SUPPLY)
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Decimals</Label>
                <Input
                  type="number"
                  value={form.decimals}
                  onChange={(e) =>
                    set("decimals", Math.min(18, Math.max(0, Number(e.target.value) || 0)))
                  }
                  className={fieldClass}
                />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <ToggleRow
                title="Burnable"
                subtitle="Allow token burns"
                checked={form.burnable}
                onCheckedChange={(v) => set("burnable", v)}
              />
              <ToggleRow
                title="Mintable"
                subtitle="Allow future mints (not recommended)"
                checked={form.mintable}
                onCheckedChange={(v) => set("mintable", v)}
              />
            </div>
          </Collapsible>

          <Button
            type="submit"
            className="h-14 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-lg press"
            disabled={uploading || uploadingBanner}
          >
            {uploading || uploadingBanner ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Plus className="mr-2 h-5 w-5" />
            )}
            Continue
          </Button>

          <div className="rounded-2xl bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Metadata is set at launch. OpenToken is a 100% fair launch — no presale, whitelist, or
            team allocation. Fee:{" "}
            <span className="font-semibold text-foreground">{DEFAULT_LAUNCH_FEE_OUSD} OUSD</span>
            {wallet ? (
              <>
                {" "}
                · available{" "}
                <span className={cn("font-semibold", canAfford ? "text-foreground" : "text-red-400")}>
                  {ousdBal.toFixed(2)} OUSD
                </span>
              </>
            ) : null}
          </div>
        </form>

        {/* Preview */}
        <aside className="order-1 lg:sticky lg:top-20 lg:order-2 lg:self-start">
          <div className="rounded-3xl bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Preview
            </div>
            <div className="mt-3 overflow-hidden rounded-3xl bg-muted/50">
              <div className="aspect-square">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="" className="h-full w-full object-cover" />
                ) : form.banner_url ? (
                  <img src={form.banner_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center px-6 text-center">
                    <div>
                      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
                        <Plus className="h-6 w-6" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        A preview of how the coin will look
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 p-4">
                <div className="flex items-center gap-1.5 text-[15px] font-bold">
                  <span className="truncate">{form.name || "Token name"}</span>
                  <BadgeCheck className="h-4 w-4 shrink-0 text-primary/40" />
                </div>
                <div className="text-sm text-muted-foreground">${form.symbol || "TICKER"}</div>
                {form.description ? (
                  <p className="line-clamp-3 text-xs text-muted-foreground">{form.description}</p>
                ) : null}
                <div className="pt-1">
                  <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold text-primary">
                    {OT_CATEGORY_LABELS[form.category]}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Rewards dialog */}
      <Dialog open={rewardsDialogOpen} onOpenChange={setRewardsDialogOpen}>
        <DialogContent className="rounded-3xl border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Share creator rewards</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-1">
            <p className="text-center text-xs text-muted-foreground">
              Creators earn percentage rewards on fees. Invite wallets or charities to receive a
              portion. Sharing <span className="underline">cannot</span> be changed later.
            </p>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Allocated</span>
              <span className="font-semibold text-foreground">
                {recipients.reduce((s, r) => s + r.pct, 0)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, recipients.reduce((s, r) => s + r.pct, 0))}%`,
                }}
              />
            </div>

            <ul className="space-y-2">
              {recipients.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-2xl bg-muted px-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                      {r.label?.[0] ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {r.label || r.address.slice(0, 12) || "Recipient"}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {i === 0 && (
                          <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-primary">
                            Admin
                          </span>
                        )}
                        {r.pct}%
                      </div>
                    </div>
                  </div>
                  <Input
                    type="number"
                    value={r.pct}
                    onChange={(e) => {
                      const updated = [...recipients];
                      updated[i] = {
                        ...updated[i],
                        pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                      };
                      setRecipients(updated);
                    }}
                    className="h-9 w-16 rounded-xl border-0 bg-background text-center text-sm"
                  />
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  setRecipients((prev) => [...prev, { address: "", pct: 0, label: "Wallet" }])
                }
              >
                <Wallet className="mr-1.5 h-3.5 w-3.5" /> Add wallet
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  setRecipients((prev) => [...prev, { address: "", pct: 0, label: "Charity" }])
                }
              >
                <Gift className="mr-1.5 h-3.5 w-3.5" /> Add charity
              </Button>
            </div>

            <Button
              type="button"
              className="h-12 w-full rounded-full bg-primary font-bold text-primary-foreground"
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

function Hint({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>
        <div className="font-semibold text-foreground/80">{title}</div>
        {body}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
        placeholder={placeholder}
      />
    </div>
  );
}

function Collapsible({
  open,
  onToggle,
  icon,
  title,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-card p-2">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-3 text-left text-sm font-semibold press"
        onClick={onToggle}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
        <span className="flex-1">{title}</span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition", open && "rotate-180")}
        />
      </button>
      {open && <div className="px-3 pb-4 pt-1">{children}</div>}
    </section>
  );
}

function ToggleCard({
  icon,
  title,
  subtitle,
  checked,
  onCheckedChange,
  children,
  compact,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-3xl bg-card", compact ? "p-4" : "p-4")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-[11px] text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          className="data-[state=checked]:bg-primary"
        />
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  title,
  subtitle,
  checked,
  onCheckedChange,
}: {
  title: string;
  subtitle: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-muted px-3 py-3">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-primary"
      />
    </div>
  );
}
