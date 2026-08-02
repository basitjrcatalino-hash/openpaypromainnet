import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const docUpload = z.object({
  data_base64: z.string().min(32).max(12_000_000),
  content_type: z
    .string()
    .min(3)
    .max(120)
    .regex(/^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/i),
});

const submitSchema = z.object({
  full_name: z.string().trim().min(2).max(200),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nationality: z.string().trim().min(2).max(3),
  residential_address: z.string().trim().min(5).max(500),
  phone_number: z.string().trim().min(7).max(40),
  email: z.string().trim().email().max(200),
  occupation: z.string().trim().max(200).optional(),
  employer_name: z.string().trim().max(200).optional(),
  source_of_funds: z.enum([
    "employment",
    "business",
    "investments",
    "inheritance",
    "savings",
    "other",
  ]),
  annual_income_range: z.enum([
    "0-25000",
    "25000-50000",
    "50000-100000",
    "100000-250000",
    "250000+",
  ]),
  political_exposure: z.boolean(),
  id_document_type: z.enum([
    "passport",
    "national_id",
    "drivers_license",
    "residence_permit",
  ]),
  id_document_number: z.string().trim().min(3).max(100),
  id_document_issue_date: z
    .string()
    .optional()
    .transform((s) =>
      s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined,
    ),
  id_document_expiry_date: z
    .string()
    .optional()
    .transform((s) =>
      s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined,
    ),
  documents: z.object({
    id_front: docUpload,
    id_back: docUpload.optional(),
    selfie: docUpload,
    proof_of_address: docUpload.optional(),
  }),
});

function externalRefFor(userId: string) {
  return `pro_${userId}`;
}

function callbackUrlFromEnv() {
  const base = (
    process.env.APP_URL ||
    process.env.VITE_APP_URL ||
    "https://openpaypro.space"
  ).replace(/\/+$/, "");
  return `${base}/api/public/openpay/kyc-webhook`;
}

async function syncProfileFromPartner(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
  userId: string;
  partnerStatus: string;
  applicationId?: string | null;
  rejectionReason?: string | null;
  adminNotes?: string | null;
}) {
  const {
    mapPartnerStatusToPro,
  } = await import("./openpay-kyc.server");
  const proStatus = mapPartnerStatusToPro(opts.partnerStatus);
  const now = new Date().toISOString();
  const profilePatch: Record<string, unknown> = {
    kyc_status: proStatus,
    kyc_updated_at: now,
  };
  if (opts.applicationId) profilePatch.kyc_verification_id = opts.applicationId;
  if (proStatus === "verified") profilePatch.kyc_verified_at = now;

  await opts.admin.from("profiles").update(profilePatch as never).eq("id", opts.userId);

  await opts.admin.from("openpay_kyc_links").upsert(
    {
      user_id: opts.userId,
      external_ref: externalRefFor(opts.userId),
      application_id: opts.applicationId ?? null,
      status: opts.partnerStatus,
      rejection_reason: opts.rejectionReason ?? null,
      admin_notes: opts.adminNotes ?? null,
      last_event_at: now,
      updated_at: now,
    } as never,
    { onConflict: "external_ref" },
  );

  return { proStatus, now };
}

