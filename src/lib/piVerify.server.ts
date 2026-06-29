// Pi Verify REST API client (server-only).
// Docs: https://piverify.minepi.com/portal/api-keys

import { createHmac, timingSafeEqual } from "node:crypto";

export type PiVerifyStatus = "not_started" | "pending" | "in_review" | "verified" | "rejected";

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
}

function getEnv() {
  const apiKey = process.env.PI_VERIFY_API_KEY;
  const baseUrl = process.env.PI_VERIFY_BASE_URL ?? "https://piverify.minepi.com";
  if (!apiKey) throw new Error("PI_VERIFY_API_KEY is not configured");
  return { apiKey, baseUrl: baseUrl.replace(/\/+$/, "") };
}

async function piFetch<T>(path: string, init: RequestInit & { retries?: number } = {}): Promise<T> {
  const { apiKey, baseUrl } = getEnv();
  const { retries = 2, headers, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        ...rest,
        headers: {
          "content-type": "application/json",
          "accept": "application/json",
          "authorization": `Key ${apiKey}`,
          "x-api-key": apiKey,
          ...(headers as Record<string, string> | undefined),
        },
      });
      const text = await res.text();
      const body = text ? safeJson(text) : null;
      if (!res.ok) {
        const msg = (body && (body.error || body.message)) || `Pi Verify ${res.status}`;
        if (res.status >= 500 && attempt < retries) { await delay(250 * (attempt + 1)); continue; }
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

function safeJson(s: string): any { try { return JSON.parse(s); } catch { return null; } }
function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export async function createVerification(input: CreateVerificationInput): Promise<CreateVerificationResult> {
  const body = {
    external_user_id: input.userId,
    pi_uid: input.piUid ?? undefined,
    email: input.email ?? undefined,
    return_url: input.returnUrl,
    callback_url: input.returnUrl,
  };
  const data = await piFetch<any>("/api/v1/verifications", { method: "POST", body: JSON.stringify(body) });
  return {
    verification_id: data?.verification_id ?? data?.id ?? data?.session_id,
    verification_url: data?.verification_url ?? data?.url ?? data?.redirect_url,
    status: normalizeStatus(data?.status),
  };
}

export async function getVerificationStatus(verificationId: string): Promise<VerificationStatusResult> {
  const data = await piFetch<any>(`/api/v1/verifications/${encodeURIComponent(verificationId)}`, { method: "GET" });
  return {
    verification_id: data?.verification_id ?? data?.id ?? verificationId,
    status: normalizeStatus(data?.status),
    updated_at: data?.updated_at,
  };
}

export function normalizeStatus(s: unknown): PiVerifyStatus {
  const v = String(s ?? "").toLowerCase();
  if (["verified", "approved", "success"].includes(v)) return "verified";
  if (["rejected", "denied", "failed"].includes(v)) return "rejected";
  if (["in_review", "review", "processing"].includes(v)) return "in_review";
  if (["pending", "created", "started"].includes(v)) return "pending";
  return "not_started";
}

/** Verify Pi Verify webhook signature (HMAC-SHA256 of raw body). */
export function verifyWebhook(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PI_VERIFY_WEBHOOK_SECRET || process.env.PI_VERIFY_API_KEY;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/, "");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(provided, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch { return false; }
}
