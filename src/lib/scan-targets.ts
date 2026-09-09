import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Payload families the OpenPay Pro scanner can read. Each one is admin-toggleable. */
export type ScanTargetKey =
  | "openpay_pro"
  | "openpay"
  | "pi_wallet"
  | "qrph"
  | "walletconnect";

export type ScanTarget = {
  id: string;
  target_key: ScanTargetKey;
  label: string;
  description: string | null;
  enabled: boolean;
  message: string | null;
  sort_order: number;
};

export const SCAN_TARGET_CATALOG: readonly {
  target_key: ScanTargetKey;
  label: string;
  description: string;
}[] = [
  {
    target_key: "openpay_pro",
    label: "OpenPay Pro wallet",
    description: "0x… wallet QR, /pay links, OpenToken QR",
  },
  {
    target_key: "openpay",
    label: "OpenPay account",
    description: "OP… account numbers, @username, openpay:// links",
  },
  { target_key: "pi_wallet", label: "Pi Wallet", description: "G… Pi / Stellar addresses" },
  {
    target_key: "qrph",
    label: "QR Ph / InstaPay",
    description: "EMVCo bank & e-wallet QR (GCash, Maya, banks)",
  },
  { target_key: "walletconnect", label: "WalletConnect Pay", description: "WalletConnect pay links" },
] as const;

export const SCAN_TARGETS_QUERY_KEY = ["scan-targets"] as const;

/** All-enabled fallback so the scanner keeps working if the table is unreachable. */
export function defaultScanTargetFlags(): Record<ScanTargetKey, boolean> {
  return Object.fromEntries(SCAN_TARGET_CATALOG.map((t) => [t.target_key, true])) as Record<
    ScanTargetKey,
    boolean
  >;
}

export async function fetchScanTargets(): Promise<ScanTarget[]> {
  const { data, error } = await (supabase as any)
    .from("scanner_targets")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ScanTarget[];
}

export function useScanTargets() {
  const q = useQuery({
    queryKey: SCAN_TARGETS_QUERY_KEY,
    queryFn: fetchScanTargets,
    staleTime: 30_000,
    retry: 1,
  });

  const flags = defaultScanTargetFlags();
  for (const row of q.data ?? []) {
    if (row.target_key in flags) flags[row.target_key] = !!row.enabled;
  }
  const messages: Partial<Record<ScanTargetKey, string>> = {};
  for (const row of q.data ?? []) {
    if (row.message) messages[row.target_key] = row.message;
  }

  return { flags, messages, rows: q.data ?? [], isLoading: q.isLoading };
}
