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

export const listScannerTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("scanner_targets")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const UpdateSchema = z.object({
  target_key: z.string().trim().min(1).max(60),
  enabled: z.boolean().optional(),
  message: z.string().trim().max(300).nullable().optional(),
});

export const updateScannerTarget = createServerFn({ method: "POST" })
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

    const { error } = await (context.supabase as any)
      .from("scanner_targets")
      .update(patch)
      .eq("target_key", data.target_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BulkSchema = z.object({ enabled: z.boolean() });

export const setAllScannerTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BulkSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("scanner_targets")
      .update({
        enabled: data.enabled,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .neq("target_key", "");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
