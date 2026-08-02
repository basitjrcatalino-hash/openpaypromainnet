import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Gift, Loader2, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/wallet/PageHeader";
import {
  claimAirdrop,
  getAirdropClaimStatus,
  listLiveAirdrops,
  type AirdropCampaign,
} from "@/lib/airdrop.functions";
import { notifySuccess } from "@/lib/notify-success";
import { OUSD_LOGO_URL, USDC_LOGO_URL, USDT_LOGO_URL } from "@/lib/token-logos";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/wallet-utils";

export const Route = createFileRoute("/_authenticated/airdrop")({
  head: () => ({
    meta: [
      { title: "Airdrops — OpenPay Pro" },
      {
        name: "description",
        content: "Claim OUSD, USDT, and USDC airdrop rewards. Requires an OpenPay Pro wallet.",
      },
    ],
  }),
  component: AirdropPage,
});

function assetLogo(asset: string) {
  if (asset === "USDT") return USDT_LOGO_URL;
  if (asset === "USDC") return USDC_LOGO_URL;
  return OUSD_LOGO_URL;
}

function AirdropPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listLiveAirdrops);
  const claimsFn = useServerFn(getAirdropClaimStatus);
  const claimFn = useServerFn(claimAirdrop);

  const liveQ = useQuery({
    queryKey: ["live-airdrops"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });
  const claimsQ = useQuery({
    queryKey: ["airdrop-claims"],
    queryFn: () => claimsFn(),
  });

  const claimedIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of claimsQ.data ?? []) set.add(c.campaign_id);
    return set;
  }, [claimsQ.data]);

  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const claimM = useMutation({
    mutationFn: async (payload: { campaign_id: string; claim_code?: string }) => {
      setBusyId(payload.campaign_id);
      return claimFn({ data: payload });
    },
    onSuccess: (res) => {
      notifySuccess(
        `Claimed ${formatNumber(res.amount, 4)} ${res.asset} from ${res.title}`,
        { sound: "receive" },
      );
      void qc.invalidateQueries({ queryKey: ["airdrop-claims"] });
      void qc.invalidateQueries({ queryKey: ["live-airdrops"] });
      void qc.invalidateQueries({ queryKey: ["active-wallet"] });
      void qc.invalidateQueries({ queryKey: ["account-balances"] });
      void qc.invalidateQueries({ queryKey: ["wallets"] });
    },
    onError: (e: Error) => {
      const msg = e.message || "Claim failed";
      if (/kyc/i.test(msg)) {
        toast.error(msg, {
          action: {
            label: "Verify identity",
            onClick: () => {
              void navigate({ to: "/kyc" });
            },
          },
        });
        return;
      }
      toast.error(msg);
    },
    onSettled: () => setBusyId(null),
  });

  const campaigns: AirdropCampaign[] = liveQ.data ?? [];

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 px-4 pb-24 pt-2">
      <PageHeader title="Airdrops" backTo="/dashboard" />

      <Card className="rounded-3xl border-border/60 bg-card/70 p-4">
        <div className="flex gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Gift className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight">Reward drops</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Marketing promos, challenge rewards, and partner campaigns. You need an{" "}
              <strong className="text-foreground">OpenPay Pro wallet</strong> to claim.
            </p>
            <Button asChild variant="link" className="h-auto px-0 text-xs">
              <Link to="/wallet">Open wallet</Link>
            </Button>
          </div>
        </div>
      </Card>

      {liveQ.isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !campaigns.length ? (
        <Card className="rounded-3xl border-border/60 p-10 text-center">
          <Gift className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">No live airdrops</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check back soon for promos and challenge rewards.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <AirdropCard
              key={c.id}
              campaign={c}
              claimed={claimedIds.has(c.id)}
              code={codes[c.id] ?? ""}
              onCodeChange={(v) => setCodes((prev) => ({ ...prev, [c.id]: v }))}
              busy={busyId === c.id}
              onClaim={() =>
                claimM.mutate({
                  campaign_id: c.id,
                  claim_code: c.claim_mode === "code" ? codes[c.id] : undefined,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AirdropCard({
  campaign: c,
  claimed,
  code,
  onCodeChange,
  busy,
  onClaim,
}: {
  campaign: AirdropCampaign;
  claimed: boolean;
  code: string;
  onCodeChange: (v: string) => void;
  busy: boolean;
  onClaim: () => void;
}) {
  const remaining =
    c.max_claims != null ? Math.max(0, c.max_claims - c.claimed_count) : null;
  const exhausted =
    (remaining != null && remaining <= 0) ||
    (c.total_budget != null &&
      c.distributed_amount + c.amount_per_claim > c.total_budget + 1e-12);

  return (
    <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/80">
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <img
            src={assetLogo(c.asset)}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {c.badge ? (
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  {c.badge}
                </Badge>
              ) : null}
              <Badge variant="outline" className="rounded-full text-[10px]">
                {c.claim_mode === "code" ? "Code" : "Open"}
              </Badge>
              {claimed ? (
                <Badge className="rounded-full bg-emerald-500/15 text-[10px] text-emerald-400 hover:bg-emerald-500/15">
                  Claimed
                </Badge>
              ) : null}
            </div>
            <h2 className="mt-1 text-base font-bold leading-tight">{c.title}</h2>
            {c.subtitle ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{c.subtitle}</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-lg font-extrabold tabular-nums text-primary">
              {formatNumber(c.amount_per_claim, c.amount_per_claim >= 1 ? 2 : 4)}
            </p>
            <p className="text-[11px] font-semibold text-muted-foreground">{c.asset}</p>
          </div>
        </div>

        {c.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{c.description}</p>
        ) : null}

        {c.requirements.length > 0 ? (
          <ul className="space-y-1.5 rounded-2xl bg-muted/35 px-3 py-2.5">
            <li className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Requirements
            </li>
            {c.requirements.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  {r.label}
                  {r.done_hint ? (
                    <span className="block text-[11px] text-muted-foreground">{r.done_hint}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5" />
            OpenPay Pro wallet required
            {c.require_kyc ? " · KYC verified" : ""}
            {remaining != null ? ` · ${remaining} left` : ""}
          </span>
          {c.require_kyc ? (
            <Link
              to="/kyc"
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              Set up KYC
            </Link>
          ) : null}
        </div>

        {claimed ? (
          <Button disabled className="h-11 w-full rounded-full" variant="secondary">
            Already claimed
          </Button>
        ) : exhausted ? (
          <Button disabled className="h-11 w-full rounded-full" variant="secondary">
            Fully claimed
          </Button>
        ) : (
          <div className="space-y-2">
            {c.claim_mode === "code" ? (
              <Input
                value={code}
                onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
                placeholder="Enter claim code"
                className="h-11 rounded-xl font-mono uppercase"
                disabled={busy}
              />
            ) : null}
            <Button
              className={cn("h-11 w-full rounded-full font-bold")}
              disabled={busy || (c.claim_mode === "code" && code.trim().length < 4)}
              onClick={onClaim}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {c.claim_mode === "code" ? "Claim with code" : `Claim ${c.asset}`}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
