import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, ShieldCheck, Clock, Loader2, AlertCircle, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createKycVerification, getKycStatus } from "@/lib/kyc.functions";

export const Route = createFileRoute("/_authenticated/kyc")({
  component: KycPage,
});

type Status = "not_started" | "pending" | "in_review" | "verified" | "rejected";

const META: Record<Status, { label: string; tone: string; icon: typeof BadgeCheck; desc: string }> = {
  not_started: { label: "Not started", tone: "bg-muted text-muted-foreground", icon: ShieldCheck, desc: "Verify your identity to unlock full access." },
  pending:     { label: "Pending",     tone: "bg-amber-500/15 text-amber-500", icon: Clock,       desc: "Complete the verification in the Pi Verify portal." },
  in_review:   { label: "In review",   tone: "bg-blue-500/15 text-blue-400",   icon: Loader2,     desc: "Pi is reviewing your documents. This usually takes a few minutes." },
  verified:    { label: "Verified",    tone: "bg-emerald-500/15 text-emerald-400", icon: BadgeCheck, desc: "Your identity is verified." },
  rejected:    { label: "Rejected",    tone: "bg-red-500/15 text-red-400",     icon: XCircle,     desc: "Verification was rejected. You can try again." },
};

function KycPage() {
  const router = useRouter();
  const fetchStatus = useServerFn(getKycStatus);
  const createSession = useServerFn(createKycVerification);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["kyc-status"],
    queryFn: () => fetchStatus({}),
    refetchInterval: (q) => {
      const s = (q.state.data as { kyc_status?: Status } | undefined)?.kyc_status;
      return s === "pending" || s === "in_review" ? 5000 : false;
    },
  });

  const status: Status = (data?.kyc_status as Status) ?? "not_started";
  const meta = META[status];
  const Icon = meta.icon;

  async function start() {
    setBusy(true);
    try {
      const res = await createSession({ data: { returnUrl: `${window.location.origin}/kyc` } });
      if (res.verification_url) {
        toast.success("Opening Pi Verify…");
        window.location.href = res.verification_url;
      } else {
        toast.error("No verification URL returned");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start verification");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4 md:py-8">
      <header>
        <h1 className="text-2xl font-bold md:text-3xl">Identity Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">Powered by Pi Verify · Required for full access</p>
      </header>

      <div className="glass rounded-3xl p-6 md:p-8">
        {isLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading status…</div>
        ) : error ? (
          <div className="flex items-center gap-3 text-red-400"><AlertCircle className="h-4 w-4" /> {(error as Error).message}</div>
        ) : (
          <>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className={`grid h-12 w-12 place-items-center rounded-2xl ${meta.tone}`}>
                  <Icon className={`h-5 w-5 ${status === "in_review" ? "animate-spin" : ""}`} />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
                  <div className="text-lg font-semibold">{meta.label}</div>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${meta.tone}`}>{meta.label}</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{meta.desc}</p>

            {data?.kyc_verified_at && (
              <p className="mt-2 text-xs text-muted-foreground">Verified on {new Date(data.kyc_verified_at).toLocaleString()}</p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {status === "verified" ? (
                <Button variant="outline" onClick={() => router.navigate({ to: "/dashboard" })}>Back to dashboard</Button>
              ) : (
                <>
                  <Button onClick={start} disabled={busy} className="min-w-[10rem]">
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                    {status === "rejected" ? "Try again" : status === "not_started" ? "Verify identity" : "Continue verification"}
                  </Button>
                  <Button variant="outline" onClick={() => refetch()}>Refresh status</Button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-5 text-sm text-muted-foreground">
        <div className="mb-2 font-medium text-foreground">What to expect</div>
        <ul className="list-disc space-y-1 pl-5">
          <li>You'll be redirected to Pi Verify to upload an ID and a selfie.</li>
          <li>Once submitted, your status updates here automatically.</li>
          <li>We never see your ID — only the verification result.</li>
        </ul>
      </div>
    </div>
  );
}
