import type { PiAuthSession } from "@/lib/piSdk";

const A2U_URL = "/api/public/pi-a2u";

async function invokePiA2U<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(A2U_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok || data?.error) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export async function verifyPiAuth(accessToken: string) {
  return invokePiA2U<{ success: boolean; data: { uid: string; username: string } }>({ action: "auth_verify", accessToken });
}

export type WalletProgress = {
  unique_wallets: number;
  target: number;
  progress_label: string;
  completed: boolean;
  total_successful_a2u?: number;
};

export async function fetchWalletProgress(): Promise<WalletProgress> {
  const r = await invokePiA2U<{ success: boolean; data: WalletProgress }>({ action: "progress" });
  return r.data;
}

export async function claimTestnetPi(session: PiAuthSession, body?: { amount?: number; memo?: string }) {
  return invokePiA2U<{
    success: boolean;
    data: {
      payment_id: string;
      txid: string;
      wallet_address: string;
      amount: number;
      memo: string;
      progress: WalletProgress;
      wallet_added: boolean;
    };
  }>({
    action: "claim",
    accessToken: session.accessToken,
    amount: body?.amount,
    memo: body?.memo ?? "Testnet reward",
  });
}

export type AdminDashboard = {
  progress: WalletProgress & { wallets: Array<{ wallet_address: string; uid: string; username: string | null; txid: string | null; payment_id: string | null; created_at: string }> };
  total_successful_a2u: number;
  unique_wallets_count: number;
  wallet_addresses: string[];
  transactions: Array<{ id: number; uid: string; username: string | null; payment_id: string; amount: number; memo: string | null; status: string; txid: string | null; wallet_address: string | null; error: string | null; created_at: string; updated_at: string }>;
  successful_transactions: AdminDashboard["transactions"];
  failed_transactions: AdminDashboard["transactions"];
  logs: Array<{ timestamp: string; level: string; message: string; details: unknown; uid: string; username: string | null }>;
};

export async function fetchAdminDashboard() {
  const r = await invokePiA2U<{ success: boolean; data: AdminDashboard }>({ action: "admin_dashboard" });
  return r.data;
}