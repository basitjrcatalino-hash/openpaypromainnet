import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FeatureFlag = {
  id: string;
  feature_key: string;
  label: string;
  feature_group: string;
  path_prefix: string;
  enabled: boolean;
  message: string | null;
  sort_order: number;
};

export const FEATURE_FLAGS_QUERY_KEY = ["feature-flags"] as const;

export async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as FeatureFlag[];
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: FEATURE_FLAGS_QUERY_KEY,
    queryFn: fetchFeatureFlags,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Paths that must stay reachable even during global maintenance. */
const ALWAYS_ALLOWED = ["/settings", "/admin", "/auth", "/authpi"];

function matches(pathname: string, prefix: string) {
  if (prefix === "*") return true;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Returns the flag blocking this pathname, or null when the route is available.
 */
export function findBlockingFlag(
  pathname: string,
  flags: FeatureFlag[] | undefined,
): FeatureFlag | null {
  if (!flags?.length) return null;
  if (ALWAYS_ALLOWED.some((p) => matches(pathname, p))) return null;

  const global = flags.find((f) => f.feature_key === "global");
  if (global && !global.enabled) return global;

  const hit = flags.find((f) => f.feature_key !== "global" && !f.enabled && matches(pathname, f.path_prefix));
  return hit ?? null;
}

/** True when a feature key is switched off (used to hide nav entries). */
export function isFeatureOff(flags: FeatureFlag[] | undefined, key: string) {
  const f = flags?.find((x) => x.feature_key === key);
  return !!f && !f.enabled;
}
