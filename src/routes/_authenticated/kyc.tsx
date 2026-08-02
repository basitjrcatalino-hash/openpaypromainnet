import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  ShieldCheck,
  Clock,
  Loader2,
  AlertCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getKycStatus, submitKycApplication } from "@/lib/kyc.functions";

export const Route = createFileRoute("/_authenticated/kyc")({
  component: KycPage,
});

type Status = "not_started" | "pending" | "in_review" | "verified" | "rejected";

const META: Record<
  Status,
  { label: string; tone: string; icon: typeof BadgeCheck; desc: string }
> = {
  not_started: {
    label: "Not started",
    tone: "bg-muted text-muted-foreground",
    icon: ShieldCheck,
    desc: "Verify your identity to unlock full access.",
  },
  pending: {
    label: "Pending review",
    tone: "bg-amber-500/15 text-amber-500",
    icon: Clock,
    desc: "Your application was submitted to OpenPay and is waiting for review.",
  },
  in_review: {
    label: "In review",
    tone: "bg-blue-500/15 text-blue-400",
    icon: Loader2,
    desc: "OpenPay is reviewing your documents. This usually takes a short time.",
  },
  verified: {
    label: "Verified",
    tone: "bg-emerald-500/15 text-emerald-400",
    icon: BadgeCheck,
    desc: "Your identity is verified.",
  },
  rejected: {
    label: "Rejected",
    tone: "bg-red-500/15 text-red-400",
    icon: XCircle,
    desc: "Verification was rejected. You can update your details and resubmit.",
  },
};

const FUNDS = [
  { v: "employment", l: "Employment" },
  { v: "business", l: "Business" },
  { v: "investments", l: "Investments" },
  { v: "inheritance", l: "Inheritance" },
  { v: "savings", l: "Savings" },
  { v: "other", l: "Other" },
] as const;

const INCOME = [
  { v: "0-25000", l: "Under $25,000" },
  { v: "25000-50000", l: "$25,000 – $50,000" },
  { v: "50000-100000", l: "$50,000 – $100,000" },
  { v: "100000-250000", l: "$100,000 – $250,000" },
  { v: "250000+", l: "$250,000+" },
] as const;

const ID_TYPES = [
  { v: "passport", l: "Passport" },
  { v: "national_id", l: "National ID" },
  { v: "drivers_license", l: "Driver's license" },
  { v: "residence_permit", l: "Residence permit" },
] as const;

type DocFile = { data_base64: string; content_type: string; name: string } | null;

type FormState = {
  full_name: string;
  date_of_birth: string;
  nationality: string;
  residential_address: string;
  phone_number: string;
  email: string;
  occupation: string;
  employer_name: string;
  source_of_funds: (typeof FUNDS)[number]["v"];
  annual_income_range: (typeof INCOME)[number]["v"];
  political_exposure: boolean;
  id_document_type: (typeof ID_TYPES)[number]["v"];
  id_document_number: string;
  id_document_issue_date: string;
  id_document_expiry_date: string;
  id_front: DocFile;
  id_back: DocFile;
  selfie: DocFile;
  proof_of_address: DocFile;
};

const EMPTY: FormState = {
  full_name: "",
  date_of_birth: "",
  nationality: "PH",
  residential_address: "",
  phone_number: "",
  email: "",
  occupation: "",
  employer_name: "",
  source_of_funds: "employment",
  annual_income_range: "25000-50000",
  political_exposure: false,
  id_document_type: "national_id",
  id_document_number: "",
  id_document_issue_date: "",
  id_document_expiry_date: "",
  id_front: null,
  id_back: null,
  selfie: null,
  proof_of_address: null,
};

async function fileToDoc(file: File): Promise<NonNullable<DocFile>> {
  const max = 4.5 * 1024 * 1024;
  if (file.size > max) throw new Error(`${file.name} is too large (max 4.5 MB)`);
  const type = file.type || "image/jpeg";
  if (!/^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/i.test(type)) {
    throw new Error("Use JPEG, PNG, WebP, or PDF");
  }
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return {
    data_base64: btoa(binary),
    content_type: type === "image/jpg" ? "image/jpeg" : type,
    name: file.name,
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function FilePick({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: DocFile;
  onChange: (v: DocFile) => void;
}) {
  return (
    <Field label={`${label}${required ? " *" : ""}`}>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-background/50 px-3 py-3 text-sm transition hover:border-primary/50">
        <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {value?.name || "Choose file"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              onChange(await fileToDoc(f));
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Upload failed");
            }
          }}
        />
      </label>
    </Field>
  );
}

