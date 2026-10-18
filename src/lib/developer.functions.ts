import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

/** OpenPay Pro developer key — shown once; hash stored. */
function generateDeveloperKey() {
  return `opdk_${randomBytes(24).toString("hex")}`;
}

export const getDeveloperPortalProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: wallets } = await context.supabase
      .from("wallets")
      .select("id, name, address, is_active, ousd_balance, created_at")
      .eq("user_id", context.userId)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true });

    const list = wallets ?? [];
    const active = list.find((w) => w.is_active) ?? list[0] ?? null;

    const recovery: Record<string, boolean> = {};
    await Promise.all(
      list.map(async (w) => {
        const { data } = await context.supabase.rpc("wallet_has_recovery", {
          p_wallet_id: w.id,
        });
        recovery[w.id] = !!data;
      }),
    );

    const origin =
      (typeof process !== "undefined" && process.env.VITE_APP_URL) ||
      "https://openpaypro.space";

    return {
      userId: context.userId,
      username: profile?.username ?? null,
      displayName: profile?.display_name ?? null,
      wallets: list,
      activeWallet: active,
      recovery,
      inboundUrl: `${String(origin).replace(/\/$/, "")}/api/public/openpay/inbound`,
      docsUrl: "/docs/openpay",
      exchangeDocsUrl: "/docs/exchange",
      mcpPath: "/mcp",
    };
  });

export const listDeveloperApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("developer_api_keys")
      .select("id, label, prefix, scopes, active, last_used_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const CreateKeySchema = z.object({
  label: z.string().trim().min(2).max(80),
});

export const createDeveloperApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateKeySchema.parse(d))
  .handler(async ({ data, context }) => {
    const plaintext = generateDeveloperKey();
    const row = {
      user_id: context.userId,
      label: data.label,
      prefix: plaintext.slice(0, 14),
      key_hash: sha256(plaintext),
      scopes: ["inbound", "receive"],
      active: true,
    };
    const { data: inserted, error } = await context.supabase
      .from("developer_api_keys")
      .insert(row)
      .select("id, label, prefix, scopes, active, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { key: inserted, plaintext };
  });

const KeyIdSchema = z.object({ id: z.string().uuid() });

export const revokeDeveloperApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => KeyIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("developer_api_keys")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const activateDeveloperApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => KeyIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("developer_api_keys")
      .update({ active: true, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
