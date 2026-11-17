import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Platform configuration readers. The config tables are admin-only at the database
 * level; these functions return only the fields the app needs to render.
 */
async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Maintenance switches — needed on every page, including signed-out ones. */
export const getPublicFeatureFlags = createServerFn({ method: "GET" }).handler(async () => {
  const db = await adminClient();
  const { data, error } = await db
    .from("feature_flags")
    .select("id, feature_key, label, feature_group, path_prefix, enabled, message, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw new Error("Could not load feature switches");
  return data ?? [];
});

/** Sign-in method switches — needed on the signed-out sign-in page. */
export const getPublicAuthMethodFlags = createServerFn({ method: "GET" }).handler(async () => {
  const db = await adminClient();
  const { fetchAuthMethodFlags } = await import("@/lib/auth-methods");
  return fetchAuthMethodFlags(db as any);
});

export const getScanTargetRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const db = await adminClient();
    const { data, error } = await (db as any)
      .from("scanner_targets")
      .select("id, target_key, label, description, enabled, message, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw new Error("Could not load scanner settings");
    return (data ?? []) as Array<{
      id: string;
      target_key: string;
      label: string;
      description: string | null;
      enabled: boolean;
      message: string | null;
      sort_order: number;
    }>;
  });

export const getP2PPaymentMethodRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const db = await adminClient();
    const { data, error } = await db
      .from("p2p_payment_methods")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error("Could not load payment methods");
    return data ?? [];
  });
