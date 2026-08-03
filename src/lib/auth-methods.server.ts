import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/integrations/supabase/env";
import { getSupabaseServiceRoleKey } from "@/integrations/supabase/env.server";
import { isAuthMethodKey, type AuthMethodKey } from "@/lib/auth-methods";

function serviceClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey() || getSupabasePublishableKey();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Server-side check — returns false when method is maintenance-hidden. Missing row = enabled. */
export async function isAuthMethodEnabled(methodKey: string): Promise<{
  enabled: boolean;
  message: string | null;
}> {
  if (!isAuthMethodKey(methodKey)) {
    return { enabled: false, message: "Unknown sign-in method." };
  }
  try {
    const supabase = serviceClient();
    const { data, error } = await supabase
      .from("auth_methods")
      .select("enabled, maintenance_message")
      .eq("method_key", methodKey)
      .maybeSingle();
    if (error || !data) return { enabled: true, message: null };
    return {
      enabled: !!data.enabled,
      message:
        data.maintenance_message ||
        `${methodKey} sign-in is temporarily unavailable. Try another method.`,
    };
  } catch {
    return { enabled: true, message: null };
  }
}

export async function assertAuthMethodEnabled(methodKey: AuthMethodKey | string): Promise<Response | null> {
  const { enabled, message } = await isAuthMethodEnabled(methodKey);
  if (enabled) return null;
  return Response.json(
    { error: message || "This sign-in method is temporarily unavailable." },
    { status: 503 },
  );
}
