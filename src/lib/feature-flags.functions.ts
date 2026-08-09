import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin only");
}

export const listFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("feature_flags")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const UpdateSchema = z.object({
  feature_key: z.string().trim().min(1).max(60),
  enabled: z.boolean().optional(),
  message: z.string().trim().max(300).nullable().optional(),
});

export const updateFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    };
    if (data.enabled !== undefined) patch["enabled"] = data.enabled;
    if (data.message !== undefined) patch["message"] = data.message || null;

    const { error } = await context.supabase
      .from("feature_flags")
      .update(patch)
      .eq("feature_key", data.feature_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BulkSchema = z.object({ enabled: z.boolean(), group: z.string().max(60).optional() });

export const setAllFeatureFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BulkSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("feature_flags")
      .update({
        enabled: data.enabled,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .neq("feature_key", "global");
    if (data.group) q = q.eq("feature_group", data.group);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
