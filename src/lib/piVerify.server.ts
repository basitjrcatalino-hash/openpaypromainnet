// Pi Verify REST API client (server-only).
// Docs: https://piverify.minepi.com/portal/api-keys
// API base: https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com

import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

export type PiVerifyStatus =
  | "not_started"
  | "pending"
  | "in_review"
  | "verified"
  | "rejected"
  | "failed";

export interface CreateVerificationInput {
  userId: string;
  piUid?: string | null;
  email?: string | null;
  returnUrl: string;
}

export interface CreateVerificationResult {
  verification_id: string;
  verification_url: string;
  status: PiVerifyStatus;
}

export interface VerificationStatusResult {
  verification_id: string;
  status: PiVerifyStatus;
  updated_at?: string;
  rejection_reason?: string | null;
}

function getEnv() {
  const apiKey = process.env.PI_VERIFY_API_KEY;
  const baseUrl =
    process.env.PI_VERIFY_BASE_URL ??
    "https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com";
  if (!apiKey) throw new Error("PI_VERIFY_API_KEY is not configured");
  return { apiKey, baseUrl: baseUrl.replace(/\/+$/, "") };
}

async function piFetch<T>(
  path: string,
  init: RequestInit & { retries?: number } = {},
): Promise<T> {
  const { apiKey, baseUrl } = getEnv();
  const { retries = 2, headers, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        ...rest,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: `Bearer ${apiKey}`,
          ...(headers as Record<string, string> | undefined),
        },
      });
      const text = await res.text();
      const body = text ? safeJson(text) : null;
      if (!res.ok) {
        const msg =
          (body && (body.error || body.message)) ||
          `Pi Verify ${res.status} ${res.statusText}`.trim();
        if (res.status >= 500 && attempt < retries) {
          await delay(250 * (attempt + 1));
          continue;
        }
        throw new Error(msg);
      }
      return body as T;
    } catch (e) {
      lastErr = e;
      if (attempt >= retries) break;
      await delay(250 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Pi Verify request failed");
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function createVerification(
  input: CreateVerificationInput,
): Promise<CreateVerificationResult> {
  const body = {
    external_user_id: input.userId,
    idempotency_key: `${input.userId}_${Date.now()}_${randomUUID().slice(0, 8)}`,
  };
  const data = await piFetch<any>("/api/v1/kyc_sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const verification_id = data?.id ?? data?.session_id;
  const verification_url = data?.hosted_flow_url ?? data?.verification_url ?? data?.url;
  if (!verification_id || !verification_url) {
    throw new Error("Pi Verify returned an unexpected response");
  }
  return {
    verification_id,
    verification_url,
    status: normalizeStatus(data?.status),
  };
}

export async function getVerificationStatus(
  verificationId: string,
): Promise<VerificationStatusResult> {
  const data = await piFetch<any>(
    `/api/v1/kyc_sessions/${encodeURIComponent(verificationId)}`,
    { method: "GET" },
  );
  return {
    verification_id: data?.id ?? verificationId,
    status: normalizeStatus(data?.status),
    updated_at: data?.updated_at,
    rejection_reason: data?.rejection_reason ?? null,
  };
}

export function normalizeStatus(s: unknown): PiVerifyStatus {
  const v = String(s ?? "").toLowerCase();
  if (["approved", "verified", "success"].includes(v)) return "verified";
  if (["rejected", "denied"].includes(v)) return "rejected";
  if (["failed", "error"].includes(v)) return "failed";
  if (["pending_review", "in_review", "review", "processing"].includes(v))
    return "in_review";
  if (["pending", "created", "started"].includes(v)) return "pending";
  return "not_started";
}

/** Map a Pi Verify webhook event type to our normalized status. */
export function statusFromEventType(type: unknown): PiVerifyStatus | null {
  const t = String(type ?? "").toLowerCase();
  switch (t) {
    case "kyc.session.approved":
      return "verified";
    case "kyc.session.rejected":
      return "rejected";
    case "kyc.session.failed":
      return "failed";
    case "kyc.session.pending_review":
      return "in_review";
    case "kyc.session.started":
      return "pending";
    default:
      return null;
  }
}

/** Verify Pi Verify webhook signature: header `X-PiVerify-Signature: sha256=<hex>`. */
export function verifyWebhook(rawBody: string, signature: string | null): boolean {
  const secret =
    process.env.PI_VERIFY_WEBHOOK_SECRET ||
    process.env.PIVERIFY_WEBHOOK_SECRET ||
    process.env.PI_VERIFY_API_KEY;
  if (!secret || !signature) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
