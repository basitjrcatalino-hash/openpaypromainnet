import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Gift,
  Loader2,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Square,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AIRDROP_ASSETS,
  createAirdropCampaign,
  listAirdropCampaigns,
  setAirdropStatus,
  type AirdropAsset,
  type AirdropCampaign,
  type AirdropClaimMode,
  type AirdropStatus,
} from "@/lib/airdrop.functions";
import { checkIsAdmin, claimFirstAdmin } from "@/lib/topup-admin.functions";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/admin/airdrops")({
  head: () => ({ meta: [{ title: "Admin · Airdrops" }] }),
  component: AdminAirdropsPage,
});

function AdminAirdropsPage() {
  const qc = useQueryClient();
  const check = useServerFn(checkIsAdmin);
  const claim = useServerFn(claimFirstAdmin);
  const listFn = useServerFn(listAirdropCampaigns);
  const createFn = useServerFn(createAirdropCampaign);
  const statusFn = useServerFn(setAirdropStatus);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => check() });
  const isAdmin = !!adminQ.data?.isAdmin;

  const campaignsQ = useQuery({
    queryKey: ["admin-airdrops"],
    queryFn: () => listFn(),
    enabled: isAdmin,
  });

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [badge, setBadge] = useState("Promo");
  const [asset, setAsset] = useState<AirdropAsset>("OUSD");
  const [amount, setAmount] = useState("10");
  const [claimMode, setClaimMode] = useState<AirdropClaimMode>("open");
  const [claimCode, setClaimCode] = useState("");
  const [budget, setBudget] = useState("");
  const [maxClaims, setMaxClaims] = useState("");
  const [requireKyc, setRequireKyc] = useState(false);
  const [requirementsText, setRequirementsText] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [goLive, setGoLive] = useState(false);

  const createM = useMutation({
    mutationFn: () => {
      const amountNum = Number(amount);
      if (!(amountNum > 0)) throw new Error("Enter a positive amount per claim");
      const requirements = requirementsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((label, i) => ({ id: `req-${i + 1}`, label }));
      return createFn({
        data: {
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          description: description.trim() || null,
          notes: notes.trim() || null,
          badge: badge.trim() || null,
          asset,
          amount_per_claim: amountNum,
          claim_mode: claimMode,
          claim_code: claimMode === "code" ? claimCode.trim() : null,
          status: goLive ? "live" : "draft",
          total_budget: budget.trim() ? Number(budget) : null,
          max_claims: maxClaims.trim() ? Number(maxClaims) : null,
          require_kyc: requireKyc,
          requirements,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Airdrop campaign created");
      setTitle("");
      setSubtitle("");
      setDescription("");
      setNotes("");
      setClaimCode("");
      setBudget("");
      setMaxClaims("");
      setRequirementsText("");
      setStartsAt("");
      setEndsAt("");
      void qc.invalidateQueries({ queryKey: ["admin-airdrops"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusM = useMutation({
    mutationFn: (payload: { id: string; status: AirdropStatus }) =>
      statusFn({ data: payload }),
    onSuccess: () => {
      toast.success("Status updated");
      void qc.invalidateQueries({ queryKey: ["admin-airdrops"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const campaigns: AirdropCampaign[] = campaignsQ.data ?? [];
  const liveCount = useMemo(
    () => campaigns.filter((c: AirdropCampaign) => c.status === "live").length,
    [campaigns],
  );

  if (adminQ.isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-10">
        <Card className="space-y-3 rounded-3xl border-border/60 p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg font-bold">Admin only</h1>
          <p className="text-sm text-muted-foreground">
            Airdrop management requires an admin role.
          </p>
          <Button
            className="rounded-full"
            onClick={() => {
              void claim()
                .then((r) => {
                  if (r.claimed) {
                    toast.success("You are now admin");
                    void adminQ.refetch();
                  } else toast.message("Admin already claimed");
                })
                .catch((e: Error) => toast.error(e.message));
            }}
          >
            Claim first admin
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/dashboard">Back</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-24 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Admin
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Airdrops</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create OUSD / USDT / USDC reward drops for marketing, promos, and challenges.
          </p>
        </div>
        <Badge variant="secondary" className="rounded-full">
          {liveCount} live
        </Badge>
      </div>

      <Card className="rounded-3xl border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        Claimants must have an <strong>OpenPay Pro wallet</strong>. Optional KYC and
        challenge checklist text can be set per campaign. Credits land as ledger{" "}
        <code className="rounded bg-black/20 px-1">reward</code> transactions.
      </Card>

      <Card className="space-y-4 rounded-3xl border-border/60 p-5">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">Create campaign</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ad-title">Title</Label>
            <Input
              id="ad-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Spring trading challenge"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ad-sub">Subtitle</Label>
            <Input
              id="ad-sub"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Complete tasks and claim rewards"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Badge</Label>
            <Input
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              placeholder="Promo / Challenge / Marketing"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Asset</Label>
            <div className="flex gap-2">
              {AIRDROP_ASSETS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAsset(a)}
                  className={cn(
                    "flex-1 rounded-xl border px-2 py-2 text-sm font-semibold",
                    asset === a
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/60 bg-muted/30",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-amt">Amount per claim</Label>
            <Input
              id="ad-amt"
              type="number"
              min={0.01}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Claim mode</Label>
            <div className="flex gap-2">
              {(["open", "code"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setClaimMode(m)}
                  className={cn(
                    "flex-1 rounded-xl border px-2 py-2 text-sm font-semibold capitalize",
                    claimMode === m
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/60 bg-muted/30",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {claimMode === "code" ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ad-code">Claim code</Label>
              <Input
                id="ad-code"
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                placeholder="PROMO-2026"
                className="rounded-xl font-mono uppercase"
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="ad-budget">Total budget (optional)</Label>
            <Input
              id="ad-budget"
              type="number"
              min={0}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Unlimited"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-max">Max claims (optional)</Label>
            <Input
              id="ad-max"
              type="number"
              min={1}
              value={maxClaims}
              onChange={(e) => setMaxClaims(e.target.value)}
              placeholder="Unlimited"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-start">Starts at (optional)</Label>
            <Input
              id="ad-start"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-end">Ends at (optional)</Label>
            <Input
              id="ad-end"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ad-desc">Description</Label>
            <Textarea
              id="ad-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-xl"
              placeholder="Public copy shown on the airdrop page"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ad-req">Requirements (one per line)</Label>
            <Textarea
              id="ad-req"
              value={requirementsText}
              onChange={(e) => setRequirementsText(e.target.value)}
              rows={3}
              className="rounded-xl"
              placeholder={"Have an OpenPay Pro wallet\nFollow @openpay on X\nComplete 1 trade"}
            />
            <p className="text-[11px] text-muted-foreground">
              Shown as a checklist. Auto-verification of tasks comes later — wallet (+ optional
              KYC) is enforced now.
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ad-notes">Internal notes</Label>
            <Textarea
              id="ad-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-xl"
              placeholder="Admin-only notes"
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5 sm:col-span-2">
            <div>
              <p className="text-sm font-semibold">Require KYC</p>
              <p className="text-[11px] text-muted-foreground">
                Claimant profile must be KYC verified
              </p>
            </div>
            <Switch checked={requireKyc} onCheckedChange={setRequireKyc} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5 sm:col-span-2">
            <div>
              <p className="text-sm font-semibold">Publish live now</p>
              <p className="text-[11px] text-muted-foreground">Otherwise saves as draft</p>
            </div>
            <Switch checked={goLive} onCheckedChange={setGoLive} />
          </div>
        </div>

        <Button
          className="h-11 w-full rounded-full"
          disabled={createM.isPending || title.trim().length < 2}
          onClick={() => createM.mutate()}
        >
          {createM.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Gift className="mr-2 h-4 w-4" />
          )}
          Create airdrop
        </Button>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-bold">Campaigns</h2>
        {campaignsQ.isLoading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !campaigns.length ? (
          <Card className="rounded-3xl border-border/60 p-8 text-center text-sm text-muted-foreground">
            No campaigns yet. Create your first airdrop above.
          </Card>
        ) : (
          campaigns.map((c) => (
            <CampaignAdminCard
              key={c.id}
              campaign={c}
              busy={statusM.isPending}
              onStatus={(status) => statusM.mutate({ id: c.id, status })}
            />
          ))
        )}
      </section>
    </div>
  );
}

function CampaignAdminCard({
  campaign: c,
  busy,
  onStatus,
}: {
  campaign: AirdropCampaign;
  busy: boolean;
  onStatus: (s: AirdropStatus) => void;
}) {
  return (
    <Card className="space-y-3 rounded-3xl border-border/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold">{c.title}</h3>
            {c.badge ? (
              <Badge variant="secondary" className="rounded-full">
                {c.badge}
              </Badge>
            ) : null}
            <StatusBadge status={c.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {c.claim_mode === "code" ? `Code · ${c.claim_code}` : "Open claim"} · {c.asset} ·{" "}
            {formatNumber(c.amount_per_claim, 4)} each
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-2xl bg-muted/40 px-2 py-2">
          <p className="text-muted-foreground">Claims</p>
          <p className="font-bold tabular-nums">
            {c.claimed_count}
            {c.max_claims != null ? ` / ${c.max_claims}` : ""}
          </p>
        </div>
        <div className="rounded-2xl bg-muted/40 px-2 py-2">
          <p className="text-muted-foreground">Distributed</p>
          <p className="font-bold tabular-nums">
            {formatNumber(c.distributed_amount, 2)} {c.asset}
          </p>
        </div>
        <div className="rounded-2xl bg-muted/40 px-2 py-2">
          <p className="text-muted-foreground">Budget</p>
          <p className="font-bold tabular-nums">
            {c.total_budget != null ? formatNumber(c.total_budget, 2) : "∞"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {c.status !== "live" ? (
          <Button
            size="sm"
            className="rounded-full"
            disabled={busy}
            onClick={() => onStatus("live")}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Go live
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full"
            disabled={busy}
            onClick={() => onStatus("paused")}
          >
            <Pause className="mr-1.5 h-3.5 w-3.5" />
            Pause
          </Button>
        )}
        {c.status !== "ended" ? (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() => onStatus("ended")}
          >
            <Square className="mr-1.5 h-3.5 w-3.5" />
            End
          </Button>
        ) : null}
        {c.status === "ended" || c.status === "paused" ? (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            disabled={busy}
            onClick={() => onStatus("draft")}
          >
            To draft
          </Button>
        ) : null}
      </div>
      {c.require_kyc ? (
        <p className="text-[11px] text-muted-foreground">KYC required · Pro wallet required</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">Pro wallet required</p>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: AirdropStatus }) {
  const tone =
    status === "live"
      ? "bg-emerald-500/15 text-emerald-400"
      : status === "paused"
        ? "bg-amber-500/15 text-amber-300"
        : status === "ended"
          ? "bg-muted text-muted-foreground"
          : "bg-sky-500/15 text-sky-300";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", tone)}>
      {status}
    </span>
  );
}
