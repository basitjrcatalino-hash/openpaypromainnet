/**
 * Bags server config / env — no BagsSDK import (CJS breaks Lovable/Nitro ESM).
 */
const BAGS_API_BASE = "https://public-api-v2.bags.fm/api/v1";

export function requireBagsApiKey(): string {
  const key = String(process.env.BAGS_API_KEY ?? "").trim();
  if (!key) throw new Error("BAGS_API_KEY is not configured on the server");
  return key;
}

export function getBagsUserUuid(): string | null {
  const id = String(process.env.BAGS_USER_UUID ?? "").trim();
  return id || null;
}

export function getBagsPartnerConfig(): string | null {
  const v = String(process.env.BAGS_PARTNER_CONFIG ?? "").trim();
  return v || null;
}

export function getBagsPartnerWallet(): string | null {
  const v = String(process.env.BAGS_PARTNER_WALLET ?? "").trim();
  return v || null;
}

export function getBagsPartnerRef(): string {
  return String(process.env.BAGS_PARTNER_REF ?? "mrwain").trim() || "mrwain";
}

export function getBagsPartnerRefUrl(): string {
  const ref = getBagsPartnerRef();
  return (
    String(process.env.BAGS_PARTNER_REF_URL ?? "").trim() ||
    `https://bags.fm/?ref=${encodeURIComponent(ref)}`
  );
}

export function getBagsRpcUrl(): string {
  return (
    String(process.env.SOLANA_RPC_URL ?? "").trim() ||
    String(process.env.VITE_SOLANA_RPC_URL ?? "").trim() ||
    "https://api.mainnet-beta.solana.com"
  );
}

export async function bagsApiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const apiKey = requireBagsApiKey();
  const url = path.startsWith("http") ? path : `${BAGS_API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as {
    success?: boolean;
    response?: T;
    error?: string;
  };
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Bags API error (${res.status})`);
  }
  return json.response as T;
}

export { BAGS_API_BASE };
