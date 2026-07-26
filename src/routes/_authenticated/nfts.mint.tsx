import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  ImagePlus,
  Sparkles,
  Upload,
  ExternalLink,
  Link2,
  CheckCircle2,
} from "lucide-react";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadMedia } from "@/lib/upload";
import { getOpenNftMintStatus, mintOpenNftOnOpenPay } from "@/lib/openpay-nft.functions";
import { OPENPAY_NFT_MARKET_URL, OPENPAY_PRO_STORE_URL } from "@/lib/openpay-nft";

export const Route = createFileRoute("/_authenticated/nfts/mint")({
  head: () => ({ meta: [{ title: "Mint OpenNFT — OpenPay Pro" }] }),
  component: MintNFT,
});

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).optional(),
  media_url: z.string().url("Provide a valid media URL"),
  price: z.coerce.number().min(0).max(1e9),
});

function MintNFT() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getStatus = useServerFn(getOpenNftMintStatus);
  const mintFn = useServerFn(mintOpenNftOnOpenPay);

  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    media_url: "",
    price: 1,
  });
  const [success, setSuccess] = useState<{
    permalink: string;
    store_url?: string;
    item_id: string;
    recipient_username?: string;
  } | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["openpay-nft-mint-status", user.id],
    queryFn: () => getStatus(),
  });

  const { data: wallet } = useQuery({
    queryKey: ["active-wallet", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", user.id)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Max 25MB");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadMedia(file, user.id, "nfts");
      setForm((f) => ({ ...f, media_url: url }));
      toast.success("Uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid");
      return;
    }
    if (!status?.linked) {
      toast.error("Connect OpenPay in Settings first");
      return;
    }
    if (!status.mintAvailable) {
      toast.message(status.message || "Mint coming soon on OpenPay");
      return;
    }
    if (!wallet) {
      toast.error("No wallet found");
      return;
    }

    setBusy(true);
    try {
      const res = (await mintFn({
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          imageUrl: parsed.data.media_url,
          price: parsed.data.price,
          walletId: wallet.id,
          listOnMarketplace: true,
        },
      })) as {
        permalink: string;
        store_url?: string;
        item_id: string;
        recipient_username?: string;
      };
      setSuccess({
        permalink: res.permalink,
        store_url: res.store_url,
        item_id: res.item_id,
        recipient_username: res.recipient_username,
      });
      void qc.invalidateQueries({ queryKey: ["openpay-collectibles"] });
      void qc.invalidateQueries({ queryKey: ["txs", wallet.id] });
      void qc.invalidateQueries({ queryKey: ["ledger-entries"] });
      toast.success("Minted on OpenPay OpenNFT");
    } catch (err) {
      const msg = (err as Error).message || "Mint failed";
      if (/not deployed|coming soon|404/i.test(msg)) {
        toast.message("Mint coming soon — OpenPay is finishing nft-partner-api deploy");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/nfts" })}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Collectibles
        </Button>
        <Card className="glass-strong space-y-4 rounded-3xl border-border/60 p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Minted on OpenPay</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Listed on the OpenPay marketplace
              {success.recipient_username ? ` · owned by @${success.recipient_username}` : ""}.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild className="rounded-full bg-gradient-primary text-primary-foreground">
              <a href={success.permalink} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" /> View on OpenNFT
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <a href={success.store_url || OPENPAY_PRO_STORE_URL} target="_blank" rel="noreferrer">
                OpenPay Pro store
              </a>
            </Button>
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/nfts">My Collectibles</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const mintReady = !!status?.linked && !!status?.mintAvailable;
  const mintBlockedReason = !status?.linked
    ? "Connect OpenPay to mint as your @username"
    : !status?.mintAvailable
      ? status?.message || "Mint coming soon — OpenPay is deploying nft-partner-api"
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/nfts" })}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
      </Button>
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Mint OpenNFT</h1>
        <p className="text-sm text-muted-foreground">
          Mint on OpenPay Pro — appears on the OpenPay marketplace with{" "}
          <span className="font-mono text-xs">source: openpay_pro</span>
        </p>
      </div>

      <Card className="rounded-2xl border-border/60 bg-card/60 p-4 text-sm">
        {statusLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking OpenPay mint…
          </div>
        ) : status?.linked ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              Recipient:{" "}
              <span className="font-semibold">@{status.username || status.openpayUserId}</span>
              {status.mintAvailable ? (
                <span className="ml-2 text-xs text-mint">Mint API ready</span>
              ) : (
                <span className="ml-2 text-xs text-muted-foreground">Mint API pending deploy</span>
              )}
            </p>
            <a
              href={OPENPAY_PRO_STORE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Pro store <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground">
              Connect OpenPay so mints go to your @username on the marketplace.
            </p>
            <Button asChild size="sm" className="rounded-full bg-gradient-primary text-primary-foreground">
              <Link to="/settings">
                <Link2 className="mr-1.5 h-3.5 w-3.5" /> Connect OpenPay
              </Link>
            </Button>
          </div>
        )}
      </Card>

      <Card className="glass-strong rounded-3xl border-border/60 p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-muted-foreground">
            {form.media_url ? (
              <img
                src={form.media_url}
                alt="preview"
                className="max-h-48 rounded-xl object-contain"
              />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onFile}
            />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                )}
                Upload file
              </Button>
              <span className="text-xs">or paste a URL</span>
            </div>
            <Input
              className="max-w-md"
              value={form.media_url}
              onChange={(e) => setForm({ ...form, media_url: e.target.value })}
              placeholder="https://…/art.png"
              required
            />
          </div>

          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={80}
              required
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={1000}
              rows={3}
            />
          </Field>
          <Field label="Price (OUSD)">
            <Input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              min={0}
              step="0.01"
            />
          </Field>

          {mintBlockedReason && (
            <p className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {mintBlockedReason}{" "}
              <a
                href={OPENPAY_NFT_MARKET_URL}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                Browse OpenNFTs
              </a>
            </p>
          )}

          <Button
            type="submit"
            disabled={busy || statusLoading || !mintReady}
            className="h-12 w-full rounded-2xl bg-gradient-primary text-base font-semibold text-primary-foreground shadow-glow"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {status?.mintAvailable ? "Mint on OpenPay" : "Mint coming soon"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
