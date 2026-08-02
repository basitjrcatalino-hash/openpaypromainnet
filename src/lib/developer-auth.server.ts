import { createHash } from "crypto";

function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

/** Resolve a developer API key (opdk_…) → owning user id. */
export async function resolveDeveloperApiKey(
  plaintext: string,
): Promise<{ userId: string; keyId: string } | null> {
  if (!plaintext.startsWith("opdk_")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("developer_api_keys")
    .select("id, user_id, active")
    .eq("key_hash", sha256(plaintext))
    .eq("active", true)
    .maybeSingle();
  if (!data?.user_id) return null;
  await supabaseAdmin
    .from("developer_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return { userId: data.user_id, keyId: data.id };
}
