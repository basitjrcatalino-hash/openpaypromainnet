import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes } from "crypto";
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

function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

function generateLedgerKey() {
  // olk_ + 48 hex chars — shown once at creation; only hash is stored
  return `olk_${randomBytes(24).toString("hex")}`;
}

export const getLedgerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("ledger_entries")
      .select("*", { count: "exact", head: true });
    const { data: latest } = await supabaseAdmin
      .from("ledger_entries")
      .select("sequence, occurred_at")
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      isAdmin: !!isAdmin,
      total_entries: count ?? 0,
      latest_sequence: latest?.sequence ?? 0,
      latest_at: latest?.occurred_at ?? null,
    };
  });

export const listLedgerEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ledger_entries")
      .select(
        "id, sequence, tx_id, from_address, to_address, asset, amount, usd_value, type, status, tx_hash, memo, occurred_at",
      )
      .order("sequence", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listLedgerApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("ledger_api_keys")
      .select("id, label, prefix, scopes, active, last_used_at, created_at, created_by")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const CreateKeySchema = z.object({
  label: z.string().trim().min(2).max(80),
});

export const createLedgerApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateKeySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const plaintext = generateLedgerKey();
    const row = {
      label: data.label,
      prefix: plaintext.slice(0, 12),
      key_hash: sha256(plaintext),
      scopes: ["read"],
      active: true,
      created_by: context.userId,
    };
    const { data: inserted, error } = await context.supabase
      .from("ledger_api_keys")
      .insert(row)
      .select("id, label, prefix, scopes, active, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { key: inserted, plaintext };
  });

const RevokeSchema = z.object({ id: z.string().uuid() });

export const revokeLedgerApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RevokeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("ledger_api_keys")
      .update({ active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const activateLedgerApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RevokeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("ledger_api_keys")
      .update({ active: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
