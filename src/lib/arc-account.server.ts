import type { SupabaseClient } from "@supabase/supabase-js";
import { findAuthUserByEmail } from "./auth-provision.server";

/** Called only after the server verifies and consumes a wallet signature challenge. */
export async function resolveArcAccount(admin: SupabaseClient, address: string, allowSignup: boolean) {
  const normalized = address.toLowerCase();
  const link = await admin.from("arc_wallet_links").select("user_id").eq("address", normalized).maybeSingle();
  if (link.error) throw link.error;
  if (link.data) return link.data.user_id as string;
  if (!allowSignup) throw new Error("This wallet is not linked yet. Create an account or sign in with another method to link your existing account.");

  // A wallet-only identity has no deliverable email or email-based password recovery.
  // Never resolve or merge an existing user's account by editable wallet metadata.
  const email = `arc-${normalized.slice(2)}@wallet.openpay.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { provider: "arc", evm_address: normalized, display_name: `arc_${normalized.slice(2, 14)}` },
  });
  if (error && !/registered|exists|duplicate|already/i.test(error.message)) throw error;
  const user = data.user ?? await findAuthUserByEmail(admin, email);
  if (!user) throw new Error("Wallet account could not be created.");
  // Existing signup triggers create the profile; no balances or credits are written here.
  const inserted = await admin.from("arc_wallet_links").insert({ address: normalized, user_id: user.id });
  if (inserted.error) {
    const winner = await admin.from("arc_wallet_links").select("user_id").eq("address", normalized).maybeSingle();
    if (winner.error || winner.data?.user_id !== user.id) throw new Error("This wallet is already linked to another account.");
  }
  return user.id;
}