function KycPage() {
  const router = useRouter();
  const fetchStatus = useServerFn(getKycStatus);
  const submit = useServerFn(submitKycApplication);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["kyc-status"],
    queryFn: () => fetchStatus({}),
    refetchInterval: (q) => {
      const s = (q.state.data as { kyc_status?: Status } | undefined)?.kyc_status;
      return s === "pending" || s === "in_review" ? 8000 : false;
    },
  });

  const status: Status = (data?.kyc_status as Status) ?? "not_started";
  const partnerStatus = (data as { partner_status?: string } | undefined)?.partner_status;
  const needsMore =
    partnerStatus === "additional_info_required" || status === "rejected";
  const meta = META[status];
  const Icon = meta.icon;

  const canStart =
    status === "not_started" || needsMore || partnerStatus === "additional_info_required";

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const steps = useMemo(
    () => ["Personal", "Financial", "Documents", "Review"],
    [],
  );

  function validateStep(): string | null {
    if (step === 0) {
      if (!form.full_name.trim()) return "Full name is required";
      if (!form.date_of_birth) return "Date of birth is required";
      if (!form.nationality.trim()) return "Nationality is required";
      if (!form.residential_address.trim()) return "Address is required";
      if (!form.phone_number.trim()) return "Phone number is required";
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        return "Valid email is required";
    }
    if (step === 2) {
      if (!form.id_document_number.trim()) return "ID number is required";
      if (!form.id_front) return "ID front photo is required";
      if (!form.selfie) return "Selfie is required";
    }
    return null;
  }

  async function onSubmit() {
    const err = validateStep();
    if (err) {
      toast.error(err);
      return;
    }
    if (!form.id_front || !form.selfie) {
      toast.error("ID front and selfie are required");
      return;
    }
    setBusy(true);
    try {
      await submit({
        data: {
          full_name: form.full_name.trim(),
          date_of_birth: form.date_of_birth,
          nationality: form.nationality.trim().toUpperCase(),
          residential_address: form.residential_address.trim(),
          phone_number: form.phone_number.trim(),
          email: form.email.trim(),
          occupation: form.occupation.trim() || undefined,
          employer_name: form.employer_name.trim() || undefined,
          source_of_funds: form.source_of_funds,
          annual_income_range: form.annual_income_range,
          political_exposure: form.political_exposure,
          id_document_type: form.id_document_type,
          id_document_number: form.id_document_number.trim(),
          id_document_issue_date: form.id_document_issue_date || undefined,
          id_document_expiry_date: form.id_document_expiry_date || undefined,
          documents: {
            id_front: {
              data_base64: form.id_front.data_base64,
              content_type: form.id_front.content_type,
            },
            ...(form.id_back
              ? {
                  id_back: {
                    data_base64: form.id_back.data_base64,
                    content_type: form.id_back.content_type,
                  },
                }
              : {}),
            selfie: {
              data_base64: form.selfie.data_base64,
              content_type: form.selfie.content_type,
            },
            ...(form.proof_of_address
              ? {
                  proof_of_address: {
                    data_base64: form.proof_of_address.data_base64,
                    content_type: form.proof_of_address.content_type,
                  },
                }
              : {}),
          },
        },
      });
      toast.success("Application submitted to OpenPay");
      setShowForm(false);
      setStep(0);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ph-page mx-auto max-w-lg space-y-6 py-4 md:max-w-xl">
      <header>
        <h1 className="text-2xl font-bold md:text-3xl">Identity Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reviewed by OpenPay · Required for full access
        </p>
      </header>

      <div className="rounded-2xl bg-card p-6 md:p-8">
        {isLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading status…
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="h-4 w-4" /> {(error as Error).message}
          </div>
        ) : (
          <>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className={`grid h-12 w-12 place-items-center rounded-2xl ${meta.tone}`}>
                  <Icon
                    className={`h-5 w-5 ${status === "in_review" ? "animate-spin" : ""}`}
                  />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Status
                  </div>
                  <div className="text-lg font-semibold">{meta.label}</div>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${meta.tone}`}>
                {meta.label}
              </span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{meta.desc}</p>

            {(data as { rejection_reason?: string | null })?.rejection_reason ? (
              <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {(data as { rejection_reason: string }).rejection_reason}
              </p>
            ) : null}

            {data?.kyc_verified_at && (
              <p className="mt-2 text-xs text-muted-foreground">
                Verified on {new Date(data.kyc_verified_at).toLocaleString()}
              </p>
            )}

            {!showForm && (
              <div className="mt-6 flex flex-wrap gap-3">
                {status === "verified" ? (
                  <Button
                    variant="outline"
                    onClick={() => router.navigate({ to: "/dashboard" })}
                  >
                    Back to dashboard
                  </Button>
                ) : (
                  <>
                    {canStart ? (
                      <Button
                        onClick={() => {
                          setShowForm(true);
                          setStep(0);
                        }}
                        className="min-w-40"
                      >
                        {needsMore ? "Resubmit application" : "Verify identity"}
                      </Button>
                    ) : null}
                    <Button variant="outline" onClick={() => refetch()}>
                      Refresh status
                    </Button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showForm && (
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 md:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">
              Step {step + 1} of {steps.length} · {steps[step]}
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>

          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name *">
                <Input
                  value={form.full_name}
                  onChange={(e) => patch("full_name", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Date of birth *">
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => patch("date_of_birth", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Nationality (ISO) *">
                <Input
                  value={form.nationality}
                  maxLength={3}
                  onChange={(e) => patch("nationality", e.target.value.toUpperCase())}
                  className="rounded-xl"
                  placeholder="PH"
                />
              </Field>
              <Field label="Phone *">
                <Input
                  value={form.phone_number}
                  onChange={(e) => patch("phone_number", e.target.value)}
                  className="rounded-xl"
                  placeholder="+63917…"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Email *">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => patch("email", e.target.value)}
                    className="rounded-xl"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Residential address *">
                  <Textarea
                    value={form.residential_address}
                    onChange={(e) => patch("residential_address", e.target.value)}
                    className="min-h-18 rounded-xl"
                  />
                </Field>
              </div>
              <Field label="Occupation">
                <Input
                  value={form.occupation}
                  onChange={(e) => patch("occupation", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Employer">
                <Input
                  value={form.employer_name}
                  onChange={(e) => patch("employer_name", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Source of funds *">
                <Select
                  value={form.source_of_funds}
                  onValueChange={(v) =>
                    patch("source_of_funds", v as FormState["source_of_funds"])
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNDS.map((o) => (
                      <SelectItem key={o.v} value={o.v}>
                        {o.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Annual income *">
                <Select
                  value={form.annual_income_range}
                  onValueChange={(v) =>
                    patch("annual_income_range", v as FormState["annual_income_range"])
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME.map((o) => (
                      <SelectItem key={o.v} value={o.v}>
                        {o.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.political_exposure}
                    onChange={(e) => patch("political_exposure", e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  I am a politically exposed person (PEP)
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ID type *">
                <Select
                  value={form.id_document_type}
                  onValueChange={(v) =>
                    patch("id_document_type", v as FormState["id_document_type"])
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ID_TYPES.map((o) => (
                      <SelectItem key={o.v} value={o.v}>
                        {o.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="ID number *">
                <Input
                  value={form.id_document_number}
                  onChange={(e) => patch("id_document_number", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Issue date">
                <Input
                  type="date"
                  value={form.id_document_issue_date}
                  onChange={(e) => patch("id_document_issue_date", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Expiry date">
                <Input
                  type="date"
                  value={form.id_document_expiry_date}
                  onChange={(e) => patch("id_document_expiry_date", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
              <FilePick
                label="ID front"
                required
                value={form.id_front}
                onChange={(v) => patch("id_front", v)}
              />
              <FilePick
                label="ID back"
                value={form.id_back}
                onChange={(v) => patch("id_back", v)}
              />
              <FilePick
                label="Selfie"
                required
                value={form.selfie}
                onChange={(v) => patch("selfie", v)}
              />
              <FilePick
                label="Proof of address"
                value={form.proof_of_address}
                onChange={(v) => patch("proof_of_address", v)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="text-foreground">{form.full_name}</span> ·{" "}
                {form.nationality} · {form.email}
              </p>
              <p>
                {ID_TYPES.find((x) => x.v === form.id_document_type)?.l}{" "}
                {form.id_document_number}
              </p>
              <p>
                Docs: front{form.id_back ? ", back" : ""}, selfie
                {form.proof_of_address ? ", proof of address" : ""}
              </p>
              <p className="pt-2">
                Submitting sends your application to OpenPay for admin review. Documents are
                stored in OpenPay&apos;s private vault — OpenPay Pro only receives the decision.
              </p>
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0 || busy}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            {step < steps.length - 1 ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  const err = validateStep();
                  if (err) {
                    toast.error(err);
                    return;
                  }
                  setStep((s) => s + 1);
                }}
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" disabled={busy} onClick={() => void onSubmit()}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Submit to OpenPay
              </Button>
            )}
          </div>
        </div>
      )}

      {!showForm && (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 text-sm text-muted-foreground">
          <div className="mb-2 font-medium text-foreground">What to expect</div>
          <ul className="list-disc space-y-1 pl-5">
            <li>Fill in your details and upload an ID plus a selfie on this page.</li>
            <li>OpenPay admins review applications and push the result back here.</li>
            <li>We never store your ID images locally — only the verification outcome.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
