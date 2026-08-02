/**
 * OpenPay Partner KYC API client (server-only).
 * Base: …/functions/v1/kyc-partner-api
 * Auth: Bearer opk_live_… (OPENPAY_KYC_API_KEY or partner key aliases)
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const OPENPAY_KYC_BASE_DEFAULT =
  "https://araojncyittkahvvpdrn.supabase.co/functions/v1/kyc-partner-api";

export type OpenPayKycPartnerStatus =
  | "not_submitted"
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "additional_info_required";

/** Local profiles.kyc_status enum values. */
export type ProKycStatus =
  | "not_started"
  | "pending"
  | "in_review"
  | "verified"
  | "rejected";

export function kycApiKeyFromEnv(): string {
  return (
    process.env.OPENPAY_KYC_API_KEY ||
    process.env.OPENPAY_PARTNER_API_KEY ||
    process.env.OPENPAY_API_KEY ||
    process.env.OPENPAY_TRANSFER_API_KEY ||
    ""
  )
    .trim()
    .replace(/^["']+|["']+$/g, "");
}

export function kycApiBaseFromEnv(): string {
  return (
    process.env.OPENPAY_KYC_API_BASE ||
    OPENPAY_KYC_BASE_DEFAULT
  ).replace(/\/+$/, "");
}

function sha256Hex(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

async function kycFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const key = kycApiKeyFromEnv();
  if (!key) throw new Error("OPENPAY_KYC_API_KEY (or OPENPAY_PARTNER_API_KEY) is not configured");
  const base = kycApiBaseFromEnv();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error(text || `KYC API ${res.status}`);
  }
  return { ok: res.ok, status: res.status, data };
}

export function mapPartnerStatusToPro(status: string | null | undefined): ProKycStatus {
  const s = String(status ?? "").toLowerCase();
  if (s === "approved") return "verified";
  if (s === "rejected") return "rejected";
  if (s === "under_review") return "in_review";
  if (s === "pending" || s === "additional_info_required") return "pending";
  if (s === "not_submitted") return "not_started";
  return "not_started";
}

export type SubmitKycPayload = {
  external_user_id: string;
  external_ref?: string;
  callback_url: string;
  openpay_user_id?: string | null;
  full_name: string;
  date_of_birth: string;
  nationality: string;
  residential_address: string;
  phone_number: string;
  email: string;
  occupation?: string;
  employer_name?: string;
  source_of_funds: string;
  annual_income_range: string;
  political_exposure: boolean;
  id_document_type: string;
  id_document_number: string;
  id_document_issue_date?: string;
  id_document_expiry_date?: string;
  documents: {
    id_front?: { data_base64: string; content_type: string };
    id_back?: { data_base64: string; content_type: string };
    selfie?: { data_base64: string; content_type: string };
    proof_of_address?: { data_base64: string; content_type: string } | { url: string };
  };
  liveness_passed?: boolean;
  liveness_score?: number;
  metadata?: Record<string, unknown>;
};

export async function submitPartnerKycApplication(payload: SubmitKycPayload) {
  const { ok, status, data } = await kycFetch<Record<string, unknown>>("/applications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!ok && status !== 200) {
    const err = data as { error?: string; missing?: string[] };
    const missing = err.missing?.length ? ` Missing: ${err.missing.join(", ")}` : "";
    throw new Error((err.error || "KYC submit failed") + missing);
  }
  return data;
}

export async function resubmitPartnerKycApplication(
  applicationId: string,
  payload: SubmitKycPayload,
) {
  const { ok, data } = await kycFetch<Record<string, unknown>>(
    `/applications/${encodeURIComponent(applicationId)}/resubmit`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  if (!ok) {
    const err = data as { error?: string };
    throw new Error(err.error || "KYC resubmit failed");
  }
  return data;
}

export async function getPartnerKycUserStatus(externalUserId: string) {
  const { ok, data } = await kycFetch<Record<string, unknown>>(
    `/users/${encodeURIComponent(externalUserId)}`,
    { method: "GET" },
  );
  if (!ok) {
    const err = data as { error?: string };
    throw new Error(err.error || "KYC status fetch failed");
  }
  return data;
}

/**
 * Verify X-OpenPay-Signature: sha256=<hmac_hex>
 * Signing secret = sha256_hex(partner API key)
 */
export function verifyOpenPayKycWebhook(rawBody: string, signatureHeader: string | null): boolean {
  const apiKey = kycApiKeyFromEnv();
  if (!apiKey || !signatureHeader) return false;
  const secret = sha256Hex(apiKey);
  const got = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(got, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function partnerStatusFromEventType(type: unknown): OpenPayKycPartnerStatus | null {
  const t = String(type ?? "").toLowerCase();
  switch (t) {
    case "kyc.approved":
      return "approved";
    case "kyc.rejected":
      return "rejected";
    case "kyc.additional_info_required":
      return "additional_info_required";
    case "kyc.under_review":
      return "under_review";
    default:
      return null;
  }
}
