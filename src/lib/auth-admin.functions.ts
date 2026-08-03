import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin, claimFirstAdmin } from "@/lib/topup-admin.functions";

export { checkIsAdmin, claimFirstAdmin };

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin only");
}

export const listAuthMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("auth_methods")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const MethodUpdateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(200).nullable().optional(),
  enabled: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(999).optional(),
  maintenance_message: z.string().trim().max(200).nullable().optional(),
});

export const updateAuthMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MethodUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("auth_methods").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Upsert catalog methods into `auth_methods` so new providers appear in Admin → Auth.
 * Does not overwrite existing `enabled` flags.
 */
export const ensureAuthMethods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { AUTH_METHOD_CATALOG } = await import("@/lib/auth-methods");

    const { data: existing, error: listErr } = await context.supabase
      .from("auth_methods")
      .select("method_key");
    if (listErr) throw new Error(listErr.message);

    const have = new Set((existing ?? []).map((r: { method_key: string }) => r.method_key));
    const missing = AUTH_METHOD_CATALOG.filter((m) => !have.has(m.method_key));

    if (missing.length) {
      const { error: insertErr } = await context.supabase.from("auth_methods").insert(
        missing.map((m) => ({
          method_key: m.method_key,
          label: m.label,
          description: m.description,
          enabled: m.enabled,
          sort_order: m.sort_order,
        })),
      );
      if (insertErr) throw new Error(insertErr.message);
    }

    const { data, error } = await context.supabase
      .from("auth_methods")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { ok: true, inserted: missing.map((m) => m.method_key), methods: data ?? [] };
  });

export const setAllAuthMethodsEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("auth_methods")
      .update({ enabled: data.enabled, updated_at: new Date().toISOString() })
      .neq("method_key", "");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
