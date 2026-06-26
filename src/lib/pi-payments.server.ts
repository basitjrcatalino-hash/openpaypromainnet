// Server-only helpers for Pi Network payments. Never imported from the client.
import type { SupabaseClient } from "@supabase/supabase-js";

const PI_API_BASE = "https://api.minepi.com/v2";

export type PiPaymentDTO = {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  transaction: null | { txid: string; verified: boolean; _link: string };
};

function piHeaders() {
  const key = process.env.PI_NETWORK_API_KEY;
  if (!key) throw new Error("PI_NETWORK_API_KEY is not configured");
  return { Authorization: `Key ${key}`, "Content-Type": "application/json" };
}

export async function fetchPiPayment(paymentId: string): Promise<PiPaymentDTO> {
  const res = await fetch(`${PI_API_BASE}/payments/${paymentId}`, { headers: piHeaders() });
  if (!res.ok) throw new Error(`Pi GET payment failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as PiPaymentDTO;
}

export async function approvePiPayment(paymentId: string): Promise<PiPaymentDTO> {
  const res = await fetch(`${PI_API_BASE}/payments/${paymentId}/approve`, {
    method: "POST",
    headers: piHeaders(),
  });
  if (!res.ok) throw new Error(`Pi approve failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as PiPaymentDTO;
}

export async function completePiPayment(paymentId: string, txid: string): Promise<PiPaymentDTO> {
  const res = await fetch(`${PI_API_BASE}/payments/${paymentId}/complete`, {
    method: "POST",
    headers: piHeaders(),
    body: JSON.stringify({ txid }),
  });
  if (!res.ok) throw new Error(`Pi complete failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as PiPaymentDTO;
}

export async function getCallerUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const jwt = auth.slice(7);
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user.id;
}

export async function getAdmin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}
