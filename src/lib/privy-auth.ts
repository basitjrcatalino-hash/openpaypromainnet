/**
 * Privy authentication — exchanges Privy identity for a Supabase session.
 * Same pattern as web3auth-auth.ts and solana-auth.ts.
 */
import { supabase } from "@/integrations/supabase/client";

export const PRIVY_APP_ID =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_PRIVY_APP_ID ?? "").trim()) ||
  "";

export const PRIVY_BRAND_COLOR = "#6851FF";
export const PRIVY_LOGO_URL = "https://assets.privy.io/privy-logo-light.png";

/**
 * After Privy login succeeds, exchange the Privy user info for a Supabase session.
 */
export async function completePrivySupabaseSession(privyUser: {
  id: string;
  email?: { address: string } | null;
  wallet?: { address: string } | null;
}): Promise<void> {
  const email = `privy_${privyUser.id}@openpay.wallet`;
  const password = `privy__${privyUser.id}__${PRIVY_APP_ID}`;

  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { provider: "privy", privy_id: privyUser.id } },
  });

  if (signUpError && !signUpError.message.includes("already registered")) {
    throw signUpError;
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) throw signInError;
}
