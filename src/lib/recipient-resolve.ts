import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function normalizeRecipientId(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

type AdminClient = SupabaseClient<Database>;

/** Look up a local profile by username / pi_username / display_name without ambiguous joins. */
export async function findLocalProfileByHandle(
  admin: AdminClient,
  raw: string,
): Promise<{
  id: string;
  username: string | null;
  display_name: string | null;
  pi_username: string | null;
} | null> {
  const to = normalizeRecipientId(raw);
  if (!to) return null;

  // Prefer exact case-insensitive match on username first (qualified filters, no joins).
  const tries: Array<"username" | "pi_username" | "display_name"> = [
    "username",
    "pi_username",
    "display_name",
  ];

  for (const col of tries) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, username, display_name, pi_username")
      .ilike(col, to)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return data;
  }

  return null;
}

export async function findLocalWalletAddressByHandle(
  admin: AdminClient,
  raw: string,
): Promise<string | null> {
  const to = normalizeRecipientId(raw);

  const { data: byAddr } = await admin
    .from("wallets")
    .select("address")
    .eq("address", to)
    .maybeSingle();
  if (byAddr?.address) return byAddr.address;

  const prof = await findLocalProfileByHandle(admin, to);
  if (!prof?.id) return null;

  const { data: w } = await admin
    .from("wallets")
    .select("address")
    .eq("user_id", prof.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return w?.address ?? null;
}
