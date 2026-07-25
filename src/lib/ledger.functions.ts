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
    const types = ["send", "receive", "buy", "sell", "swap", "mint", "reward"] as const;
    const [{ count: ledgerCount }, { count: txCount }, { data: latest }, ...typeRows] =
      await Promise.all([
        supabaseAdmin.from("ledger_entries").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("transactions").select("*", { count: "exact", head: true }),
        supabaseAdmin
          .from("ledger_entries")
          .select("sequence, occurred_at")
          .order("sequence", { ascending: false })
          .limit(1)
          .maybeSingle(),
        ...types.map((t) =>
          supabaseAdmin
            .from("ledger_entries")
            .select("*", { count: "exact", head: true })
            .eq("type", t),
        ),
      ]);

    const typeCounts: Record<string, number> = {};
    types.forEach((t, i) => {
      typeCounts[t] = typeRows[i]?.count ?? 0;
    });

    const totalLedger = ledgerCount ?? 0;
    const totalTx = txCount ?? 0;

    return {
      isAdmin: !!isAdmin,
      total_entries: totalLedger,
      total_transactions: totalTx,
      missing: Math.max(0, totalTx - totalLedger),
      latest_sequence: latest?.sequence ?? 0,
      latest_at: latest?.occurred_at ?? null,
      by_type: typeCounts,
    };
  });

export const listLedgerEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        type: z
          .enum(["send", "receive", "swap", "mint", "buy", "sell", "reward"])
          .optional()
          .nullable(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = data?.limit ?? 200;
    let q = supabaseAdmin
      .from("ledger_entries")
      .select(
        "id, sequence, tx_id, from_address, to_address, asset, amount, usd_value, type, status, tx_hash, memo, occurred_at",
      )
      .order("sequence", { ascending: false })
      .limit(limit);
    if (data?.type) q = q.eq("type", data.type);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Mirror any missing wallet transactions into ledger_entries (admin). */
export const backfillLedgerEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Prefer DB RPC when migration is applied
    const { data: rpcData, error: rpcErr } = await (supabaseAdmin as any).rpc(
      "backfill_ledger_entries",
    );
    if (!rpcErr && rpcData && typeof rpcData === "object" && "inserted" in (rpcData as object)) {
      return { inserted: Number((rpcData as { inserted: number }).inserted) || 0, via: "rpc" as const };
    }

    // Fallback: app-side backfill
    const { data: txs, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, wallet_id, type, token_symbol, counterparty, amount, usd_value, status, tx_hash, memo, created_at, wallets:wallet_id(address)",
      )
      .order("created_at", { ascending: true })
      .limit(5000);
    if (txErr) throw new Error(txErr.message);

    const { data: existing } = await supabaseAdmin.from("ledger_entries").select("tx_id");
    const seen = new Set((existing ?? []).map((e) => e.tx_id).filter(Boolean));

    const rows = [];
    for (const t of txs ?? []) {
      if (seen.has(t.id)) continue;
      const walletAddr =
        (t.wallets as { address?: string } | null)?.address ??
        (Array.isArray(t.wallets) ? (t.wallets[0] as { address?: string } | undefined)?.address : null) ??
        null;
      const isOut = t.type === "send" || t.type === "swap" || t.type === "sell";
      rows.push({
        tx_id: t.id,
        wallet_id: t.wallet_id,
        from_address: isOut ? walletAddr : (t.counterparty ?? "external"),
        to_address: isOut ? (t.counterparty ?? "external") : walletAddr,
        asset: t.token_symbol ?? "OUSD",
        amount: t.amount,
        usd_value: t.usd_value ?? 0,
        type: t.type,
        status: t.status ?? "confirmed",
        tx_hash: t.tx_hash,
        memo: t.memo,
        occurred_at: t.created_at,
      });
    }

    if (!rows.length) return { inserted: 0, via: "app" as const };

    const { error: insErr } = await supabaseAdmin.from("ledger_entries").insert(rows);
    if (insErr) throw new Error(insErr.message);
    return { inserted: rows.length, via: "app" as const };
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