export const submitKycApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      submitPartnerKycApplication,
      resubmitPartnerKycApplication,
    } = await import("./openpay-kyc.server");

    const { data: link } = await supabaseAdmin
      .from("openpay_kyc_links")
      .select("application_id,status")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: userInfo } = await context.supabase.auth.getUser();
    const email = data.email || userInfo.user?.email || "";

    const payload = {
      external_user_id: userId,
      external_ref: externalRefFor(userId),
      callback_url: callbackUrlFromEnv(),
      openpay_user_id: null as string | null,
      full_name: data.full_name,
      date_of_birth: data.date_of_birth,
      nationality: data.nationality.toUpperCase(),
      residential_address: data.residential_address,
      phone_number: data.phone_number,
      email,
      occupation: data.occupation || undefined,
      employer_name: data.employer_name || undefined,
      source_of_funds: data.source_of_funds,
      annual_income_range: data.annual_income_range,
      political_exposure: data.political_exposure,
      id_document_type: data.id_document_type,
      id_document_number: data.id_document_number,
      id_document_issue_date: data.id_document_issue_date || undefined,
      id_document_expiry_date: data.id_document_expiry_date || undefined,
      documents: data.documents,
      liveness_passed: true,
      metadata: { platform: "openpay_pro" },
    };

    const needsResubmit =
      link?.application_id &&
      (link.status === "rejected" || link.status === "additional_info_required");

    const result = needsResubmit
      ? await resubmitPartnerKycApplication(String(link.application_id), payload)
      : await submitPartnerKycApplication(payload);

    const applicationId = String(
      (result as { application_id?: string }).application_id ||
        link?.application_id ||
        "",
    );
    const partnerStatus = String(
      (result as { status?: string }).status || "pending",
    );

    await syncProfileFromPartner({
      admin: supabaseAdmin,
      userId,
      partnerStatus,
      applicationId: applicationId || null,
    });

    return {
      application_id: applicationId || null,
      status: partnerStatus,
      kyc_status: (await import("./openpay-kyc.server")).mapPartnerStatusToPro(partnerStatus),
      idempotent: !!(result as { idempotent?: boolean }).idempotent,
    };
  });

/** @deprecated Use submitKycApplication — kept so old clients don't crash. */
export const createKycVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string }) =>
    z.object({ returnUrl: z.string().url().max(2048).optional() }).parse(data ?? {}),
  )
  .handler(async () => {
    throw new Error(
      "Pi Verify is no longer used. Submit identity verification from the KYC form.",
    );
  });

export const getKycStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPartnerKycUserStatus } = await import("./openpay-kyc.server");

    const [{ data: profile }, { data: link }] = await Promise.all([
      supabase
        .from("profiles")
        .select("kyc_status,kyc_verification_id,kyc_verified_at,kyc_updated_at")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("openpay_kyc_links")
        .select(
          "application_id,status,rejection_reason,admin_notes,last_event_at,updated_at",
        )
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const base = {
      kyc_status: (profile?.kyc_status as string) ?? "not_started",
      kyc_verification_id: profile?.kyc_verification_id ?? null,
      kyc_verified_at: profile?.kyc_verified_at ?? null,
      kyc_updated_at: profile?.kyc_updated_at ?? null,
      partner_status: (link?.status as string) ?? "not_submitted",
      rejection_reason: (link?.rejection_reason as string | null) ?? null,
      admin_notes: (link?.admin_notes as string | null) ?? null,
      application_id: (link?.application_id as string | null) ?? null,
    };

    // Safety-net poll against OpenPay when not in a terminal local state
    if (base.kyc_status !== "verified") {
      try {
        const live = await getPartnerKycUserStatus(userId);
        const partnerStatus = String(
          (live as { status?: string }).status || "not_submitted",
        );
        if (partnerStatus === "not_submitted") return base;

        const applicationId =
          String((live as { application_id?: string }).application_id || "") ||
          base.application_id;
        const review = (live as {
          review?: { rejection_reason?: string | null; admin_notes?: string | null };
        }).review;

        if (
          partnerStatus !== base.partner_status ||
          applicationId !== base.application_id
        ) {
          const { proStatus, now } = await syncProfileFromPartner({
            admin: supabaseAdmin,
            userId,
            partnerStatus,
            applicationId,
            rejectionReason: review?.rejection_reason ?? null,
            adminNotes: review?.admin_notes ?? null,
          });
          return {
            kyc_status: proStatus,
            kyc_verification_id: applicationId,
            kyc_verified_at:
              proStatus === "verified" ? now : base.kyc_verified_at,
            kyc_updated_at: now,
            partner_status: partnerStatus,
            rejection_reason: review?.rejection_reason ?? base.rejection_reason,
            admin_notes: review?.admin_notes ?? base.admin_notes,
            application_id: applicationId,
          };
        }
      } catch {
        /* polling failure — return local */
      }
    }

    return base;
  });
