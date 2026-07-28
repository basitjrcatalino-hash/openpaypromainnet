/**
 * Client helpers for MetaMask Embedded Wallets social OAuth → OpenPay session.
 * https://docs.metamask.io/embedded-wallets/authentication/social-logins/oauth/
 */
import { supabase } from "@/integrations/supabase/client";

export { METAMASK_EMBEDDED_BRAND, WEB3AUTH_CLIENT_ID } from "@/lib/web3auth-env";

export async function exchangeWeb3AuthIdToken(idToken: string): Promise<{
  email: string;
  password: string;
  username?: string;
}> {
  const res = await fetch("/api/public/web3auth-auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    username?: string;
    error?: string;
  };
  if (!res.ok || !body.email || !body.password) {
    throw new Error(body.error || `MetaMask Embedded sign-in failed (${res.status})`);
  }
  return {
    email: body.email,
    password: body.password,
    username: body.username,
  };
}

export async function completeWeb3AuthSupabaseSession(
  idToken: string,
  opts?: { redirectTo?: string },
): Promise<void> {
  const creds = await exchangeWeb3AuthIdToken(idToken);
  const { error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (error) throw error;
  window.location.replace(opts?.redirectTo || "/dashboard");
}
