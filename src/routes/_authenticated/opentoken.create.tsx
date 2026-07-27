import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Image as ImageIcon, Loader2, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { uploadMedia } from "@/lib/upload";
import { createOpenToken } from "@/lib/opentoken.functions";
import {
  DEFAULT_LAUNCH_FEE_PI,
  DEFAULT_TOTAL_SUPPLY,
  OT_CATEGORIES,
  OT_CATEGORY_LABELS,
  type OtCategory,
} from "@/lib/opentoken/bonding-curve";
import { FairLaunchConfirm, LivePreview } from "@/components/opentoken";
import { fetchActiveWallet } from "@/lib/wallet-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/opentoken/create")({
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

function CreateOpenTokenPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const createFn = useServerFn(createOpenToken);
  const logoRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSocial, setShowSocial] = useState(false);
  const [form, setForm] = useState({
    name: "",
    symbol: "",
    description: "",
    website: "",
    twitter: "",
    telegram: "",
    discord: "",
    logo_url: "",
    category: "meme" as OtCategory,
    total_supply: DEFAULT_TOTAL_SUPPLY,
    decimals: 9,
    burnable: false,
    mintable: false,
  });

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: () => fetchActiveWallet<{ id: string; pi_balance: number }>(supabase, user.id),
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Max 15MB");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadMedia(file, user.id, "opentoken");
      set("logo_url", url);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (logoRef.current) logoRef.current.value = "";
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

  if (step === "confirm") {
    return (
      <div className="mx-auto max-w-lg animate-page-in space-y-4">
        <Button
          type="button"
          variant="ghost"
          className="rounded-full"
          onClick={() => setStep("form")}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <FairLaunchConfirm
          name={form.name}
          symbol={form.symbol}
          fee={DEFAULT_LAUNCH_FEE_PI}
          busy={busy}
          onBack={() => setStep("form")}
          onConfirm={launch}
        />
      </div>
    );
  }

  return (
    <div className="animate-page-in space-y-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link to="/opentoken">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create new coin</h1>
          <p className="text-sm text-muted-foreground">
            100% fair launch · fee {DEFAULT_LAUNCH_FEE_PI} π
            {wallet ? ` · bal ${Number(wallet.pi_balance).toFixed(2)} π` : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <form onSubmit={goConfirm} className="space-y-4">
          <Card className="glass-strong space-y-4 rounded-3xl border-border/60 p-5">
            <div className="text-sm font-semibold">Coin details</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Coin name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Open Moon"
                  className="mt-1 rounded-xl"
                  maxLength={60}
                />
              </div>
              <div>
                <Label>Ticker</Label>
                <Input
                  value={form.symbol}
                  onChange={(e) =>
                    set("symbol", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                  }
                  placeholder="OMOON"
                  className="mt-1 rounded-xl"
                  maxLength={10}
                />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value.slice(0, 1000))}
                className="mt-1 min-h-25 rounded-xl"
                placeholder="What is this coin about?"
              />
            </div>

            <div>
              <Label>Category</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {OT_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("category", c)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      form.category === c
                        ? "bg-gradient-primary text-primary-foreground"
                        : "border border-border/60 text-muted-foreground",
                    )}
                  >
                    {OT_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-medium"
              onClick={() => setShowSocial((v) => !v)}
            >
              Add social links (optional)
              <ChevronDown className={cn("h-4 w-4 transition", showSocial && "rotate-180")} />
            </button>
            {showSocial && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Website</Label>
                  <Input
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                    className="mt-1 rounded-xl"
                    placeholder="https://"
                  />
                </div>
                <div>
                  <Label>X</Label>
                  <Input
                    value={form.twitter}
                    onChange={(e) => set("twitter", e.target.value)}
                    className="mt-1 rounded-xl"
                    placeholder="@handle"
                  />
                </div>
                <div>
                  <Label>Telegram</Label>
                  <Input
                    value={form.telegram}
                    onChange={(e) => set("telegram", e.target.value)}
                    className="mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <Label>Discord</Label>
                  <Input
                    value={form.discord}
                    onChange={(e) => set("discord", e.target.value)}
                    className="mt-1 rounded-xl"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Total supply</Label>
                <Input
                  type="number"
                  value={form.total_supply}
                  onChange={(e) =>
                    set("total_supply", Number(e.target.value) || DEFAULT_TOTAL_SUPPLY)
                  }
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label>Decimals</Label>
                <Input
                  type="number"
                  value={form.decimals}
                  onChange={(e) =>
                    set("decimals", Math.min(18, Math.max(0, Number(e.target.value) || 0)))
                  }
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Burnable</div>
                  <div className="text-xs text-muted-foreground">Allow token burns</div>
                </div>
                <Switch checked={form.burnable} onCheckedChange={(v) => set("burnable", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Mintable</div>
                  <div className="text-xs text-muted-foreground">
                    Allow future mints (not recommended)
                  </div>
                </div>
                <Switch checked={form.mintable} onCheckedChange={(v) => set("mintable", v)} />
              </div>
            </div>

            <div
              className="cursor-pointer rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center"
              onClick={() => logoRef.current?.click()}
            >
              {form.logo_url ? (
                <img
                  src={form.logo_url}
                  alt=""
                  className="mx-auto h-24 w-24 rounded-2xl object-cover"
                />
              ) : (
                <>
                  <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                  <div className="mt-2 text-sm font-medium">
                    {uploading ? "Uploading…" : "Select logo"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Images max 15MB · 1:1 recommended
                  </div>
                </>
              )}
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onUpload}
              />
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
              Coin data (social links, logo, etc.) is set at launch. OpenToken is a 100% fair launch
              — no presale, whitelist, or team allocation.
            </div>

            <Button
              type="submit"
              className="w-full rounded-full bg-gradient-primary text-primary-foreground"
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Continue
            </Button>
          </Card>
        </form>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <LivePreview
            name={form.name}
            symbol={form.symbol}
            description={form.description}
            logo_url={form.logo_url}
            category={form.category}
          />
        </div>
      </div>
    </div>
  );
}
